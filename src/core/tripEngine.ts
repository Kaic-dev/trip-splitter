import type { Passenger, RouteResult, TripSchedule, TripExecutionMode, DistanceMatrixResponse, DrivingRouteResponse, Address } from '../types';
import type { MapProvider } from '../providers/MapProvider';
import { CostEngine, computeSmartMargin } from './costEngine';
import { searchCache, routeCache } from './cache';
import { getWaypointsKey } from './normalization';
import { globalRateLimiter } from './rateLimiter';
import { createLogger, flowManager } from './logger';

const logger = createLogger('Engine');

function solveTSPNearestNeighbor(
  origin: [number, number],
  destination: [number, number],
  stops: { id: string; coordinates: [number, number] }[],
  matrix: DistanceMatrixResponse
): { orderedStopIds: string[] } {
  const allCoords = [origin, ...stops.map(s => s.coordinates), destination];
  const findIdx = (c: [number, number]) => allCoords.findIndex(ac => ac[0] === c[0] && ac[1] === c[1]);
  
  const originIdx = 0;
  const stopIndices = stops.map(s => findIdx(s.coordinates));
  
  const orderedIndices: number[] = [];
  let currentIdx = originIdx;
  const remaining = new Set(stopIndices);

  while (remaining.size > 0) {
    let nearestIdx = -1;
    let minDist = Infinity;
    for (const idx of remaining) {
      const d = matrix.distances[currentIdx][idx];
      if (d < minDist) {
        minDist = d;
        nearestIdx = idx;
      }
    }
    orderedIndices.push(nearestIdx);
    remaining.delete(nearestIdx);
    currentIdx = nearestIdx;
  }

  return {
    orderedStopIds: orderedIndices.map(idx => stops[stopIndices.indexOf(idx)].id)
  };
}

export class TripEngine {
  private provider: MapProvider;
  private microCache: Map<string, any> = new Map();
  private pendingMicro: Map<string, Promise<any>> = new Map();

  constructor(provider: MapProvider) {
    this.provider = provider;
  }

  private async getDrivingRouteCached(waypoints: [number, number][], options?: { departAt?: string; useTraffic?: boolean }): Promise<DrivingRouteResponse> {
    const key = `route|${getWaypointsKey(waypoints)}|${options?.departAt || 'now'}`;
    
    if (this.microCache.has(key)) {
      return this.microCache.get(key);
    }

    if (this.pendingMicro.has(key)) {
      return this.pendingMicro.get(key);
    }

    const promise = (async () => {
      try {
        const res = await this.provider.getDrivingRoute(waypoints, options);
        this.microCache.set(key, res);
        return res;
      } finally {
        this.pendingMicro.delete(key);
      }
    })();

    this.pendingMicro.set(key, promise);
    return promise;
  }

  async calculateTrip(
    origin: Address,
    destination: Address,
    passengers: Passenger[],
    kmPerLiter: number,
    fuelPrice: number,
    schedule?: TripSchedule,
    executionMode: TripExecutionMode = 'SHARED',
    vehicleCapacity: number = 4,
    flowId?: string
  ): Promise<RouteResult> {
    this.microCache.clear(); 
    const flowLogger = flowId ? logger.withFlow(flowId) : logger;
    
    const originCoords = origin.coordinates;
    const destCoords = destination.coordinates;
    const stops = passengers.map(p => ({ id: p.id, coordinates: p.location.coordinates }));
    
    const wpKey = getWaypointsKey([originCoords, ...stops.map(s => s.coordinates), destCoords]);
    const cacheKey = `engine|${wpKey}|${executionMode}|${kmPerLiter}|${fuelPrice}`;

    return routeCache.getOrFetch(cacheKey, async () => {
      flowLogger.group('TRIP CALCULATION', { origin: origin.label, dest: destination.label });
      
      flowLogger.info("INPUT", {
        origin: origin.label,
        destination: destination.label,
        passengers: passengers.length,
        mode: executionMode
      });

      const metrics = searchCache.getMetrics(); 
      const isUnderHeavyLoad = metrics.misses > 20 && (metrics.hits / metrics.misses) < 0.5;
      const heuristicThreshold = isUnderHeavyLoad ? 4 : 8; 
      
      if (isUnderHeavyLoad) {
        flowLogger.warn('ADAPTIVE_ENGINE_LIMIT: High load detected. Reducing optimizer threshold to 4 stops.');
        globalRateLimiter.adapt(0.8); 
        if (flowId) flowManager.addExplanation(flowId, "System under heavy load: Reducing optimization complexity to maintain speed");
      }

      const matrixCoords = [originCoords, ...passengers.map(p => p.location.coordinates), destCoords];
      let matrix: DistanceMatrixResponse;

      if (matrixCoords.length <= 25 || !isUnderHeavyLoad) {
         flowLogger.info('STRATEGY', { matrix: 'FULL', reason: 'Passenger count < 25', size: matrixCoords.length });
         matrix = await this.provider.getDistanceMatrix(matrixCoords);
         flowLogger.cache('Matrix', 'MISS', { size: matrixCoords.length });
      } else {
         flowLogger.warn('STRATEGY', { matrix: 'PARTIAL', reason: 'HEAVY_LOAD_DETECTION' });
         matrix = await this.provider.getDistanceMatrix([originCoords, destCoords]);
      }

      let orderedStopIds: string[];
      let orderedWaypoints: [number, number][];

      if (stops.length === 0) {
        flowLogger.info('ROUTE MODE', { type: 'DIRECT', reason: 'No passengers/stops' });
        if (flowId) flowManager.addExplanation(flowId, "Calculating direct route (no intermediate stops)");
        orderedStopIds = [];
        orderedWaypoints = [originCoords, destCoords];
      } else if (stops.length <= heuristicThreshold) {
        flowLogger.info('ROUTE MODE', { type: 'TSP (Nearest Neighbor)', reason: `stops <= ${heuristicThreshold}` });
        if (flowId) flowManager.addExplanation(flowId, `Using Local TSP (Nearest Neighbor) to optimize ${stops.length} stops`);
        const solved = solveTSPNearestNeighbor(originCoords, destCoords, stops, matrix);
        orderedStopIds = solved.orderedStopIds;
        orderedWaypoints = [originCoords, ...orderedStopIds.map(id => stops.find(s => s.id === id)!.coordinates), destCoords];
      } else {
        flowLogger.info('ROUTE MODE', { type: 'REMOTE_OPTIMIZER', reason: `stops > ${heuristicThreshold}` });
        if (flowId) flowManager.addExplanation(flowId, `Stops exceed ${heuristicThreshold}: Requesting remote cloud optimization`);
        const opt = await this.provider.getOptimalRoute(originCoords, destCoords, stops);
        orderedStopIds = opt.orderedStopIds;
        orderedWaypoints = opt.orderedWaypoints;
      }

      // 3. Consolidated Driving Routes
      const [mainRoute, baseRoute] = await Promise.all([
        this.getDrivingRouteCached(orderedWaypoints, {
          useTraffic: !!schedule,
          departAt: schedule?.time?.toISOString()
        }),
        this.getDrivingRouteCached([originCoords, destCoords])
      ]);

      flowLogger.success('ROUTE RESULT', {
        distance: mainRoute.distanceKm.toFixed(1) + ' km',
        duration: Math.round(mainRoute.durationMinutes) + ' min',
        detour: (mainRoute.distanceKm - baseRoute.distanceKm).toFixed(1) + ' km'
      });
      
      if (flowId) {
        const detourStr = (mainRoute.distanceKm - baseRoute.distanceKm).toFixed(1);
        flowManager.addExplanation(flowId, `Route resolved: ${mainRoute.distanceKm.toFixed(1)}km total (${detourStr}km detour impact)`);
      }
      
      const passengerDetourKms = passengers.map(p => {
        const pIdx = matrixCoords.findIndex(c => c[0] === p.location.coordinates[0]);
        const impact = (matrix.distances[0][pIdx] + matrix.distances[pIdx][matrixCoords.length-1] - matrix.distances[0][matrixCoords.length-1]) / 1000;
        return {
          passengerId: p.id,
          passengerName: p.name,
          detourKm: Math.max(0, Math.round(impact * 10) / 10),
          marginalImpactKm: impact
        };
      });

      const totalDistanceKm = mainRoute.distanceKm;
      const totalDurationMinutes = mainRoute.durationMinutes;
      const totalDetourKm = passengerDetourKms.reduce((s, p) => s + p.detourKm, 0);

      const margin = computeSmartMargin({
        distanceKm: totalDistanceKm,
        durationMinutes: totalDurationMinutes,
        passengerCount: passengers.length,
        capacity: vehicleCapacity,
        detourKm: totalDetourKm,
        flowId
      });

      const breakdown = CostEngine.calculateTripCosts({
        totalDistanceKm,
        kmPerLiter,
        fuelPrice,
        executionMode,
        marginPercent: margin,
        flowId
      });

      const costSplits = CostEngine.splitCost({
        baseDistanceKm: baseRoute.distanceKm,
        totalDistanceKm,
        passengerDetourKms,
        kmPerLiter,
        fuelPrice,
        totalCost: breakdown.totalCost,
        baseFuelCost: (baseRoute.distanceKm / kmPerLiter) * fuelPrice,
        totalFuelCost: breakdown.fuelCost,
        marginAmount: breakdown.marginAmount,
        flowId
      });

      flowLogger.success('Trip Finalized Successfully', {
        totalCost: breakdown.totalCost,
        dist: totalDistanceKm.toFixed(1) + ' km'
      });

      flowLogger.groupEnd();

      return {
        orderedPassengers: orderedStopIds.map(id => passengers.find(p => p.id === id)!),
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        baseDistanceKm: Math.round(baseRoute.distanceKm * 10) / 10,
        passengerDetours: costSplits,
        waypoints: orderedWaypoints,
        geometry: mainRoute.geometry,
        baseGeometry: baseRoute.geometry,
        totalCost: breakdown.totalCost,
        pureFuelCost: breakdown.fuelCost,
        marginAmount: breakdown.marginAmount,
        durationMinutes: Math.round(totalDurationMinutes),
        matrix
      };
    });
  }
}

import type { MapProvider } from './MapProvider';
import { MapboxProvider } from './MapboxProvider';
import type { 
  LocationResult, 
  RouteOption, 
  OptimalRouteResponse, 
  DrivingRouteResponse, 
  DistanceMatrixResponse, 
  MapMatchedResponse 
} from '../types';
import { platformCost, type ApiService } from '../core/platformCost';
import { budgetManager } from '../core/BudgetManager';
import { RequestPriority } from '../core/rateLimiter';

/**
 * Enterprise Architect: ProviderManager
 * Orchestrates multiple map providers with real-time cost-aware switching.
 */
export class ProviderManager implements MapProvider {
  private primary: MapProvider;
  private fallback?: MapProvider;

  constructor(primary: MapProvider, fallback?: MapProvider) {
    this.primary = primary;
    this.fallback = fallback;
  }

  private async executeWithFallback<T>(
    operation: (p: MapProvider) => Promise<T>, 
    opName: string, 
    apiService: ApiService,
    priority: number = 1
  ): Promise<T> {
    // 1. Check Budget & Status
    const { canProceed } = budgetManager.checkBudget();
    if (!canProceed && priority < RequestPriority.CRITICAL) {
      throw new Error(`[BUDGET EXCEEDED] Blocking non-essential call to ${opName}`);
    }

    // 2. Dynamic Provider Switching (e.g. if Google is too expensive for this session)
    const metrics = platformCost.getMetrics();
    const useFallback = metrics.sessionCost > 0.5 && this.fallback; 
    
    const targetProvider = useFallback ? this.fallback! : this.primary;

    try {
      const result = await operation(targetProvider);
      
      // 3. Track actual cost on success
      platformCost.trackCall(apiService);
      return result;
    } catch (err) {
      console.warn(`[ProviderManager] Error on ${opName}. Attempting dynamic recovery...`, err);
      
      if (this.fallback && targetProvider === this.primary) {
        try {
          const res = await operation(this.fallback);
          platformCost.trackCall(apiService); // Track against fallback
          return res;
        } catch (fErr) {
          throw fErr;
        }
      }
      throw err;
    }
  }

  async searchLocation(query: string, sessionToken: string): Promise<LocationResult[]> {
    return this.executeWithFallback(p => p.searchLocation(query, sessionToken), 'searchLocation', 'mapbox-search', RequestPriority.CRITICAL);
  }

  async retrieveCoordinates(id: string, sessionToken: string): Promise<[number, number]> {
    return this.executeWithFallback(p => p.retrieveCoordinates(id, sessionToken), 'retrieveCoordinates', 'mapbox-search', RequestPriority.MEDIUM);
  }

  async getDrivingRoute(waypoints: [number, number][]): Promise<DrivingRouteResponse> {
    return this.executeWithFallback(p => p.getDrivingRoute(waypoints), 'getDrivingRoute', 'mapbox-directions', RequestPriority.HIGH);
  }

  async getOptimalRoute(
    origin: [number, number],
    destination: [number, number],
    stops: { id: string; coordinates: [number, number] }[]
  ): Promise<OptimalRouteResponse> {
    return this.executeWithFallback(p => p.getOptimalRoute(origin, destination, stops), 'getOptimalRoute', 'google-directions', RequestPriority.HIGH);
  }

  async getRouteAlternatives(waypoints: [number, number][], kmPerLiter: number, fuelPrice: number): Promise<RouteOption[]> {
    return this.executeWithFallback(p => p.getRouteAlternatives(waypoints, kmPerLiter, fuelPrice), 'getRouteAlternatives', 'mapbox-directions', RequestPriority.LOW);
  }

  async reverseGeocode(coordinates: [number, number]): Promise<LocationResult | null> {
    return this.executeWithFallback(p => p.reverseGeocode(coordinates), 'reverseGeocode', 'google-geocode', RequestPriority.MEDIUM);
  }

  async getDistanceMatrix(coordinates: [number, number][]): Promise<DistanceMatrixResponse> {
    const service = coordinates.length > 5 ? 'google-matrix' : 'mapbox-matrix';
    return this.executeWithFallback(p => p.getDistanceMatrix(coordinates), 'getDistanceMatrix', service, RequestPriority.MEDIUM);
  }

  async matchMap(coordinates: [number, number][]): Promise<MapMatchedResponse> {
    return this.executeWithFallback(p => p.matchMap(coordinates), 'matchMap', 'mapbox-directions', RequestPriority.LOW);
  }

  getStaticMapUrl(
    geometry: any,
    origin: [number, number],
    destination: [number, number],
    stops: [number, number][],
    width?: number,
    height?: number
  ): string {
    return this.primary.getStaticMapUrl(geometry, origin, destination, stops, width, height);
  }
}

export const mapProvider = new ProviderManager(new MapboxProvider());

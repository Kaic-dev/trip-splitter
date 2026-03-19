import { useState, useRef, useEffect } from 'react';
import type { Trip, RouteResult, Passenger, Address, TripSchedule, TripExecutionMode } from '../types';
import { TripEngine } from '../core/tripEngine';
import type { MapProvider } from '../providers/MapProvider';
import { hashTripParams } from '../core/normalization';
import { createLogger, Logger, flowManager } from '../core/logger';

const logger = createLogger('CalculationHook');

interface UseTripCalculationReturn {
  loading: boolean;
  error: string | null;
  calculate: (params: {
    origin: Address;
    destination: Address;
    passengers: Passenger[];
    kmPerLiter: number;
    fuelPrice: number;
    schedule?: TripSchedule;
    executionMode?: TripExecutionMode;
    vehicleCapacity?: number;
  }, onSuccess: (trip: Trip, result: RouteResult) => void) => Promise<void>;
}

export function useTripCalculation(provider: MapProvider): UseTripCalculationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastParamsHashRef = useRef<string>('');

  // Cleanup pending requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const calculate = async (
    params: {
      origin: Address;
      destination: Address;
      passengers: Passenger[];
      kmPerLiter: number;
      fuelPrice: number;
      schedule?: TripSchedule;
      executionMode?: TripExecutionMode;
      vehicleCapacity?: number;
    },
    onSuccess: (trip: Trip, result: RouteResult) => void
  ) => {
    // 1. [IMPROVED] Hash-Based Guard - Prevents redundant executions
    const currentHash = hashTripParams(params);
    const flowId = params.origin?.flowId || params.destination?.flowId || Logger.createFlowId();
    const flowLogger = logger.withFlow(flowId);

    if (currentHash === lastParamsHashRef.current) {
      flowLogger.debug('CALCULATION SKIPPED', { reason: 'HASH_MATCH' });
      return;
    }
    lastParamsHashRef.current = currentHash;

    // 2. Cancel previous pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    const { origin, destination, passengers, kmPerLiter, fuelPrice, schedule, executionMode, vehicleCapacity = 4 } = params;

    try {
      if (controller.signal.aborted) return;
      const startCalculation = performance.now();

      flowLogger.info("TRIP CONTEXT", {
        origin: origin.label,
        originConfidence: origin.confidence || "UNKNOWN",
        derivedFrom: origin.flowId ? `SEARCH FLOW ${origin.flowId}` : "MANUAL_ENTRY"
      });
      
      flowManager.addExplanation(flowId, `Trip started from ${origin.label} (confidence: ${origin.confidence || 'HIGH'})`);
      flowManager.addExplanation(flowId, passengers.length > 0 ? `Optimizing for ${passengers.length} stops` : "Direct route (no stops)");

      const engine = new TripEngine(provider);
      
      const trip: Trip = {
        origin,
        destination,
        passengers,
        kmPerLiter,
        fuelPrice,
        schedule,
        executionMode,
        vehicleCapacity,
      };

      const routeResult = await engine.calculateTrip(
        origin,
        destination,
        passengers,
        kmPerLiter,
        fuelPrice,
        schedule,
        executionMode || 'SHARED',
        vehicleCapacity,
        flowId
      );

      if (controller.signal.aborted) return;

      const calcMs = performance.now() - startCalculation;
      flowLogger.timing("CALCULATION PHASE", calcMs);
      flowLogger.success('Calculation Successful', { flowId });

      // Finalize Flow Context
      flowManager.update(flowId, {
        route: {
          distance: `${routeResult.totalDistanceKm.toFixed(1)} km`,
          duration: `${Math.round(routeResult.durationMinutes || 0)} min`,
          strategy: passengers.length > 0 ? "OPTIMIZED (TSP)" : "DIRECT"
        },
        cost: {
          fuel: routeResult.pureFuelCost || 0,
          margin: routeResult.marginAmount || 0,
          total: routeResult.totalCost
        }
      });
      
      flowManager.addExplanation(flowId, `Route calculated using ${passengers.length > 0 ? 'OPTIMIZED' : 'DIRECT'} strategy`);

      // ULTIMATE SYSTEM ANSWER
      let ctx = flowManager.get(flowId);
      if (!ctx) {
        // Fallback for flows that started without a search context (e.g. History)
        ctx = flowManager.create(flowId);
        ctx.inputRaw = origin.label;
        ctx.interpretedIntent = (origin.type as string) || "STREET";
        ctx.selectedEntity = origin.label;
      }

      flowLogger.logSystemAnswer({
        userInput: ctx.inputRaw || origin.label,
        interpretedAs: ctx.interpretedIntent || (origin.type as string) || "STREET",
        resolvedLocation: {
          label: origin.label,
          type: origin.type || "ADDRESS",
          confidence: origin.confidence || "HIGH"
        },
        alternatives: ctx.alternatives,
        route: ctx.route,
        cost: ctx.cost,
        explanation: ctx.explanation
      });

      // Final Perf Breakdown
      flowLogger.info("PERF BREAKDOWN", {
        total: `${Math.round(performance.now() - ctx.startTime)}ms`,
        calculation: `${Math.round(calcMs)}ms`
      });

      onSuccess(trip, routeResult);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'AbortError') {
        console.log('[useTripCalculation] Request cancelled due to new input.');
        return; 
      }

      console.error('Error in trip calculation:', err);
      const status = err?.response?.status;
      if (status === 429) {
        setError('O servidor de rotas está sobrecarregado (Limite de requisições). Tente novamente em alguns segundos.');
      } else if (!navigator.onLine) {
        setError('Você parece estar offline. Verifique sua conexão com a internet.');
      } else {
        setError('Erro ao calcular a rota. Verifique os endereços e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    calculate
  };
}

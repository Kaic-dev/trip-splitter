import type { CostSplitInput, PassengerDetour, TripCostBreakdown, TripExecutionMode } from '../types';
import { createLogger, flowManager } from './logger';

const logger = createLogger('CostEngine');

export function computeSmartMargin(params: {
  distanceKm: number;
  durationMinutes: number;
  passengerCount: number;
  capacity: number;
  detourKm: number;
  flowId?: string;
}): number {
  const flowLogger = params.flowId ? logger.withFlow(params.flowId) : logger;
  let margin = 12; // Base margin
  const factors: string[] = [];

  // 1. Occupancy (pax / capacity)
  const occupancy = params.capacity > 0 ? (params.passengerCount / params.capacity) : 1;
  if (occupancy < 0.25) {
    margin += 12;
    factors.push(`Baixa ocupação (<25%): +12%`);
  } else if (occupancy < 0.50) {
    margin += 6;
    factors.push(`Média ocupação (<50%): +6%`);
  } else if (occupancy > 0.75) {
    margin -= 4;
    factors.push(`Alta ocupação (>75%): -4%`);
  }

  // 2. Distance
  if (params.distanceKm < 5) {
    margin += 8;
    factors.push(`Curta distância (<5km): +8%`);
  } else if (params.distanceKm > 50) {
    margin -= 4;
    factors.push(`Longa distância (>50km): -4%`);
  }

  // 3. Detour
  if (params.detourKm > 5) {
    margin += 6;
    factors.push(`Alto desvio (>5km): +6%`);
  } else if (params.detourKm > 2) {
    margin += 4;
    factors.push(`Médio desvio (>2km): +4%`);
  }

  // 4. Duration
  if (params.durationMinutes > 90) {
    margin += 6;
    factors.push(`Longa duração (>90min): +6%`);
  } else if (params.durationMinutes > 45) {
    margin += 4;
    factors.push(`Média duração (>45min): +4%`);
  }

  // Clamp 8% - 35%
  const finalMargin = Math.max(8, Math.min(35, margin));

  if (params.flowId) {
    flowManager.addExplanation(params.flowId, `Driver margin set to ${finalMargin}% (${factors.join('; ')})`);
  }

  flowLogger.info('MARGIN LOGIC', {
    occupancyRate: (occupancy * 100).toFixed(1) + '%',
    base: '12%',
    factors,
    rawMargin: margin + '%',
    finalMargin: finalMargin + '%'
  });

  return finalMargin;
}

/**
 * Advanced fair cost split algorithm (Pure Domain Logic).
 */
export const CostEngine = {

  /**
   * Centralized trip cost calculation following mandatory formulas.
   */
  calculateTripCosts(input: {
    totalDistanceKm: number,
    returnDistanceKm?: number,
    kmPerLiter: number,
    fuelPrice: number,
    executionMode?: TripExecutionMode,
    durationMinutes?: number,
    passengerCount?: number,
    detourKm?: number,
    marginPercent?: number,
    flowId?: string
  }): TripCostBreakdown {
    const {
      totalDistanceKm,
      returnDistanceKm = 0,
      kmPerLiter,
      fuelPrice,
      executionMode = 'SHARED',
      durationMinutes = 0,
      passengerCount = 0,
      detourKm = 0,
      flowId
    } = input;

    const flowLogger = flowId ? logger.withFlow(flowId) : logger;
    flowLogger.group('COST CALCULATION');

    flowLogger.info('COST INPUT', {
      distance: totalDistanceKm.toFixed(1) + ' km',
      fuel: fuelPrice.toFixed(2),
      passengers: passengerCount
    });

    const billingDistanceKm = executionMode === 'DEDICATED'
      ? totalDistanceKm + returnDistanceKm
      : totalDistanceKm;

    // FORMULA: litros_usados = distancia_total_billing / consumo_medio
    const litersUsed = billingDistanceKm / kmPerLiter;

    // FORMULA: custo_combustivel = litros_usados * preco_combustivel
    const fuelCost = litersUsed * fuelPrice;

    // DYNAMIC MARGIN CALCULATION (Trip-level)
    let marginAmount = 0;
    let marginPercent = 0;

    if (executionMode === 'SHARED' || executionMode === 'DEDICATED') {
      if (input.marginPercent !== undefined) {
        marginPercent = input.marginPercent;
        flowLogger.info("MARGIN SOURCE: PRE-COMPUTED", { percent: marginPercent });
      } else {
        flowLogger.warn("MARGIN RE-CALCULATION REQUIRED", { reason: 'not provided' });
        marginPercent = computeSmartMargin({
          distanceKm: billingDistanceKm,
          durationMinutes,
          passengerCount,
          detourKm,
          capacity: 4,
          flowId
        });
      }
      marginAmount = fuelCost * (marginPercent / 100);
    }

    // FORMULA: total_corrida = custo_combustivel + margem_motorista
    const totalCost = fuelCost + marginAmount;

    if (flowId) {
      flowManager.addExplanation(flowId, `Final price: R$ ${totalCost.toFixed(2)} (Fuel: R$ ${fuelCost.toFixed(2)} + Margin: R$ ${marginAmount.toFixed(2)})`);
    }

    flowLogger.success('FINAL PRICE', {
      fuelCost: fuelCost.toFixed(2),
      margin: marginAmount.toFixed(2),
      total: totalCost.toFixed(2)
    });

    flowLogger.groupEnd();

    return {
      billingDistanceKm: Math.round(billingDistanceKm * 10) / 10,
      litersUsed: Math.round(litersUsed * 1000) / 1000,
      fuelCost: Math.round(fuelCost * 100) / 100,
      marginAmount: Math.round(marginAmount * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100
    };
  },

  /**
   * Split the entire cost of the journey into fair fragments base on Marginal Devations.
   */
  splitCost(input: CostSplitInput & { totalCost: number, baseFuelCost: number, totalFuelCost: number, marginAmount: number, flowId?: string }): PassengerDetour[] {
    const {
      passengerDetourKms,
      executionMode = 'SHARED',
      totalCost,
      baseFuelCost,
      totalFuelCost,
      marginAmount // Trip-level margin pre-computed
    } = input;

    const breakdown = { totalCost, fuelCost: totalFuelCost, marginAmount };
    const passengerCount = passengerDetourKms.length;

    if (executionMode === 'DEDICATED') {
      // USER FORMULA: valor_passageiro = total_corrida / numero_passageiros
      const paymentPerPassenger = passengerCount > 0 ? breakdown.totalCost / passengerCount : 0;

      const results: PassengerDetour[] = passengerDetourKms.map(p => ({
        passengerId: p.passengerId,
        passengerName: p.passengerName,
        detourKm: Math.round(p.marginalImpactKm * 10) / 10,
        paymentAmount: paymentPerPassenger,
      }));

      results.push({
        passengerId: 'driver',
        passengerName: 'Motorista (Você)',
        detourKm: 0,
        paymentAmount: 0,
        isDriver: true,
      });

      return results;
    }

    // SHARED MODE — Marginal Impact model
    // 1. Base cost: split equally among all participants (driver included)
    const totalParticipants = 1 + passengerCount;
    const shareBaseFuel = baseFuelCost / totalParticipants;

    // 2. Detour cost: the extra fuel cost caused by bringing passengers off the straight path
    const detourFuelCost = Math.max(0, breakdown.fuelCost - baseFuelCost);

    // 3. Compute each passenger's marginal impact (from tripEngine via matrix heuristic)
    const impacts = passengerDetourKms.map(p => ({
      ...p,
      impact: Math.max(0, p.marginalImpactKm)
    }));
    const totalImpact = impacts.reduce((sum, p) => sum + p.impact, 0);

    console.log('[CostEngine] Impacts:', impacts.map(p => ({ id: p.passengerId, impact: p.impact })));
    console.log('[CostEngine] Total Impact:', totalImpact, '| Detour Fuel Cost:', detourFuelCost);

    const results: PassengerDetour[] = [];

    impacts.forEach(p => {
      // 4. Detour share: proportional to their marginal impact
      let passengerDetourFuel = 0;
      if (totalImpact > 0) {
        passengerDetourFuel = (p.impact / totalImpact) * detourFuelCost;
      } else if (detourFuelCost > 0 && passengerCount > 0) {
        // Edge case: detour cost exists but no passenger has individual impact → split equally
        passengerDetourFuel = detourFuelCost / passengerCount;
      }

      // The passenger's raw fuel cost share
      const fuelCostForPassenger = shareBaseFuel + passengerDetourFuel;

      // Proportional margin distribution based on fuel cost share
      const passengerMarginAmount = breakdown.fuelCost > 0
        ? (fuelCostForPassenger / breakdown.fuelCost) * breakdown.marginAmount
        : breakdown.marginAmount / passengerCount;

      const paymentAmount = fuelCostForPassenger + passengerMarginAmount;

      results.push({
        passengerId: p.passengerId,
        passengerName: p.passengerName,
        detourKm: Math.round(p.impact * 10) / 10,
        marginalImpactKm: p.impact,
        paymentAmount,
        pureFuelCost: fuelCostForPassenger,
        baseFuelCost: shareBaseFuel,
        detourFuelCost: passengerDetourFuel,
        marginAmount: passengerMarginAmount,
      });
    });

    results.push({
      passengerId: 'driver',
      passengerName: 'Motorista (Você)',
      detourKm: 0,
      paymentAmount: shareBaseFuel + (breakdown.fuelCost > 0 ? (shareBaseFuel / breakdown.fuelCost) * breakdown.marginAmount : 0),
      isDriver: true,
    });

    const finalResults = results.map((p) => ({
      ...p,
      paymentAmount: Math.round(p.paymentAmount * 100) / 100,
    }));

    // PENNY ADJUSTMENT: Ensure sum(all) == breakdown.totalCost
    const currentSum = finalResults.reduce((sum, p) => sum + p.paymentAmount, 0);
    const difference = Math.round((breakdown.totalCost - currentSum) * 100) / 100;

    if (difference !== 0 && finalResults.length > 0) {
      const lastIdx = finalResults.length - 1;
      finalResults[lastIdx].paymentAmount = Math.round((finalResults[lastIdx].paymentAmount + difference) * 100) / 100;
    }

    console.log('[CostEngine] Final Costs:', finalResults.map(p => ({ id: p.passengerId, amount: p.paymentAmount })));

    return finalResults;
  },

  /**
   * Calculates the relative impact and efficiency of each passenger's payment 
   * compared to their distance share.
   */
  calculatePassengerImpact(trip: any, payments: any[]) {
    const totalCost = trip.totalCost;
    const totalDistance = trip.routeResult.totalDistanceKm || trip.totalDistance;
    const baseDistance = trip.routeResult.baseDistanceKm || totalDistance;
    const totalParticipants = payments.length;

    return payments.map(p => {
      const detourInfo = trip.routeResult.passengerDetours.find((d: any) => d.passengerId === p.passengerId);

      const costShare = (p.amount / totalCost);
      const individualDistance = (baseDistance / totalParticipants) + (detourInfo?.marginalImpactKm || 0);
      const distanceShare = totalDistance > 0 ? (individualDistance / totalDistance) : (1 / totalParticipants);
      const efficiencyScore = costShare / (distanceShare || 0.0001);

      let impactLabel = 'Divisão equilibrada';
      let color = 'var(--text-muted)';
      let impactExplanation = 'O valor pago é exatamente proporcional à distância percorrida pelo passageiro até seu destino.';

      if (efficiencyScore > 1.05) {
        impactLabel = 'Acima do proporcional';
        color = 'var(--danger)';
        impactExplanation = `O passageiro pagou ${(costShare * 100).toFixed(0)}% da conta, mas consumiu apenas ${(distanceShare * 100).toFixed(0)}% da distância da corrida. (O desvio encareceu o trajeto).`;
      } else if (efficiencyScore < 0.95) {
        impactLabel = 'Abaixo do proporcional';
        color = 'var(--success)';
        impactExplanation = `O passageiro consumiu ${(distanceShare * 100).toFixed(0)}% da distância, mas pagou apenas ${(costShare * 100).toFixed(0)}% da conta devido à divisão de custos. (Economia).`;
      }

      return {
        ...p,
        costShare: Math.round(costShare * 100),
        distanceShare: Math.round(distanceShare * 100),
        detourKm: detourInfo ? detourInfo.detourKm : 0,
        marginalImpactKm: detourInfo ? detourInfo.marginalImpactKm : 0,
        efficiencyScore,
        impactLabel,
        impactExplanation,
        color
      };
    });
  }
};

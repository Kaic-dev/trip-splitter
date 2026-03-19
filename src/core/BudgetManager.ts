import { platformCost } from './platformCost';

export interface BudgetConfig {
  dailyGlobalLimit: number;
  perSessionLimit: number;
  softThreshold: number; // 0-1, when to start aggressive degradation
}

/**
 * Enterprise Budget Manager
 * Monitors spending and triggers degradation modes appropriately.
 */
class BudgetManager {
  private config: BudgetConfig = {
    dailyGlobalLimit: 15.00, // $15 per day
    perSessionLimit: 0.75, // $0.75 per session
    softThreshold: 0.7, // Start degradation at 70% of budget
  };

  checkBudget(): { canProceed: boolean, degradationMode: 'NORMAL' | 'AGGRESSIVE' | 'CRITICAL' } {
    const metrics = platformCost.getMetrics();
    
    // 1. Critical Hard Block
    if (metrics.totalCost >= this.config.dailyGlobalLimit) {
      console.error('[BUDGET] Global Daily Limit reached! Blocking non-essential calls.');
      return { canProceed: false, degradationMode: 'CRITICAL' };
    }

    if (metrics.sessionCost >= this.config.perSessionLimit) {
      console.warn('[BUDGET] Session limit hit. Forcing local heuristics.');
      return { canProceed: true, degradationMode: 'CRITICAL' };
    }

    // 2. Soft Threshold Degradation
    const globalUsage = metrics.totalCost / this.config.dailyGlobalLimit;
    const sessionUsage = metrics.sessionCost / this.config.perSessionLimit;

    if (globalUsage > this.config.softThreshold || sessionUsage > this.config.softThreshold) {
      return { canProceed: true, degradationMode: 'AGGRESSIVE' };
    }

    return { canProceed: true, degradationMode: 'NORMAL' };
  }

  getBudgetStatus() {
    const metrics = platformCost.getMetrics();
    return {
      dailyUsage: metrics.totalCost,
      dailyLimit: this.config.dailyGlobalLimit,
      sessionUsage: metrics.sessionCost,
      sessionLimit: this.config.perSessionLimit
    };
  }
}

export const budgetManager = new BudgetManager();

import { Preferences } from '@capacitor/preferences';

export type ApiService = 'google-directions' | 'google-matrix' | 'google-geocode' | 'mapbox-directions' | 'mapbox-matrix' | 'mapbox-search';

const PRICING: Record<ApiService, number> = {
  'google-directions': 0.005,      // $5 per 1000
  'google-matrix': 0.005,          // $5 per 1000 elements
  'google-geocode': 0.005,         // $5 per 1000
  'mapbox-directions': 0.00075,    // $0.75 per 1000
  'mapbox-search': 0.00075,        // $0.75 per 1000
  'mapbox-matrix': 0.001           // $1.00 per 1000 elements
};

export interface CostMetrics {
  totalCost: number;
  sessionCost: number;
  counts: Record<ApiService, number>;
}

/**
 * Platform Cost Engine
 * Tracks the actual financial cost of mapping APIs.
 */
class PlatformCostEngine {
  private metrics: CostMetrics = {
    totalCost: 0,
    sessionCost: 0,
    counts: {
      'google-directions': 0,
      'google-matrix': 0,
      'google-geocode': 0,
      'mapbox-directions': 0,
      'mapbox-search': 0,
      'mapbox-matrix': 0,
    }
  };

  constructor() {
    this.loadTotalCost();
  }

  private async loadTotalCost() {
    try {
      const { value } = await Preferences.get({ key: 'platform_total_cost' });
      if (value) {
        this.metrics.totalCost = parseFloat(value);
      }
    } catch (e) {
      console.warn('Failed to load platform cost', e);
    }
  }

  trackCall(service: ApiService, count: number = 1) {
    const cost = PRICING[service] * count;
    this.metrics.counts[service] += count;
    this.metrics.sessionCost += cost;
    this.metrics.totalCost += cost;
    
    // Non-blocking save
    Preferences.set({ key: 'platform_total_cost', value: this.metrics.totalCost.toString() });
    
    if (cost > 0.05) { // Warn on expensive single calls (e.g. large matrix)
      console.warn(`[PLATFORM COST] High cost call: ${service} cost $${cost.toFixed(4)}`);
    }
  }

  getMetrics(): CostMetrics {
    return { ...this.metrics };
  }

  resetSession() {
    this.metrics.sessionCost = 0;
  }
}

export const platformCost = new PlatformCostEngine();

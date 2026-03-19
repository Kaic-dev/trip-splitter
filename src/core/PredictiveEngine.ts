import { budgetManager } from './BudgetManager';
import { globalRateLimiter } from './rateLimiter';
import type { MapProvider } from '../providers/MapProvider';

/**
 * Enterprise Predictive Engine
 * Analyzes patterns and pre-caches likely future requests.
 */
class PredictiveEngine {
  private patterns = new Map<string, number>();
  private provider?: MapProvider;

  setProvider(provider: MapProvider) {
    this.provider = provider;
  }

  /**
   * Track a successful search to learn user patterns.
   */
  trackSearch(query: string) {
    const count = this.patterns.get(query) || 0;
    this.patterns.set(query, count + 1);
  }

  /**
   * Background Prefetch
   * Triggered when app is idle and budget allows.
   */
  async prefetchFrequent() {
    if (!this.provider) return;
    
    const { degradationMode } = budgetManager.checkBudget();
    if (degradationMode !== 'NORMAL') return;

    // Get top 3 frequent searches
    const top = Array.from(this.patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [query] of top) {
      // Logic adjusted to match CacheManager API (using getOrFetch as a check is complex, so we check metrics or internal state if exposed)
      if (globalRateLimiter.getQueueLength() === 0) {
        console.log(`[Predictive] Pre-fetching frequent location: ${query}`);
        // Use LOW priority for background pre-fetching
        await this.provider.searchLocation(query, 'predictive-session');
      }
    }
  }
}

export const predictiveEngine = new PredictiveEngine();

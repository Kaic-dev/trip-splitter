import { Preferences } from '@capacitor/preferences';
import { createLogger } from './logger';

const logger = createLogger('Cache');

const CACHE_VERSION = 'v2'; 

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  coalesced: number;
  errors: number;
  staleHits: number;
}

export type CacheStatus = 'fresh' | 'stale' | 'approximate' | 'miss';

export interface CacheResult<T> {
  data: T;
  status: CacheStatus;
}

/**
 * Production-grade Cache Manager with Persistence, TTL, Coalescing, and Stale-While-Revalidate support.
 */
export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private pending = new Map<string, Promise<T>>();
  private metrics: CacheMetrics = { hits: 0, misses: 0, coalesced: 0, errors: 0, staleHits: 0 };
  private name: string;
  private ttlMs: number;
  private persistent: boolean;

  constructor(
    name: string,
    ttlMs: number,
    persistent: boolean = false
  ) {
    this.name = name;
    this.ttlMs = ttlMs;
    this.persistent = persistent;
    
    if (this.persistent) {
      this.loadFromStorage();
    }
  }

  private async loadFromStorage() {
    try {
      const { value } = await Preferences.get({ key: `cache_${this.name.toLowerCase()}` });
      if (value) {
        const data = JSON.parse(value);
        Object.entries(data).forEach(([key, entry]: [string, any]) => {
          if (entry.version === CACHE_VERSION && (Date.now() - entry.timestamp) < this.ttlMs) {
            this.cache.set(key, entry);
          }
        });
        logger.debug(`[${this.name}] Loaded ${this.cache.size} persisted entries.`);
      }
    } catch (err) {
      logger.warn(`[${this.name}] Failed to load from storage`, err);
    }
  }

  private async saveToStorage() {
    if (!this.persistent) return;
    try {
      const data: Record<string, CacheEntry<T>> = {};
      this.cache.forEach((entry, key) => {
        if ((Date.now() - entry.timestamp) < this.ttlMs) {
          data[key] = entry;
        }
      });
      await Preferences.set({
        key: `cache_${this.name.toLowerCase()}`,
        value: JSON.stringify(data),
      });
    } catch (err) {
      logger.warn(`[${this.name}] Failed to save to storage`, err);
    }
  }

  async getOrFetch(key: string, fetchFn: () => Promise<T>, options?: { forceRefresh?: boolean; allowStaleOnError?: boolean; onStatus?: (status: 'HIT' | 'MISS' | 'COALESCED') => void }): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    // 1. Valid Cache Hit
    if (entry && !options?.forceRefresh && (now - entry.timestamp) < this.ttlMs) {
      this.metrics.hits++;
      options?.onStatus?.('HIT');
      logger.success(`HIT [${this.name}]: ${key.substring(0, 40)}...`, { source: 'MEMORY', age: `${Math.round((now - entry.timestamp)/1000)}s` });
      return entry.data;
    }

    // 2. Coalescing (In-flight request)
    const inFlight = this.pending.get(key);
    if (inFlight) {
      this.metrics.coalesced++;
      options?.onStatus?.('COALESCED');
      logger.info(`COALESCED [${this.name}]: ${key.substring(0, 40)}...`, { status: 'PENDING_REQUEST' });
      return inFlight;
    }

    // 3. Cache Miss / Fresh Fetch
    this.metrics.misses++;
    options?.onStatus?.('MISS');
    logger.info(`MISS [${this.name}]: ${key.substring(0, 40)}...`, { status: 'FETCHING_NEW' });

    const promise = fetchFn()
      .then(async (data) => {
        this.cache.set(key, { data, timestamp: Date.now(), version: CACHE_VERSION });
        this.pending.delete(key);
        if (this.persistent) await this.saveToStorage();
        return data;
      })
      .catch((err) => {
        this.pending.delete(key);
        this.metrics.errors++;
        
        // [RESILIENCE] If fetch fails, try to return STALE data if allowed
        if (entry && options?.allowStaleOnError !== false) {
          this.metrics.staleHits++;
          logger.warn(`STALE FALLBACK [${this.name}]: API Error, using stale for ${key.substring(0, 20)}`, err);
          return entry.data;
        }
        
        logger.error(`FETCH ERROR [${this.name}]`, err);
        throw err;
      });

    this.pending.set(key, promise);
    return promise;
  }

  getMetrics() {
    return { ...this.metrics, size: this.cache.size };
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
    if (this.persistent) Preferences.remove({ key: `cache_${this.name.toLowerCase()}` });
  }
}

// Instantiate specific caches with differentiated persistence and TTLs
export const searchCache = new CacheManager<any>('Search', 15 * 60 * 1000, true); // 15m persistent
export const routeCache = new CacheManager<any>('Route', 10 * 60 * 1000, false); // 10m in-memory (traffic changes)
export const matrixCache = new CacheManager<any>('Matrix', 60 * 60 * 1000, true); // 1h persistent
export const geocodingCache = new CacheManager<any>('Geocoding', 24 * 60 * 60 * 1000 * 7, true); // 7d persistent

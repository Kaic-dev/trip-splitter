export const RequestPriority = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3
} as const;

export type RequestPriorityType = (typeof RequestPriority)[keyof typeof RequestPriority];

interface RequestTask<T> {
  id: string;
  fn: () => Promise<T>;
  priority: RequestPriorityType;
  resolve: (val: T) => void;
  reject: (err: any) => void;
  retries: number;
  timestamp: number;
}

/**
 * Enterprise-grade Adaptive Rate Limiter with Priority Scoring.
 * Ensures critical user actions are prioritized and handles bursts with token bucket.
 */
export class AdaptiveRateLimiter {
  private queue: RequestTask<any>[] = [];
  private tokens: number;
  private maxTokens: number;
  private lastRefill: number;
  private refillRate: number; // tokens per ms
  private processing: boolean = false;

  constructor(maxTokens: number = 20, refillRatePerSec: number = 4) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerSec / 1000;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async enqueue<T>(fn: () => Promise<T>, priority: RequestPriorityType = RequestPriority.MEDIUM): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: RequestTask<T> = {
        id: Math.random().toString(36).substring(7),
        fn,
        priority,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now()
      };

      this.queue.push(task);
      // Sort by priority (desc) then by timestamp (asc)
      this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.refill();

    if (this.tokens < 1) {
      const waitMs = (1 - this.tokens) / this.refillRate;
      setTimeout(() => this.processQueue(), Math.min(waitMs, 500));
      return;
    }

    this.processing = true;
    const task = this.queue.shift()!;
    this.tokens -= 1;

    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (err: any) {
      if (task.retries < 2 && (err.status === 429 || err.status >= 500)) {
        task.retries++;
        console.warn(`[RateLimiter] Retrying task ${task.id} (Attempt ${task.retries})`);
        setTimeout(() => {
          this.queue.push(task);
          this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
          this.processQueue();
        }, Math.pow(2, task.retries) * 1000);
      } else {
        task.reject(err);
      }
    } finally {
      this.processing = false;
      this.processQueue();
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  adapt(multiplier: number) {
    this.refillRate *= multiplier;
    this.maxTokens = Math.max(1, Math.round(this.maxTokens * multiplier));
    console.log(`[RateLimiter] [ADAPTIVE] Adjustment: ${multiplier}x | Refill: ${(this.refillRate * 1000).toFixed(2)}/s`);
  }
}

export const globalRateLimiter = new AdaptiveRateLimiter(20, 4);

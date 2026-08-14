/**
 * Token-bucket rate limiter. Each provider route owns one limiter instance
 * with its own rate; `take()` resolves when a token is available or the
 * wait is aborted. Prevents self-inflicted 429s on burst batches.
 */
import { TakeError } from '../errors.js';

export interface RateLimiterOptions {
  /** Tokens added per second. */
  ratePerSecond: number;
  /** Maximum burst size. */
  burst?: number;
}

export class TokenBucket {
  private readonly ratePerSecond: number;
  private readonly capacity: number;
  private tokens: number;
  private lastRefill: number;
  private waiters: Array<{ resolve: () => void; reject: (err: unknown) => void; signal?: AbortSignal }> = [];

  constructor(options: RateLimiterOptions) {
    if (options.ratePerSecond <= 0) throw new Error('ratePerSecond must be positive');
    this.ratePerSecond = options.ratePerSecond;
    this.capacity = Math.max(options.burst ?? options.ratePerSecond, 1);
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.ratePerSecond);
    this.lastRefill = now;
  }

  /**
   * Wait until a token is available. Rejects with ABORTED when the signal
   * fires before admission.
   */
  async take(signal?: AbortSignal): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Drain waiters as tokens accumulate.
    await new Promise<void>((resolve, reject) => {
      const waiter: { resolve: () => void; reject: (err: unknown) => void; signal?: AbortSignal } = { resolve, reject };
      if (signal !== undefined) waiter.signal = signal;
      this.waiters.push(waiter);
      if (signal?.aborted) {
        this.drainWaiter(waiter, new TakeError({ code: 'ABORTED', message: 'rate limiter aborted' }));
        return;
      }
      signal?.addEventListener(
        'abort',
        () => {
          this.drainWaiter(waiter, new TakeError({ code: 'ABORTED', message: 'rate limiter aborted' }));
        },
        { once: true },
      );
      this.schedule();
    });
  }

  private schedule(): void {
    if (this.waiters.length === 0) return;
    this.refill();
    if (this.tokens < 1) {
      const waitMs = Math.ceil(((1 - this.tokens) / this.ratePerSecond) * 1000);
      setTimeout(() => this.schedule(), Math.min(waitMs, 100));
      return;
    }
    while (this.tokens >= 1 && this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      if (waiter === undefined) break;
      this.tokens -= 1;
      waiter.resolve();
    }
  }

  private drainWaiter(waiter: { resolve: () => void; reject: (err: unknown) => void }, err: unknown): void {
    const idx = this.waiters.indexOf(waiter);
    if (idx >= 0) this.waiters.splice(idx, 1);
    waiter.reject(err);
  }
}

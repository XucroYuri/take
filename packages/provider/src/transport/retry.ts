/**
 * Retry executor — a standalone layer driven by `RetryPolicy`.
 *
 * dsh-aligned separation: the policy is metadata captured at adapter
 * registration; the executor lives apart from the seam so retry behavior is
 * swappable and testable without touching adapters. Retries only apply to
 * `retryable` TakeErrors (rate limit, timeout, network); non-retryable
 * errors (bad credential, unsupported, quota) surface immediately.
 */
import { TakeError, isTakeError } from '../errors.js';
import type { RetryPolicy } from '../seam.js';

export interface RetryOptions {
  policy: RetryPolicy;
  /** Outer cancellation; aborts the whole attempt sequence. */
  signal?: AbortSignal;
  /** Optional per-attempt callback (observability). */
  onAttempt?: (attempt: { number: number; delayMs: number; error: unknown }) => void;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new TakeError({ code: 'ABORTED', message: 'retry sleep aborted' }));
    };
    if (signal?.aborted) {
      clearTimeout(timer);
      reject(new TakeError({ code: 'ABORTED', message: 'retry sleep aborted' }));
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Compute the delay for attempt `n` (0-based) with full jitter. */
export function backoffDelay(policy: RetryPolicy, attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined && retryAfterMs > 0) return retryAfterMs;
  const base = Math.min(policy.backoff.initialDelayMs * 2 ** attempt, policy.backoff.maxDelayMs);
  const jitter = base * policy.backoff.jitterRatio;
  return Math.max(0, base - jitter + Math.random() * jitter * 2);
}

/**
 * Run `fn` with the retry policy. The policy decides how many attempts are
 * allowed; the executor decides which errors are retryable. `fn` must be
 * idempotent — it may be called multiple times.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const { policy, signal } = options;
  let attempt = 0;
  while (true) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (signal?.aborted) {
        throw new TakeError({ code: 'ABORTED', message: 'retry aborted', cause: error });
      }
      const retryable = isTakeError(error) ? error.cls === 'retryable' : true;
      if (!retryable) throw error;
      if (attempt >= policy.maxRetries) throw error;
      const retryAfterMs = isTakeError(error) ? error.retryAfterMs : undefined;
      const delayMs = backoffDelay(policy, attempt, retryAfterMs);
      options.onAttempt?.({ number: attempt + 1, delayMs, error });
      await sleep(delayMs, signal);
      attempt += 1;
    }
  }
}

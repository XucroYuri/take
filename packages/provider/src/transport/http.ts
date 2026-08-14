/**
 * Production transport: timeout tiers, error classification (TakeError),
 * mandatory attribution header, optional retry and rate limiting.
 * No external HTTP dependency (Node 20+ global fetch).
 */
import { TakeError, classifyHttpError } from '../errors.js';
import type { RetryPolicy } from '../seam.js';
import type { TokenBucket } from './rate-limit.js';
import { withRetry } from './retry.js';

/** Public application identity for attribution headers (dsh-aligned). */
export const APP_IDENTITY = 'take/0.1.0';

export interface TransportOptions {
  /** Timeout for the initial connection + request head. */
  connectTimeoutMs?: number;
  /** Timeout for the whole request (including body read). */
  requestTimeoutMs?: number;
  headers?: Record<string, string>;
  /** Retry policy; omit to disable retries. */
  retryPolicy?: RetryPolicy;
  /** Per-route rate limiter; omit to disable. */
  rateLimiter?: TokenBucket;
  /** Outer cancellation. */
  signal?: AbortSignal;
  /** Attribution identity; default APP_IDENTITY. */
  appIdentity?: string;
}

export interface TransportResult<T> {
  data: T;
  /** HTTP status of the successful response. */
  status: number;
  /** Total wall time in ms. */
  latencyMs: number;
}

/** Build the mandatory attribution header (cannot be suppressed). */
export function attributionHeader(appIdentity?: string): Record<string, string> {
  return { 'user-agent': appIdentity ?? APP_IDENTITY };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  connectTimeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), connectTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * Typed JSON transport with retry, rate limiting, timeout tiers and error
 * classification. Throws TakeError with stable codes on failure.
 */
export async function transportJson<T>(
  url: string,
  init: RequestInit,
  options: TransportOptions = {},
): Promise<TransportResult<T>> {
  const { connectTimeoutMs = 15_000, requestTimeoutMs = 120_000, headers = {}, appIdentity, signal } = options;
  const startedAt = Date.now();
  const mergedHeaders = {
    'content-type': 'application/json',
    ...attributionHeader(appIdentity),
    ...headers,
  };

  const attempt = async (): Promise<T> => {
    if (options.rateLimiter) {
      await options.rateLimiter.take(signal);
    }
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener('abort', onOuterAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchWithTimeout(
        url,
        { ...init, headers: mergedHeaders },
        connectTimeoutMs,
        controller.signal,
      );
      const text = await response.text();
      if (!response.ok) {
        let retryAfterMs: number | undefined;
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter !== null && /^\d+$/.test(retryAfter)) {
          retryAfterMs = Number(retryAfter) * 1000;
        }
        throw classifyHttpError(response.status, text, retryAfterMs);
      }
      return (text ? JSON.parse(text) : {}) as T;
    } catch (error) {
      if (error instanceof TakeError) throw error;
      // Network-level failures (DNS, TLS, EOF, fetch abort) are retryable.
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('aborted') || message.includes('ABORTED')) {
        throw new TakeError({ code: 'ABORTED', message, cause: error });
      }
      throw new TakeError({ code: 'NETWORK', message, cause: error });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onOuterAbort);
    }
  };

  const data = options.retryPolicy
    ? await withRetry(attempt, {
        policy: options.retryPolicy,
        ...(signal !== undefined ? { signal } : {}),
      })
    : await attempt();

  return { data, status: 200, latencyMs: Date.now() - startedAt };
}

export { classifyHttpError };

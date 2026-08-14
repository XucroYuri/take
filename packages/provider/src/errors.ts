/**
 * take error taxonomy — stable codes + cause chain, aligned with dsh's
 * `LlmError` code semantics so a future take-dsh adapter layer maps codes
 * instead of rewriting semantics.
 *
 * Error classification drives routing: `retryable` errors may be retried
 * within a budget (rate limits, 5xx, timeouts, network); `non-retryable`
 * errors fail over immediately (400/401/404/unsupported); `fatal` errors
 * stop (misconfiguration, no adapter).
 */

export type TakeErrorCode =
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_CREDENTIAL'
  | 'MISSING_CREDENTIAL'
  | 'UNSUPPORTED'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'NO_ADAPTER'
  | 'DUPLICATE_ADAPTER'
  | 'EMPTY_RESPONSE'
  | 'CONTEXT_WINDOW_EXCEEDED'
  | 'NETWORK'
  | 'INTERNAL';

export type ErrorClass = 'retryable' | 'non-retryable' | 'fatal';

/** Which error classes the router may retry within a budget. */
export const RETRYABLE_CODES: ReadonlySet<TakeErrorCode> = new Set(['RATE_LIMIT', 'TIMEOUT', 'NETWORK']);

/**
 * Base error for every provider failure. `code` is stable and serializable
 * (route on it, never on `message`); `cause` chains the underlying error.
 */
export class TakeError extends Error {
  readonly code: TakeErrorCode;
  readonly cls: ErrorClass;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(options: {
    code: TakeErrorCode;
    message: string;
    cause?: unknown;
    status?: number;
    retryAfterMs?: number;
  }) {
    super(options.message);
    this.name = 'TakeError';
    this.code = options.code;
    this.cls = RETRYABLE_CODES.has(options.code) ? 'retryable' : 'non-retryable';
    if (options.status !== undefined) this.status = options.status;
    if (options.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs;
    if (options.cause !== undefined) {
      this.cause = options.cause instanceof Error ? options.cause : new Error(String(options.cause));
    }
  }
}

/** Narrow a thrown value to a TakeError with a stable code. */
export function isTakeError(value: unknown): value is TakeError {
  return value instanceof TakeError;
}

/** Render a thrown value with its full cause chain for diagnostics. */
export function errorChain(value: unknown): string {
  const parts: string[] = [];
  let current: unknown = value;
  const seen = new Set<unknown>();
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof TakeError) {
      parts.push(`${current.name}[${current.code}]: ${current.message}`);
    } else if (current instanceof Error) {
      parts.push(`${current.name}: ${current.message}`);
    } else {
      parts.push(String(current));
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join(' ⮐ ');
}

/** Classify an HTTP response into a TakeError. */
export function classifyHttpError(status: number, body: string, retryAfterMs?: number): TakeError {
  switch (status) {
    case 429: {
      const options: ConstructorParameters<typeof TakeError>[0] = {
        code: 'RATE_LIMIT',
        message: `rate limited (HTTP 429): ${body.slice(0, 200)}`,
        status,
      };
      if (retryAfterMs !== undefined) options.retryAfterMs = retryAfterMs;
      return new TakeError(options);
    }
    case 401:
      return new TakeError({
        code: 'INVALID_CREDENTIAL',
        message: `invalid credential (HTTP 401): ${body.slice(0, 200)}`,
        status,
      });
    case 402:
      return new TakeError({
        code: 'QUOTA_EXCEEDED',
        message: `quota exceeded (HTTP 402): ${body.slice(0, 200)}`,
        status,
      });
    case 403:
      return new TakeError({ code: 'QUOTA_EXCEEDED', message: `forbidden (HTTP 403): ${body.slice(0, 200)}`, status });
    case 404:
      return new TakeError({
        code: 'UNSUPPORTED',
        message: `model or endpoint not found (HTTP 404): ${body.slice(0, 200)}`,
        status,
      });
    case 400:
      return new TakeError({ code: 'UNSUPPORTED', message: `bad request (HTTP 400): ${body.slice(0, 200)}`, status });
    case 500:
    case 502:
    case 503:
    case 504:
      return new TakeError({
        code: 'NETWORK',
        message: `server error (HTTP ${status}): ${body.slice(0, 200)}`,
        status,
      });
    default:
      return new TakeError({ code: 'INTERNAL', message: `unexpected HTTP ${status}: ${body.slice(0, 200)}`, status });
  }
}

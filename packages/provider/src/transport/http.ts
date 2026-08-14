/**
 * Tiny typed HTTP helper. Providers use fetch (Node 20+); this adds timeouts,
 * JSON handling and error normalization. No external HTTP dependency.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

export interface HttpOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export async function httpJson<T>(url: string, init: RequestInit, options: HttpOptions = {}): Promise<T> {
  const { timeoutMs = 120_000, headers = {} } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json', ...headers },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status, text);
    }
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

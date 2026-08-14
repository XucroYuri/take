import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TakeError } from '../src/errors.js';
import type { RetryPolicy } from '../src/seam.js';
import { APP_IDENTITY, attributionHeader, transportJson } from '../src/transport/http.js';
import { TokenBucket } from '../src/transport/rate-limit.js';
import { backoffDelay, withRetry } from '../src/transport/retry.js';

const POLICY: RetryPolicy = {
  mode: 'normal',
  maxRetries: 2,
  backoff: { initialDelayMs: 10, maxDelayMs: 50, jitterRatio: 0 },
};

describe('transportJson against a live mock server', () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  let requestCount: number;
  const handlers: Array<(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void> =
    [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      requestCount += 1;
      const handler = handlers.shift();
      if (handler) {
        handler(req, res);
      } else {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'no handler' }));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    requestCount = 0;
    handlers.length = 0;
  });

  it('returns parsed JSON for a successful response', async () => {
    handlers.push((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, value: 42 }));
    });
    const { data, status } = await transportJson<{ ok: boolean; value: number }>(`${baseUrl}/ok`, { method: 'GET' });
    expect(data).toEqual({ ok: true, value: 42 });
    expect(status).toBe(200);
    expect(requestCount).toBe(1);
  });

  it('retries on 429 with Retry-After, then succeeds', async () => {
    handlers.push(
      (_req, res) => {
        res.writeHead(429, { 'retry-after': '0' });
        res.end('slow down');
      },
      (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      },
    );
    const { data } = await transportJson<{ ok: boolean }>(
      `${baseUrl}/ratelimit`,
      { method: 'GET' },
      { retryPolicy: POLICY },
    );
    expect(data.ok).toBe(true);
    expect(requestCount).toBe(2);
  });

  it('exhausts the budget when the server keeps failing', async () => {
    handlers.push(
      (_req, res) => {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end('unavailable');
      },
      (_req, res) => {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end('unavailable');
      },
      (_req, res) => {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end('unavailable');
      },
    );
    await expect(transportJson(`${baseUrl}/down`, { method: 'GET' }, { retryPolicy: POLICY })).rejects.toBeInstanceOf(
      TakeError,
    );
    expect(requestCount).toBe(3);
  });

  it('does not retry non-retryable errors (401)', async () => {
    handlers.push((_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('bad key');
    });
    await expect(transportJson(`${baseUrl}/auth`, { method: 'GET' }, { retryPolicy: POLICY })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIAL',
    });
    expect(requestCount).toBe(1);
  });

  it('classifies provider error codes', async () => {
    handlers.push((_req, res) => {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('no model');
    });
    await expect(transportJson(`${baseUrl}/missing`, { method: 'GET' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });

  it('sends the attribution user-agent header', async () => {
    let seen: string | undefined;
    handlers.push((req, res) => {
      seen = req.headers['user-agent'];
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    await transportJson(`${baseUrl}/ua`, { method: 'GET' });
    expect(seen).toBe(APP_IDENTITY);
    expect(attributionHeader()['user-agent']).toBe(APP_IDENTITY);
  });

  it('maps fetch network failures to NETWORK TakeError', async () => {
    await expect(
      transportJson('http://127.0.0.1:1/nope', { method: 'GET' }, { connectTimeoutMs: 2000 }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('withRetry', () => {
  it('respects retryable vs non-retryable errors', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new TakeError({ code: 'RATE_LIMIT', message: 'x' });
        return 'ok';
      },
      { policy: POLICY },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('surfaces non-retryable errors immediately', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new TakeError({ code: 'INVALID_CREDENTIAL', message: 'x' });
        },
        { policy: POLICY },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIAL' });
    expect(calls).toBe(1);
  });

  it('honors Retry-After when provided', async () => {
    let calls = 0;
    const delays: number[] = [];
    await withRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new TakeError({ code: 'RATE_LIMIT', message: 'x', retryAfterMs: 25 });
        return 'ok';
      },
      {
        policy: POLICY,
        onAttempt: ({ delayMs }) => {
          delays.push(delayMs);
        },
      },
    );
    expect(delays[0]).toBe(25);
  });
});

describe('backoffDelay', () => {
  it('grows exponentially with a cap', () => {
    const policy: RetryPolicy = {
      mode: 'normal',
      maxRetries: 5,
      backoff: { initialDelayMs: 100, maxDelayMs: 1000, jitterRatio: 0 },
    };
    expect(backoffDelay(policy, 0)).toBe(100);
    expect(backoffDelay(policy, 1)).toBe(200);
    expect(backoffDelay(policy, 2)).toBe(400);
    expect(backoffDelay(policy, 3)).toBe(800);
    expect(backoffDelay(policy, 4)).toBe(1000); // capped
  });
});

describe('TokenBucket', () => {
  it('allows bursts up to capacity', async () => {
    const bucket = new TokenBucket({ ratePerSecond: 1000, burst: 3 });
    await bucket.take();
    await bucket.take();
    await bucket.take();
    // Fourth take must wait for refill — with rate 1000/s this is fast.
    await bucket.take();
  });

  it('rejects with ABORTED when the signal fires', async () => {
    const bucket = new TokenBucket({ ratePerSecond: 0.0001, burst: 1 });
    await bucket.take(); // consume the only token
    const controller = new AbortController();
    controller.abort();
    await expect(bucket.take(controller.signal)).rejects.toMatchObject({ code: 'ABORTED' });
  });
});

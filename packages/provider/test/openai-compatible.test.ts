import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OpenAiCompatibleAdapter } from '../src/adapters/openai-compatible.js';

describe('OpenAiCompatibleAdapter against a live mock server', () => {
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

  function makeAdapter(kind: 'image' | 'video' | readonly ['image', 'video']): OpenAiCompatibleAdapter {
    return new OpenAiCompatibleAdapter({
      provider: 'test-vendor',
      kind,
      baseUrl,
      apiKey: 'test-key',
      model: 'test-model',
      pollIntervalMs: 10,
      maxPolls: 10,
    });
  }

  it('generates images from a synchronous response', async () => {
    handlers.push((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ url: 'https://cdn.test/img.png' }] }));
    });
    const adapter = makeAdapter('image');
    const result = await adapter.generateImage({ prompt: 'a cat' });
    expect(result.url).toBe('https://cdn.test/img.png');
    expect(result.contentType).toBe('image/png');
    expect(requestCount).toBe(1);
  });

  it('throws EMPTY_RESPONSE when no image url is returned', async () => {
    handlers.push((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [] }));
    });
    const adapter = makeAdapter('image');
    await expect(adapter.generateImage({ prompt: 'x' })).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });

  it('auto-detects synchronous video responses', async () => {
    handlers.push((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'sync-1', data: [{ url: 'https://cdn.test/v.mp4' }] }));
    });
    const adapter = makeAdapter('video');
    const job = await adapter.generateVideo({ prompt: 'a pan' });
    expect(job.status).toBe('done');
    expect(job.url).toBe('https://cdn.test/v.mp4');
    expect(requestCount).toBe(1);
  });

  it('auto-detects async job responses and polls until done', async () => {
    handlers.push(
      (_req, res) => {
        // create → job id, no url
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'job-1' }));
      },
      (_req, res) => {
        // poll 1 → running
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'running' }));
      },
      (_req, res) => {
        // poll 2 → done with url
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'succeeded', output: { video_url: 'https://cdn.test/final.mp4' } }));
      },
    );
    const adapter = makeAdapter('video');
    const job = await adapter.generateVideo({ prompt: 'a pan' });
    expect(job.status).toBe('done');
    expect(job.url).toBe('https://cdn.test/final.mp4');
    expect(requestCount).toBe(3);
  });

  it('throws EMPTY_RESPONSE when the create response has neither url nor id', async () => {
    handlers.push((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({}));
    });
    const adapter = makeAdapter('video');
    await expect(adapter.generateVideo({ prompt: 'x' })).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });

  it('surfaces provider in-band errors with INTERNAL code', async () => {
    handlers.push((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'model overloaded' } }));
    });
    const adapter = makeAdapter('video');
    await expect(adapter.generateVideo({ prompt: 'x' })).rejects.toMatchObject({
      code: 'INTERNAL',
      message: expect.stringContaining('model overloaded'),
    });
  });

  it('throws MISSING_CREDENTIAL without an api key', () => {
    expect(
      () =>
        new OpenAiCompatibleAdapter({
          provider: 'x',
          kind: 'image',
          baseUrl,
          apiKey: '',
          model: 'm',
        }),
    ).toThrowError(expect.objectContaining({ code: 'MISSING_CREDENTIAL' }));
  });

  it('includes duration and aspect ratio in the video request body', async () => {
    let seenBody = '';
    handlers.push((req, res) => {
      req.on('data', (chunk: Buffer) => {
        seenBody += chunk.toString('utf8');
      });
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        // Return a synchronous url so no polling happens.
        res.end(JSON.stringify({ id: 'sync-body', data: [{ url: 'https://cdn.test/b.mp4' }] }));
      });
    });
    const adapter = makeAdapter('video');
    const job = await adapter.generateVideo({ prompt: 'x', durationSec: 5, aspectRatio: '9:16' });
    expect(job.status).toBe('done');
    const body = JSON.parse(seenBody) as { model: string; duration: number; aspect_ratio: string };
    expect(body.model).toBe('test-model');
    expect(body.duration).toBe(5);
    expect(body.aspect_ratio).toBe('9:16');
  });
});

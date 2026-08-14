import { describe, expect, it } from 'vitest';
import { MockProvider } from '../src/adapters/mock.js';
import { TakeError, classifyHttpError, errorChain, isTakeError } from '../src/errors.js';
import { ProviderSeam } from '../src/seam.js';

describe('TakeError taxonomy', () => {
  it('classifies retryable codes', () => {
    expect(new TakeError({ code: 'RATE_LIMIT', message: 'x' }).cls).toBe('retryable');
    expect(new TakeError({ code: 'TIMEOUT', message: 'x' }).cls).toBe('retryable');
    expect(new TakeError({ code: 'NETWORK', message: 'x' }).cls).toBe('retryable');
  });

  it('classifies non-retryable codes', () => {
    expect(new TakeError({ code: 'INVALID_CREDENTIAL', message: 'x' }).cls).toBe('non-retryable');
    expect(new TakeError({ code: 'UNSUPPORTED', message: 'x' }).cls).toBe('non-retryable');
    expect(new TakeError({ code: 'QUOTA_EXCEEDED', message: 'x' }).cls).toBe('non-retryable');
  });

  it('chains causes and renders the full chain', () => {
    const inner = new Error('ECONNREFUSED');
    const outer = new TakeError({ code: 'NETWORK', message: 'fetch failed', cause: inner });
    expect(isTakeError(outer)).toBe(true);
    expect(errorChain(outer)).toContain('ECONNREFUSED');
    expect(errorChain(outer)).toContain('NETWORK');
  });

  it('classifies HTTP statuses', () => {
    expect(classifyHttpError(429, 'slow down').code).toBe('RATE_LIMIT');
    expect(classifyHttpError(429, 'slow down', 5000).retryAfterMs).toBe(5000);
    expect(classifyHttpError(401, 'bad key').code).toBe('INVALID_CREDENTIAL');
    expect(classifyHttpError(402, 'no money').code).toBe('QUOTA_EXCEEDED');
    expect(classifyHttpError(404, 'no model').code).toBe('UNSUPPORTED');
    expect(classifyHttpError(503, 'unavailable').code).toBe('NETWORK');
    expect(classifyHttpError(500, 'boom').cls).toBe('retryable');
    expect(classifyHttpError(401, 'nope').cls).toBe('non-retryable');
  });
});

describe('ProviderSeam', () => {
  it('registers and lists providers', () => {
    const seam = new ProviderSeam();
    const adapter = new MockProvider({ provider: 'mock', kind: ['image', 'video'] });
    seam.registerAdapter(['mock'], adapter);
    expect(seam.listProviders()).toHaveLength(1);
    expect(seam.has('mock')).toBe(true);
    expect(seam.get('mock')).toBe(adapter);
  });

  it('throws DUPLICATE_ADAPTER on route collision', () => {
    const seam = new ProviderSeam();
    seam.registerAdapter(['dup'], new MockProvider({ provider: 'a', kind: 'image' }));
    expect(() => seam.registerAdapter(['dup'], new MockProvider({ provider: 'b', kind: 'image' }))).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_ADAPTER' }),
    );
  });

  it('throws NO_ADAPTER for unknown routes', () => {
    const seam = new ProviderSeam();
    expect(() => seam.get('ghost')).toThrowError(expect.objectContaining({ code: 'NO_ADAPTER' }));
  });

  it('disposer unregisters only its own routes', () => {
    const seam = new ProviderSeam();
    const a = new MockProvider({ provider: 'a', kind: 'image' });
    const b = new MockProvider({ provider: 'b', kind: 'image' });
    seam.registerAdapter(['a'], a);
    const disposeB = seam.registerAdapter(['b'], b);
    disposeB();
    expect(seam.has('a')).toBe(true);
    expect(seam.has('b')).toBe(false);
  });

  it('route registration is all-or-nothing', () => {
    const seam = new ProviderSeam();
    seam.registerAdapter(['existing'], new MockProvider({ provider: 'x', kind: 'image' }));
    expect(() =>
      seam.registerAdapter(['new', 'existing'], new MockProvider({ provider: 'y', kind: 'image' })),
    ).toThrowError(expect.objectContaining({ code: 'DUPLICATE_ADAPTER' }));
    // Neither route may have been registered.
    expect(seam.has('new')).toBe(false);
  });
});

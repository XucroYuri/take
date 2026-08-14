import { describe, expect, it } from 'vitest';
import { FailingProvider, MockProvider } from '../src/adapters/mock.js';
import { CapabilityRegistry } from '../src/capabilities.js';
import { ProviderRouter } from '../src/router.js';

describe('CapabilityRegistry', () => {
  const registry = new CapabilityRegistry();

  it('resolves builtin model metadata', () => {
    const seedance25 = registry.resolve('seedance', 'seedance-2.5');
    expect(seedance25?.videoDuration).toEqual([5, 10]);
    expect(seedance25?.aspectRatios).toEqual(['16:9', '9:16', '1:1']);
    expect(registry.resolve('gpt-image', 'gpt-image-2')?.imageSizes).toContain('1536x1024');
  });

  it('returns undefined for unknown models (capacity preserved, no whitelist)', () => {
    expect(registry.resolve('seedance', 'seedance-99')).toBeUndefined();
    expect(registry.resolve('unknown-vendor', 'model-x')).toBeUndefined();
  });

  it('validates declared video dimensions only', () => {
    const issues = registry.validateVideo('seedance', 'seedance-2.5', { durationSec: 20 });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('durationSec');
    expect(registry.validateVideo('seedance', 'seedance-2.5', { durationSec: 5, aspectRatio: '9:16' })).toEqual([]);
  });

  it('rejects unsupported aspect ratios and resolutions', () => {
    const issues = registry.validateVideo('minimax', 'minimax-h3', { aspectRatio: '4:3', resolution: '4k' });
    expect(issues.map((i) => i.field).sort()).toEqual(['aspectRatio', 'resolution']);
  });

  it('validates image sizes', () => {
    expect(registry.validateImage('gpt-image', 'gpt-image-2', { size: '1024x1024' })).toEqual([]);
    const issues = registry.validateImage('gpt-image', 'gpt-image-2', { size: '800x600' });
    expect(issues).toHaveLength(1);
  });

  it('passes unknown models without issues', () => {
    expect(registry.validateVideo('seedance', 'seedance-99', { durationSec: 99 })).toEqual([]);
  });

  it('register is effect-based (disposer removes)', () => {
    const local = new CapabilityRegistry();
    const dispose = local.register({ provider: 'custom', model: 'm1', videoDuration: [3] });
    expect(local.resolve('custom', 'm1')?.videoDuration).toEqual([3]);
    dispose();
    expect(local.resolve('custom', 'm1')).toBeUndefined();
  });

  it('renders issues as UNSUPPORTED TakeError', () => {
    const issues = registry.validateVideo('seedance', 'seedance-2.5', { durationSec: 30 });
    const error = registry.toError('seedance', 'seedance-2.5', issues);
    expect(error.code).toBe('UNSUPPORTED');
    expect(error.message).toContain('durationSec=30');
  });
});

describe('ProviderRouter capability-aware routing', () => {
  it('skips a provider whose model cannot honor the request', async () => {
    const registry = new CapabilityRegistry();
    // seedance-2.5 only supports 5/10s; request asks for 20s.
    const primary = new MockProvider({ provider: 'seedance', kind: 'video', model: 'seedance-2.5' });
    const fallback = new MockProvider({ provider: 'minimax', kind: 'video', model: 'minimax-h3' });
    const router = new ProviderRouter({
      video: { primary, fallbacks: [fallback] },
      capabilities: registry,
    });
    const { provider, attempts } = await router.generateVideo({ prompt: 'x', durationSec: 5 });
    expect(provider).toBe('seedance');
    expect(attempts[0]?.outcome).toBe('ok');
  });

  it('routes to the fallback when the primary model lacks the capability', async () => {
    const registry = new CapabilityRegistry();
    // primary seedance-2.0 does not support 4:3; fallback mock has unknown model → passes.
    const primary = new MockProvider({ provider: 'seedance', kind: 'video', model: 'seedance-2.0' });
    const fallback = new MockProvider({ provider: 'backup', kind: 'video', model: 'custom-model' });
    const router = new ProviderRouter({
      video: { primary, fallbacks: [fallback] },
      capabilities: registry,
    });
    const { provider, attempts } = await router.generateVideo({ prompt: 'x', aspectRatio: '4:3' });
    expect(provider).toBe('backup');
    expect(attempts[0]).toMatchObject({ outcome: 'skipped-capability' });
    expect(attempts[1]?.outcome).toBe('ok');
  });

  it('throws UNSUPPORTED when every provider is skipped by capability', async () => {
    const registry = new CapabilityRegistry();
    const primary = new MockProvider({ provider: 'seedance', kind: 'video', model: 'seedance-2.0' });
    const fallback = new MockProvider({ provider: 'minimax', kind: 'video', model: 'minimax-h3' });
    const router = new ProviderRouter({
      video: { primary, fallbacks: [fallback] },
      capabilities: registry,
    });
    await expect(router.generateVideo({ prompt: 'x', aspectRatio: '21:9' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });

  it('does not validate when capabilities are not configured', async () => {
    const primary = new MockProvider({ provider: 'seedance', kind: 'video', model: 'seedance-2.0' });
    const router = new ProviderRouter({ video: { primary } });
    const { provider } = await router.generateVideo({ prompt: 'x', aspectRatio: '21:9' });
    expect(provider).toBe('seedance');
  });

  it('still fails over on execution errors after capability pass', async () => {
    const registry = new CapabilityRegistry();
    const primary = new FailingProvider({ provider: 'seedance', kind: 'video', model: 'seedance-2.0' });
    const fallback = new MockProvider({ provider: 'minimax', kind: 'video', model: 'minimax-h3' });
    const router = new ProviderRouter({
      video: { primary, fallbacks: [fallback] },
      capabilities: registry,
    });
    const { provider, attempts } = await router.generateVideo({ prompt: 'x', durationSec: 5 });
    expect(provider).toBe('minimax');
    expect(attempts[0]?.outcome).toBe('error');
    expect(attempts[1]?.outcome).toBe('ok');
  });
});

import { describe, expect, it } from 'vitest';
import { FailingProvider, MockProvider, ProviderRouter } from '../src/index.js';

describe('ProviderRouter image failover', () => {
  it('uses the primary when it succeeds', async () => {
    const primary = new MockProvider({ provider: 'primary', kind: 'image' });
    const fallback = new MockProvider({ provider: 'fallback', kind: 'image' });
    const router = new ProviderRouter({
      image: { primary, fallbacks: [fallback] },
    });
    const { provider, result } = await router.generateImage({ prompt: 'a cat' });
    expect(provider).toBe('primary');
    expect(result.url).toContain('mock://image/');
  });

  it('fails over when the primary throws', async () => {
    const primary = new FailingProvider({ provider: 'primary', kind: 'image' });
    const fallback = new MockProvider({ provider: 'fallback', kind: 'image' });
    const router = new ProviderRouter({
      image: { primary, fallbacks: [fallback] },
    });
    const { provider } = await router.generateImage({ prompt: 'a dog' });
    expect(provider).toBe('fallback');
  });

  it('throws when every provider fails', async () => {
    const primary = new FailingProvider({ provider: 'primary', kind: 'image' });
    const fallback = new FailingProvider({ provider: 'fallback', kind: 'image' });
    const router = new ProviderRouter({
      image: { primary, fallbacks: [fallback] },
    });
    await expect(router.generateImage({ prompt: 'x' })).rejects.toThrow(/all image providers failed/);
  });

  it('throws when no image provider is configured', async () => {
    const router = new ProviderRouter({});
    await expect(router.generateImage({ prompt: 'x' })).rejects.toThrow(/no image provider configured/);
  });
});

describe('ProviderRouter video failover', () => {
  it('routes to the video-capable provider', async () => {
    const video = new MockProvider({ provider: 'seedance', kind: 'video' });
    const router = new ProviderRouter({ video: { primary: video } });
    const { provider, result } = await router.generateVideo({ prompt: 'pan across the room' });
    expect(provider).toBe('seedance');
    expect(result.status).toBe('done');
  });

  it('fails over video to the fallback', async () => {
    const primary = new FailingProvider({ provider: 'seedance', kind: 'video' });
    const fallback = new MockProvider({ provider: 'minimax', kind: 'video' });
    const router = new ProviderRouter({ video: { primary, fallbacks: [fallback] } });
    const { provider } = await router.generateVideo({ prompt: 'tracking shot' });
    expect(provider).toBe('minimax');
  });

  it('ignores image-only providers in the video chain', async () => {
    const imageOnly = new MockProvider({ provider: 'gpt-image', kind: 'image' });
    const video = new MockProvider({ provider: 'seedance', kind: 'video' });
    const router = new ProviderRouter({ video: { primary: imageOnly, fallbacks: [video] } });
    const { provider } = await router.generateVideo({ prompt: 'x' });
    expect(provider).toBe('seedance');
  });
});

describe('ProviderRouter health', () => {
  it('reports health across all configured providers', async () => {
    const image = new MockProvider({ provider: 'gpt-image', kind: 'image' });
    const video = new MockProvider({ provider: 'seedance', kind: 'video' });
    const fallback = new MockProvider({ provider: 'minimax', kind: 'video' });
    const router = new ProviderRouter({
      image: { primary: image },
      video: { primary: video, fallbacks: [fallback] },
    });
    const health = await router.health();
    expect(health).toHaveLength(3);
    expect(health.every((h) => h.ok)).toBe(true);
  });
});

describe('MockProvider determinism', () => {
  it('produces stable mock urls from prompts', async () => {
    const mock = new MockProvider({ provider: 'mock', kind: ['image', 'video'] });
    const img = await mock.generateImage({ prompt: 'stable prompt' });
    const vid = await mock.generateVideo({ prompt: 'stable prompt' });
    expect(img.url).toBe('mock://image/stable%20prompt.png');
    expect(vid.url).toBe('mock://video/stable%20prompt.mp4');
  });

  it('does not leak provider kind constraints', async () => {
    const videoOnly = new MockProvider({ provider: 'mock', kind: 'video' });
    // video-only providers still implement the interface; routing filters them.
    expect(videoOnly.kind).toBe('video');
  });
});

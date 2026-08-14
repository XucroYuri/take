import { describe, expect, it } from 'vitest';
import { MockProvider } from '../src/adapters/mock.js';
import { buildProvider, buildRouterFromConfig, loadConfig, resolveEntryKey } from '../src/config.js';

const V1_SAMPLE = {
  name: 'my-film',
  aspectRatio: '16:9',
  image: { provider: 'gpt-image', model: 'gpt-image-2' },
  video: {
    provider: 'seedance',
    model: 'seedance-2.5',
    fallback: { provider: 'minimax', model: 'minimax-h3' },
  },
  render: { concurrency: 4 },
};

const V2_SAMPLE = {
  version: 2,
  providers: {
    image: [{ id: 'openai', adapter: 'gpt-image', apiKeyEnv: 'IMG_KEY', model: 'gpt-image-2' }],
    video: [
      { id: 'ark', adapter: 'seedance', apiKeyEnv: 'VID_KEY', model: 'seedance-2.5' },
      { id: 'minimax', adapter: 'minimax', apiKeyEnv: 'FB_KEY', model: 'minimax-h3' },
    ],
  },
  runtime: { concurrency: 3 },
};

describe('loadConfig', () => {
  it('accepts v2 configs', () => {
    const { result, issues } = loadConfig(V2_SAMPLE);
    expect(issues).toEqual([]);
    expect(result?.migrated).toBe(false);
    expect(result?.config.providers.video).toHaveLength(2);
  });

  it('auto-migrates v1 configs', () => {
    const { result, issues } = loadConfig(V1_SAMPLE);
    expect(issues).toEqual([]);
    expect(result?.migrated).toBe(true);
    const config = result!.config;
    expect(config.version).toBe(2);
    expect(config.providers.image?.[0]).toMatchObject({ adapter: 'gpt-image', model: 'gpt-image-2' });
    expect(config.providers.video?.[0]).toMatchObject({ adapter: 'seedance', model: 'seedance-2.5' });
    expect(config.providers.video?.[1]).toMatchObject({ adapter: 'minimax', model: 'minimax-h3' });
    expect(config.runtime?.concurrency).toBe(4);
  });

  it('reports issues for invalid configs', () => {
    const { issues } = loadConfig({ version: 2, providers: { video: [{ id: 'x', adapter: 'nope', model: 'm' }] } });
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe('resolveEntryKey', () => {
  it('resolves credentials through apiKeyEnv', () => {
    const key = resolveEntryKey(
      { id: 'a', adapter: 'seedance', apiKeyEnv: 'VID_KEY', model: 'm' },
      { VID_KEY: 'sk-test' },
    );
    expect(key).toBe('sk-test');
  });

  it('throws MISSING_CREDENTIAL when the env var is unset', () => {
    expect(() =>
      resolveEntryKey({ id: 'a', adapter: 'seedance', apiKeyEnv: 'MISSING_KEY', model: 'm' }, {}),
    ).toThrowError(expect.objectContaining({ code: 'MISSING_CREDENTIAL' }));
  });

  it('returns empty when no apiKeyEnv is declared (ambient auth)', () => {
    expect(resolveEntryKey({ id: 'a', adapter: 'seedance', model: 'm' }, {})).toBe('');
  });
});

describe('buildProvider', () => {
  it('builds an OpenAI-compatible image provider from an entry', () => {
    const provider = buildProvider(
      { id: 'openai', adapter: 'gpt-image', apiKeyEnv: 'IMG_KEY', model: 'gpt-image-2' },
      { IMG_KEY: 'sk-1' },
    );
    expect(provider.name).toBe('openai');
    expect(provider.model).toBe('gpt-image-2');
    expect(Array.isArray(provider.kind) ? provider.kind.includes('image') : provider.kind === 'image').toBe(true);
  });

  it('builds a mock provider', () => {
    const provider = buildProvider({ id: 'mock', adapter: 'mock', model: 'x' }, {});
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it('throws MISSING_CREDENTIAL at build time for unset keys', () => {
    expect(() => buildProvider({ id: 'a', adapter: 'seedance', apiKeyEnv: 'NO_KEY', model: 'm' }, {})).toThrowError(
      expect.objectContaining({ code: 'MISSING_CREDENTIAL' }),
    );
  });
});

describe('buildRouterFromConfig', () => {
  it('builds an ordered failover chain from config entries', async () => {
    const router = buildRouterFromConfig(loadConfig(V2_SAMPLE).result!.config, {
      env: { VID_KEY: 'sk-v', FB_KEY: 'sk-f', IMG_KEY: 'sk-i' },
      buildAdapter: (entry) => new MockProvider({ provider: entry.id, kind: ['image', 'video'], model: entry.model }),
    });
    const { provider, attempts } = await router.generateVideo({ prompt: 'x', durationSec: 5 });
    expect(provider).toBe('ark');
    expect(attempts[0]?.outcome).toBe('ok');
  });

  it('throws MISSING_CREDENTIAL at build time when the primary entry key is unset', () => {
    const config = loadConfig(V2_SAMPLE).result!.config;
    expect(
      () => buildRouterFromConfig(config, { env: { IMG_KEY: 'sk-i', FB_KEY: 'sk-f' } }), // VID_KEY missing
    ).toThrowError(expect.objectContaining({ code: 'MISSING_CREDENTIAL' }));
  });

  it('does not build a chain when a capability group is absent', async () => {
    const router = buildRouterFromConfig({ version: 2, providers: {} });
    await expect(router.generateImage({ prompt: 'x' })).rejects.toThrow();
  });
});

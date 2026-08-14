/**
 * Provider factories: build providers from environment configuration so the
 * CLI/MCP stay thin. Environment contract:
 *
 *   TAKE_IMAGE_API_KEY / TAKE_IMAGE_BASE_URL / TAKE_IMAGE_MODEL   (gpt-image)
 *   TAKE_VIDEO_API_KEY / TAKE_VIDEO_BASE_URL / TAKE_VIDEO_MODEL   (seedance)
 *   TAKE_FALLBACK_VIDEO_API_KEY / TAKE_FALLBACK_VIDEO_MODEL       (minimax)
 */
import { GptImageProvider } from './adapters/gpt-image.js';
import { MinimaxProvider } from './adapters/minimax.js';
import { MockProvider } from './adapters/mock.js';
import { SeedanceProvider } from './adapters/seedance.js';
import { ProviderRouter } from './router.js';
import type { Provider, ProviderConfig } from './seam.js';

/** Build a ProviderConfig with only defined fields (respects exactOptionalPropertyTypes). */
function configWith(provider: string, overrides: Record<string, unknown>): ProviderConfig {
  const config: ProviderConfig = { provider };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      (config as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return config;
}

export function createImageProvider(config?: ProviderConfig): Provider {
  if (config?.provider === 'mock') return new MockProvider({ provider: 'mock', kind: 'image' });
  return new GptImageProvider(
    configWith('gpt-image', {
      model: config?.model ?? process.env.TAKE_IMAGE_MODEL ?? 'gpt-image-2',
      apiKey: config?.apiKey ?? process.env.TAKE_IMAGE_API_KEY,
      baseUrl: config?.baseUrl ?? process.env.TAKE_IMAGE_BASE_URL,
    }),
  );
}

export function createVideoProvider(config?: ProviderConfig): Provider {
  if (config?.provider === 'mock') return new MockProvider({ provider: 'mock', kind: 'video' });
  if (config?.provider === 'minimax') {
    return new MinimaxProvider(
      configWith('minimax', {
        model: config?.model ?? process.env.TAKE_FALLBACK_VIDEO_MODEL ?? 'minimax-h3',
        apiKey: config?.apiKey ?? process.env.TAKE_FALLBACK_VIDEO_API_KEY,
        baseUrl: config?.baseUrl ?? process.env.TAKE_FALLBACK_VIDEO_BASE_URL,
      }),
    );
  }
  return new SeedanceProvider(
    configWith('seedance', {
      model: config?.model ?? process.env.TAKE_VIDEO_MODEL,
      apiKey: config?.apiKey ?? process.env.TAKE_VIDEO_API_KEY,
      baseUrl: config?.baseUrl ?? process.env.TAKE_VIDEO_BASE_URL,
    }),
  );
}

/** Build the full router from environment config (default take setup). */
export function createDefaultRouter(): ProviderRouter {
  return new ProviderRouter({
    image: {
      primary: createImageProvider(),
      fallbacks: [],
    },
    video: {
      primary: createVideoProvider({ provider: 'seedance' }),
      fallbacks: [createVideoProvider({ provider: 'minimax' })],
    },
  });
}

export * from './seam.js';
export * from './errors.js';
export * from './router.js';
export * from './adapters/mock.js';
export * from './adapters/gpt-image.js';
export * from './adapters/seedance.js';
export * from './adapters/minimax.js';

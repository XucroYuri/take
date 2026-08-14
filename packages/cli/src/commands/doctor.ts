import { MockProvider, ProviderRouter, createImageProvider, createVideoProvider } from '@take-ai/provider';

export interface DoctorReport {
  node: string;
  imageProvider: { configured: boolean; model?: string };
  videoProvider: { configured: boolean; model?: string };
  fallbackVideoProvider: { configured: boolean; model?: string };
  health: Array<{ provider: string; ok: boolean; latencyMs: number; error?: string }>;
}

function hasKey(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.length > 0);
}

/** Check the environment: keys present, providers reachable. */
export async function doctor(): Promise<DoctorReport> {
  const router = new ProviderRouter({
    image: {
      primary: hasKey('TAKE_IMAGE_API_KEY')
        ? createImageProvider()
        : new MockProvider({ provider: 'gpt-image (mock)', kind: 'image' }),
    },
    video: {
      primary: hasKey('TAKE_VIDEO_API_KEY')
        ? createVideoProvider({ provider: 'seedance' })
        : new MockProvider({ provider: 'seedance (mock)', kind: 'video' }),
      fallbacks: [
        hasKey('TAKE_FALLBACK_VIDEO_API_KEY')
          ? createVideoProvider({ provider: 'minimax' })
          : new MockProvider({ provider: 'minimax (mock)', kind: 'video' }),
      ],
    },
  });

  const health = await router.health();
  return {
    node: process.version,
    imageProvider: {
      configured: hasKey('TAKE_IMAGE_API_KEY'),
      model: process.env.TAKE_IMAGE_MODEL ?? 'gpt-image-2',
    },
    videoProvider: {
      configured: hasKey('TAKE_VIDEO_API_KEY'),
      model: process.env.TAKE_VIDEO_MODEL ?? 'seedance-2.5',
    },
    fallbackVideoProvider: {
      configured: hasKey('TAKE_FALLBACK_VIDEO_API_KEY'),
      model: process.env.TAKE_FALLBACK_VIDEO_MODEL ?? 'minimax-h3',
    },
    health,
  };
}

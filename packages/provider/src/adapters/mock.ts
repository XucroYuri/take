/**
 * Mock provider — used in tests and when no API keys are configured
 * (`take generate --mock`). Produces deterministic, fake results so the
 * pipeline can be exercised end-to-end offline.
 */
import type {
  ImageRequest,
  ImageResult,
  Provider,
  ProviderConfig,
  ProviderHealth,
  VideoJob,
  VideoRequest,
} from '../seam.js';

export class MockProvider implements Provider {
  readonly kind: 'image' | 'video' | readonly ['image', 'video'];
  readonly name: string;

  constructor(config: Partial<ProviderConfig> & { kind?: 'image' | 'video' | readonly ['image', 'video'] } = {}) {
    this.name = config.provider ?? 'mock';
    this.kind = config.kind ?? ['image', 'video'];
  }

  async generateImage(req: ImageRequest): Promise<ImageResult> {
    return {
      id: `mock-img-${req.prompt.length}`,
      url: `mock://image/${encodeURIComponent(req.prompt.slice(0, 40))}.png`,
      contentType: 'image/png',
    };
  }

  async generateVideo(req: VideoRequest): Promise<VideoJob> {
    return {
      id: `mock-vid-${req.prompt.length}`,
      status: 'done',
      url: `mock://video/${encodeURIComponent(req.prompt.slice(0, 40))}.mp4`,
    };
  }

  async health(): Promise<ProviderHealth> {
    return { ok: true, provider: this.name, latencyMs: 0 };
  }
}

/** Deterministic failing provider for failover tests. */
export class FailingProvider extends MockProvider {
  override async generateImage(_req: ImageRequest): Promise<ImageResult> {
    throw new Error(`${this.name} image failure`);
  }

  override async generateVideo(_req: VideoRequest): Promise<VideoJob> {
    throw new Error(`${this.name} video failure`);
  }
}

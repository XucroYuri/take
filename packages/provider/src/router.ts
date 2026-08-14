/**
 * Failover router: dispatches by capability (image/video) to a primary
 * provider, and falls back to alternates on failure. Model IDs never leak
 * into business code — they are router config.
 */
import type { ImageRequest, ImageResult, Provider, ProviderHealth, VideoJob, VideoRequest } from './types.js';

export interface RouterConfig {
  image?: {
    primary: Provider;
    fallbacks?: Provider[];
  };
  video?: {
    primary: Provider;
    fallbacks?: Provider[];
  };
}

export class ProviderRouter {
  private readonly image?: RouterConfig['image'];
  private readonly video?: RouterConfig['video'];

  constructor(config: RouterConfig) {
    this.image = config.image;
    this.video = config.video;
  }

  private hasVideo(provider: Provider): boolean {
    const kind = provider.kind;
    return Array.isArray(kind) ? kind.includes('video') : kind === 'video';
  }

  private hasImage(provider: Provider): boolean {
    const kind = provider.kind;
    return Array.isArray(kind) ? kind.includes('image') : kind === 'image';
  }

  async generateImage(req: ImageRequest): Promise<{ provider: string; result: ImageResult }> {
    if (!this.image) throw new Error('no image provider configured');
    const chain = [this.image.primary, ...(this.image.fallbacks ?? [])].filter((p) => this.hasImage(p));
    let lastError: unknown;
    for (const provider of chain) {
      try {
        const result = await provider.generateImage(req);
        return { provider: provider.name, result };
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`all image providers failed: ${String(lastError)}`);
  }

  async generateVideo(req: VideoRequest): Promise<{ provider: string; result: VideoJob }> {
    if (!this.video) throw new Error('no video provider configured');
    const chain = [this.video.primary, ...(this.video.fallbacks ?? [])].filter((p) => this.hasVideo(p));
    let lastError: unknown;
    for (const provider of chain) {
      try {
        const result = await provider.generateVideo(req);
        return { provider: provider.name, result };
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`all video providers failed: ${String(lastError)}`);
  }

  async health(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = [];
    const candidates = [
      ...(this.image ? [this.image.primary, ...(this.image.fallbacks ?? [])] : []),
      ...(this.video ? [this.video.primary, ...(this.video.fallbacks ?? [])] : []),
    ];
    for (const provider of candidates) {
      try {
        results.push(await provider.health());
      } catch (error) {
        results.push({ ok: false, provider: provider.name, latencyMs: 0, error: String(error) });
      }
    }
    return results;
  }
}

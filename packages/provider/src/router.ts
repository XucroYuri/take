/**
 * Failover router with capability awareness: dispatches by capability
 * (image/video) to a primary provider and falls back to alternates on
 * failure. When a CapabilityRegistry is provided, providers whose model
 * cannot honor the request are skipped before any call (never wasting a
 * request); if every provider is skipped, an UNSUPPORTED TakeError is
 * thrown naming the first offending issue.
 *
 * Model IDs never leak into business code — they are router config.
 */
import type { CapabilityRegistry } from './capabilities.js';
import type { TakeError } from './errors.js';
import type { ImageRequest, ImageResult, Provider, ProviderHealth, VideoJob, VideoRequest } from './seam.js';

export interface RouterConfig {
  image?: {
    primary: Provider;
    fallbacks?: Provider[];
  };
  video?: {
    primary: Provider;
    fallbacks?: Provider[];
  };
  /** Optional capability registry for pre-dispatch validation. */
  capabilities?: CapabilityRegistry;
}

export interface RouteAttempt {
  provider: string;
  outcome: 'ok' | 'skipped-capability' | 'error';
  error?: string;
}

export class ProviderRouter {
  private readonly image?: RouterConfig['image'];
  private readonly video?: RouterConfig['video'];
  private readonly capabilities?: CapabilityRegistry;

  constructor(config: RouterConfig) {
    this.image = config.image;
    this.video = config.video;
    if (config.capabilities !== undefined) this.capabilities = config.capabilities;
  }

  private hasVideo(provider: Provider): boolean {
    const kind = provider.kind;
    return Array.isArray(kind) ? kind.includes('video') : kind === 'video';
  }

  private hasImage(provider: Provider): boolean {
    const kind = provider.kind;
    return Array.isArray(kind) ? kind.includes('image') : kind === 'image';
  }

  private imageSupported(provider: Provider, req: ImageRequest): { ok: boolean; error?: TakeError } {
    if (!this.capabilities || provider.model === undefined) return { ok: true };
    const issues = this.capabilities.validateImage(provider.name, provider.model, req);
    if (issues.length === 0) return { ok: true };
    return { ok: false, error: this.capabilities.toError(provider.name, provider.model, issues) };
  }

  private videoSupported(provider: Provider, req: VideoRequest): { ok: boolean; error?: TakeError } {
    if (!this.capabilities || provider.model === undefined) return { ok: true };
    const issues = this.capabilities.validateVideo(provider.name, provider.model, req);
    if (issues.length === 0) return { ok: true };
    return { ok: false, error: this.capabilities.toError(provider.name, provider.model, issues) };
  }

  async generateImage(req: ImageRequest): Promise<{ provider: string; result: ImageResult; attempts: RouteAttempt[] }> {
    if (!this.image) throw new Error('no image provider configured');
    const chain = [this.image.primary, ...(this.image.fallbacks ?? [])].filter((p) => this.hasImage(p));
    const attempts: RouteAttempt[] = [];
    let firstCapabilityError: TakeError | undefined;
    let lastError: unknown;
    for (const provider of chain) {
      const supported = this.imageSupported(provider, req);
      if (!supported.ok) {
        const attempt: RouteAttempt = { provider: provider.name, outcome: 'skipped-capability' };
        if (supported.error !== undefined) attempt.error = supported.error.message;
        attempts.push(attempt);
        if (firstCapabilityError === undefined) firstCapabilityError = supported.error;
        continue;
      }
      try {
        const result = await provider.generateImage(req);
        attempts.push({ provider: provider.name, outcome: 'ok' });
        return { provider: provider.name, result, attempts };
      } catch (error) {
        lastError = error;
        const attempt: RouteAttempt = { provider: provider.name, outcome: 'error' };
        attempt.error = String(error);
        attempts.push(attempt);
      }
    }
    if (firstCapabilityError) throw firstCapabilityError;
    throw new Error(`all image providers failed: ${String(lastError)}`);
  }

  async generateVideo(req: VideoRequest): Promise<{ provider: string; result: VideoJob; attempts: RouteAttempt[] }> {
    if (!this.video) throw new Error('no video provider configured');
    const chain = [this.video.primary, ...(this.video.fallbacks ?? [])].filter((p) => this.hasVideo(p));
    const attempts: RouteAttempt[] = [];
    let firstCapabilityError: TakeError | undefined;
    let lastError: unknown;
    for (const provider of chain) {
      const supported = this.videoSupported(provider, req);
      if (!supported.ok) {
        const attempt: RouteAttempt = { provider: provider.name, outcome: 'skipped-capability' };
        if (supported.error !== undefined) attempt.error = supported.error.message;
        attempts.push(attempt);
        if (firstCapabilityError === undefined) firstCapabilityError = supported.error;
        continue;
      }
      try {
        const result = await provider.generateVideo(req);
        attempts.push({ provider: provider.name, outcome: 'ok' });
        return { provider: provider.name, result, attempts };
      } catch (error) {
        lastError = error;
        const attempt: RouteAttempt = { provider: provider.name, outcome: 'error' };
        attempt.error = String(error);
        attempts.push(attempt);
      }
    }
    if (firstCapabilityError) throw firstCapabilityError;
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

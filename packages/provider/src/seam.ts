/**
 * ProviderSeam — the Service Definition role of take's provider capability.
 *
 * Consumers (CLI, MCP, future take-dsh adapters) depend on this seam and
 * never on concrete adapters. Adapters register provider routes through
 * `registerAdapter`, which returns a disposer (effect semantics) so the
 * future dsh mount (`ctx.effect()`) needs zero rewriting.
 *
 * Model IDs never leak into business code: they are adapter-owned strings,
 * resolved per request. Registration is all-or-nothing per route; a
 * duplicate route throws `DUPLICATE_ADAPTER`.
 */
import { TakeError } from './errors.js';

export type ProviderKind = 'image' | 'video';

/** Unified image-generation request. */
export interface ImageRequest {
  prompt: string;
  /** e.g. `1024x1024`, `1536x1024`, `1024x1536`. */
  size?: string;
  /** Number of images. */
  n?: number;
  /** Optional reference images for consistency (URLs). */
  referenceImages?: string[];
}

export interface ImageResult {
  /** Provider-generated id. */
  id: string;
  /** URL or local file path of the generated image. */
  url: string;
  contentType: string;
}

/** Unified video-generation request. */
export interface VideoRequest {
  prompt: string;
  /** First-frame image URL (image-to-video). */
  firstFrameUrl?: string;
  /** Last-frame image URL (optional, seedance-style). */
  lastFrameUrl?: string;
  /** Reference video URL (motion transfer / style). */
  referenceVideoUrl?: string;
  /** Target duration in seconds (model-dependent: 5/10). */
  durationSec?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  resolution?: '720p' | '1080p';
}

export type VideoJobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface VideoJob {
  id: string;
  status: VideoJobStatus;
  /** Populated when done. */
  url?: string;
  error?: string;
}

export interface ProviderHealth {
  ok: boolean;
  provider: string;
  latencyMs: number;
  error?: string;
}

/** Retry policy metadata captured at adapter registration (dsh-aligned). */
export interface RetryPolicy {
  mode: 'normal' | 'always';
  maxRetries: number;
  backoff: {
    initialDelayMs: number;
    maxDelayMs: number;
    jitterRatio: number;
  };
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  mode: 'normal',
  maxRetries: 2,
  backoff: {
    initialDelayMs: 500,
    maxDelayMs: 10_000,
    jitterRatio: 0.1,
  },
};

/** A provider that can generate images, videos, or both. */
export interface Provider {
  readonly kind: ProviderKind | readonly ProviderKind[];
  readonly name: string;
  /** The model this adapter instance serves (undefined = unknown capacity). */
  readonly model?: string;
  generateImage(req: ImageRequest): Promise<ImageResult>;
  generateVideo(req: VideoRequest): Promise<VideoJob>;
  health(): Promise<ProviderHealth>;
}

/** Factory input: how a provider is configured. */
export interface ProviderConfig {
  provider: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ProviderInfo {
  provider: string;
  kind: ProviderKind | readonly ProviderKind[];
  model?: string;
}

export type Disposer = () => void;

/**
 * The registration seam. Adapters register provider routes; consumers query
 * and dispatch through it. Registration is effect-based: disposing the
 * calling fiber unregisters the adapter.
 */
export class ProviderSeam {
  private readonly adapters = new Map<string, Provider>();

  /** Register one adapter for the given provider routes. All-or-nothing. */
  registerAdapter(providers: string[], adapter: Provider): Disposer {
    for (const route of providers) {
      if (this.adapters.has(route)) {
        throw new TakeError({
          code: 'DUPLICATE_ADAPTER',
          message: `provider route already registered: ${route}`,
        });
      }
    }
    for (const route of providers) {
      this.adapters.set(route, adapter);
    }
    return () => {
      for (const route of providers) {
        if (this.adapters.get(route) === adapter) {
          this.adapters.delete(route);
        }
      }
    };
  }

  /** Describe registered provider routes in registration order. */
  listProviders(): ProviderInfo[] {
    return [...this.adapters.entries()].map(([provider, adapter]) => ({
      provider,
      kind: adapter.kind,
    }));
  }

  get(provider: string): Provider {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new TakeError({ code: 'NO_ADAPTER', message: `no adapter registered for provider: ${provider}` });
    }
    return adapter;
  }

  /**
   * The retry policy captured at registration for a provider route
   * (dsh `providerRetryPolicy` semantics). Defaults resolve to the
   * DEFAULT_RETRY_POLICY when the adapter carries none.
   */
  providerRetryPolicy(provider: string): RetryPolicy {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new TakeError({ code: 'NO_ADAPTER', message: `no adapter registered for provider: ${provider}` });
    }
    const policy = (adapter as Provider & { retryPolicy?: RetryPolicy }).retryPolicy;
    return policy ?? DEFAULT_RETRY_POLICY;
  }

  has(provider: string): boolean {
    return this.adapters.has(provider);
  }
}

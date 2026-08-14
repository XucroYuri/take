/**
 * Provider contracts. Every provider (real or mock) implements these shapes.
 * The router dispatches by capability with failover.
 */

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

/** A provider that can generate images, videos, or both. */
export interface Provider {
  readonly kind: ProviderKind | readonly ProviderKind[];
  readonly name: string;
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

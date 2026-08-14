/**
 * CapabilityRegistry — model capability metadata and request pre-validation,
 * aligned with dsh's `resolveModelInfo` mindset:
 *
 *   - Exact-model metadata is a correctness query, not a catalog decoration.
 *   - Unknown models preserve unknown capacity (never a whitelist rejection).
 *   - Consumers must not reject a request because its model is unlisted.
 *
 * Validation only checks dimensions the model explicitly declares; an
 * undeclared dimension is left to the adapter. This prevents wasting a
 * call on a request the model cannot honor (e.g. a 10s duration on a model
 * that only supports 5s) without blocking custom/unlisted models.
 */
import { TakeError } from './errors.js';

export type AspectRatio = '16:9' | '9:16' | '1:1';

export interface ModelCapability {
  provider: string;
  model: string;
  /** Supported video durations in seconds. */
  videoDuration?: number[];
  /** Supported aspect ratios. */
  aspectRatios?: AspectRatio[];
  /** Supported resolutions. */
  resolutions?: string[];
  /** Supported image sizes. */
  imageSizes?: string[];
}

export interface CapabilityIssue {
  field: 'durationSec' | 'aspectRatio' | 'resolution' | 'size';
  requested: unknown;
  supported: readonly unknown[];
}

export type CapabilityDisposer = () => void;

/**
 * Built-in capability table. Exact-model metadata for the models take ships
 * with; unknown models are simply not present (registry resolves undefined).
 */
const BUILTIN_CAPABILITIES: readonly ModelCapability[] = [
  {
    provider: 'gpt-image',
    model: 'gpt-image-2',
    imageSizes: ['1024x1024', '1536x1024', '1024x1536'],
  },
  {
    provider: 'seedance',
    model: 'seedance-2.0',
    videoDuration: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
  },
  {
    provider: 'seedance',
    model: 'seedance-2.5',
    videoDuration: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
  },
  {
    provider: 'minimax',
    model: 'minimax-h3',
    videoDuration: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
  },
];

export class CapabilityRegistry {
  private readonly entries = new Map<string, ModelCapability>();

  constructor() {
    for (const entry of BUILTIN_CAPABILITIES) {
      this.register(entry);
    }
  }

  /** Register or replace a model capability; returns a disposer (effect). */
  register(capability: ModelCapability): CapabilityDisposer {
    const key = `${capability.provider}/${capability.model}`;
    this.entries.set(key, capability);
    return () => {
      if (this.entries.get(key) === capability) {
        this.entries.delete(key);
      }
    };
  }

  /** Exact-model metadata; undefined for unknown models (capacity preserved). */
  resolve(provider: string, model: string): ModelCapability | undefined {
    return this.entries.get(`${provider}/${model}`);
  }

  /**
   * Pre-validate a request against the model's declared capability.
   * Unknown models or undeclared dimensions yield no issues (never reject
   * on absence); declared-but-unhonored dimensions yield issues.
   */
  validateVideo(
    provider: string,
    model: string,
    req: { durationSec?: number; aspectRatio?: AspectRatio; resolution?: string },
  ): CapabilityIssue[] {
    const capability = this.resolve(provider, model);
    if (capability === undefined) return [];
    const issues: CapabilityIssue[] = [];
    if (
      req.durationSec !== undefined &&
      capability.videoDuration &&
      !capability.videoDuration.includes(req.durationSec)
    ) {
      issues.push({ field: 'durationSec', requested: req.durationSec, supported: capability.videoDuration });
    }
    if (
      req.aspectRatio !== undefined &&
      capability.aspectRatios &&
      !capability.aspectRatios.includes(req.aspectRatio)
    ) {
      issues.push({ field: 'aspectRatio', requested: req.aspectRatio, supported: capability.aspectRatios });
    }
    if (req.resolution !== undefined && capability.resolutions && !capability.resolutions.includes(req.resolution)) {
      issues.push({ field: 'resolution', requested: req.resolution, supported: capability.resolutions });
    }
    return issues;
  }

  validateImage(provider: string, model: string, req: { size?: string }): CapabilityIssue[] {
    const capability = this.resolve(provider, model);
    if (capability === undefined) return [];
    const issues: CapabilityIssue[] = [];
    if (req.size !== undefined && capability.imageSizes && !capability.imageSizes.includes(req.size)) {
      issues.push({ field: 'size', requested: req.size, supported: capability.imageSizes });
    }
    return issues;
  }

  /** Render issues as a single UNSUPPORTED TakeError (route on code). */
  toError(provider: string, model: string, issues: CapabilityIssue[]): TakeError {
    const detail = issues.map((i) => `${i.field}=${String(i.requested)}`).join(', ');
    return new TakeError({
      code: 'UNSUPPORTED',
      message: `${provider}/${model} does not support: ${detail}`,
    });
  }
}

/**
 * Configuration v2 — dsh cordis.yml mindset: ordered entry lists, secrets as
 * `apiKeyEnv` references (never literal keys), composition at load time.
 *
 * v1 (the legacy `image`/`video` shorthand) is auto-migrated to v2 on load,
 * so existing projects upgrade without touching their config file.
 */
import { z } from 'zod';
import { MockProvider } from './adapters/mock.js';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible.js';
import type { CapabilityRegistry } from './capabilities.js';
import { TakeError } from './errors.js';
import { ProviderRouter } from './router.js';
import type { RetryPolicy } from './seam.js';
import type { Provider } from './seam.js';

// ---------------------------------------------------------------------------
// v2 schema
// ---------------------------------------------------------------------------

export const retryPolicySchema = z.object({
  mode: z.enum(['normal', 'always']).optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  backoff: z
    .object({
      initialDelayMs: z.number().nonnegative().optional(),
      maxDelayMs: z.number().nonnegative().optional(),
      jitterRatio: z.number().nonnegative().optional(),
    })
    .optional(),
});

export const providerEntrySchema = z.object({
  /** Stable entry id for patching, e.g. 'openai'. */
  id: z.string().min(1),
  /** Adapter to use. */
  adapter: z.enum(['openai-compatible', 'gpt-image', 'seedance', 'minimax', 'mock']),
  baseUrl: z.string().url().optional(),
  /** Environment variable reference for the credential — never a literal key. */
  apiKeyEnv: z.string().min(1).optional(),
  /** Auth mode; default bearer. */
  auth: z.enum(['bearer', 'header', 'query']).optional(),
  model: z.string().min(1),
  /** Reserved for weighted routing among equal providers. */
  weight: z.number().positive().optional(),
  /** Poll interval for async jobs (ms); adapter default when omitted. */
  pollIntervalMs: z.number().positive().optional(),
  /** Per-entry retry policy override (wins over runtime.maxRetries). */
  retryPolicy: retryPolicySchema.optional(),
});

export const runtimeConfigSchema = z.object({
  concurrency: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
});

export const takeConfigV2Schema = z.object({
  version: z.literal(2),
  providers: z.object({
    image: z.array(providerEntrySchema).optional(),
    video: z.array(providerEntrySchema).optional(),
  }),
  runtime: runtimeConfigSchema.optional(),
});

// ---------------------------------------------------------------------------
// v1 (legacy) schema — what take.config.json used before v2
// ---------------------------------------------------------------------------

const v1FallbackSchema = z.object({
  provider: z.enum(['seedance', 'minimax']),
  model: z.string().optional(),
});

export const takeConfigV1Schema = z.object({
  name: z.string(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '21:9']).optional(),
  style: z.string().optional(),
  image: z
    .object({
      provider: z.literal('gpt-image'),
      model: z.string().optional(),
      fallback: z
        .object({
          provider: z.string(),
          model: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  video: z
    .object({
      provider: z.enum(['seedance', 'minimax']),
      model: z.string().optional(),
      fallback: v1FallbackSchema.optional(),
    })
    .optional(),
  render: z
    .object({
      imageSize: z.string().optional(),
      videoDurationSec: z.number().positive().optional(),
      videoResolution: z.enum(['720p', '1080p']).optional(),
      concurrency: z.number().int().positive().optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderEntry = z.infer<typeof providerEntrySchema>;
export type TakeConfigV2 = z.infer<typeof takeConfigV2Schema>;
export type TakeConfigV1 = z.infer<typeof takeConfigV1Schema>;
export type TakeConfig = TakeConfigV2;

export interface ConfigLoadResult {
  config: TakeConfigV2;
  /** True when the input was v1 and was migrated. */
  migrated: boolean;
  /** Migration notes for human-facing output. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// v1 → v2 migration
// ---------------------------------------------------------------------------

const DEFAULT_ENV: Record<string, string> = {
  gptImage: 'TAKE_IMAGE_API_KEY',
  seedance: 'TAKE_VIDEO_API_KEY',
  minimax: 'TAKE_FALLBACK_VIDEO_API_KEY',
};

function migrateV1(v1: TakeConfigV1): { config: TakeConfigV2; notes: string[] } {
  const notes: string[] = [];
  const image: ProviderEntry[] = [];
  const video: ProviderEntry[] = [];

  if (v1.image) {
    image.push({
      id: 'gpt-image',
      adapter: 'gpt-image',
      apiKeyEnv: DEFAULT_ENV.gptImage,
      model: v1.image.model ?? 'gpt-image-2',
    });
    if (v1.image.fallback) {
      notes.push('v1 image.fallback ignored (no v2 image fallback adapter configured)');
    }
  }

  if (v1.video) {
    const primaryAdapter = v1.video.provider === 'minimax' ? 'minimax' : 'seedance';
    video.push({
      id: primaryAdapter,
      adapter: primaryAdapter,
      apiKeyEnv: primaryAdapter === 'minimax' ? DEFAULT_ENV.minimax : DEFAULT_ENV.seedance,
      model: v1.video.model ?? (primaryAdapter === 'minimax' ? 'minimax-h3' : 'seedance-2.0'),
    });
    if (v1.video.fallback) {
      const fallbackAdapter = v1.video.fallback.provider === 'minimax' ? 'minimax' : 'seedance';
      video.push({
        id: fallbackAdapter,
        adapter: fallbackAdapter,
        apiKeyEnv: fallbackAdapter === 'minimax' ? DEFAULT_ENV.minimax : DEFAULT_ENV.seedance,
        model: v1.video.fallback.model ?? (fallbackAdapter === 'minimax' ? 'minimax-h3' : 'seedance-2.0'),
      });
    }
  }

  const config: TakeConfigV2 = { version: 2, providers: {} };
  if (image.length > 0) config.providers.image = image;
  if (video.length > 0) config.providers.video = video;
  if (v1.render?.concurrency !== undefined) {
    config.runtime = { concurrency: v1.render.concurrency };
  }

  return { config, notes };
}

// ---------------------------------------------------------------------------
// Load + validate
// ---------------------------------------------------------------------------

export interface ConfigIssues {
  path: string;
  message: string;
}

function collectIssues(error: z.ZodError): ConfigIssues[] {
  return error.issues.map((issue: z.ZodIssue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/** Load raw config JSON; auto-migrates v1. Returns issues for invalid input. */
export function loadConfig(data: unknown): { result?: ConfigLoadResult; issues: ConfigIssues[] } {
  // Try v2 first.
  const v2 = takeConfigV2Schema.safeParse(data);
  if (v2.success) {
    return { result: { config: v2.data, migrated: false, notes: [] }, issues: [] };
  }
  // Try v1.
  const v1 = takeConfigV1Schema.safeParse(data);
  if (v1.success) {
    const { config, notes } = migrateV1(v1.data);
    return { result: { config, migrated: true, notes }, issues: [] };
  }
  // Neither: prefer v2 errors (more specific to the intended format).
  return { issues: collectIssues(v2.error) };
}

// ---------------------------------------------------------------------------
// Config → Provider building (composition at load time)
// ---------------------------------------------------------------------------

export interface BuildRouterOptions {
  /** Env source; defaults to process.env. Injectable for tests. */
  env?: Record<string, string | undefined>;
  capabilities?: CapabilityRegistry;
  /** Override adapter construction (tests inject mocks). */
  buildAdapter?: (
    entry: ProviderEntry,
    env: Record<string, string | undefined>,
    runtimeRetry?: { maxRetries?: number },
  ) => Provider;
}

/** Resolve an entry's credential from its apiKeyEnv reference. */
export function resolveEntryKey(entry: ProviderEntry, env: Record<string, string | undefined>): string {
  if (entry.apiKeyEnv === undefined) return '';
  const value = env[entry.apiKeyEnv];
  if (value === undefined || value === '') {
    throw new TakeError({
      code: 'MISSING_CREDENTIAL',
      message: `${entry.id}: apiKeyEnv ${entry.apiKeyEnv} is not set`,
    });
  }
  return value;
}

/**
 * Resolve a provider's retry policy: entry-level override wins; else
 * runtime.maxRetries layers onto the adapter default; else undefined
 * (adapter default applies).
 */
export function resolveRetryPolicy(
  entry: ProviderEntry,
  runtimeRetry?: { maxRetries?: number },
): RetryPolicy | undefined {
  if (entry.retryPolicy !== undefined) {
    return {
      mode: entry.retryPolicy.mode ?? 'normal',
      maxRetries: entry.retryPolicy.maxRetries ?? 2,
      backoff: {
        initialDelayMs: entry.retryPolicy.backoff?.initialDelayMs ?? 500,
        maxDelayMs: entry.retryPolicy.backoff?.maxDelayMs ?? 10_000,
        jitterRatio: entry.retryPolicy.backoff?.jitterRatio ?? 0.1,
      },
    };
  }
  if (runtimeRetry?.maxRetries !== undefined) {
    return {
      mode: 'normal',
      maxRetries: runtimeRetry.maxRetries,
      backoff: { initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 },
    };
  }
  return undefined;
}

/** Build a Provider from a config entry (the only place adapters are chosen). */
export function buildProvider(
  entry: ProviderEntry,
  env: Record<string, string | undefined>,
  runtimeRetry?: { maxRetries?: number },
): Provider {
  if (entry.adapter === 'mock') {
    return new MockProvider({ provider: entry.id, kind: ['image', 'video'] });
  }
  const apiKey = resolveEntryKey(entry, env);
  const base = { apiKey };
  // Resolve retry policy: entry-level override wins; else runtime.maxRetries
  // layers onto the adapter default; else adapter default.
  const retryPolicy = resolveRetryPolicy(entry, runtimeRetry);
  const configBase = retryPolicy === undefined ? base : { ...base, retryPolicy };
  switch (entry.adapter) {
    case 'gpt-image':
      return new OpenAiCompatibleAdapter({
        provider: entry.id,
        kind: 'image',
        baseUrl: entry.baseUrl ?? 'https://api.openai.com/v1',
        model: entry.model,
        ...configBase,
      });
    case 'seedance':
      return new OpenAiCompatibleAdapter({
        provider: entry.id,
        kind: 'video',
        baseUrl: entry.baseUrl ?? 'https://ark.cn-beijing.volces.com/api/v3',
        model: entry.model,
        ...configBase,
      });
    case 'minimax':
      return new OpenAiCompatibleAdapter({
        provider: entry.id,
        kind: 'video',
        baseUrl: entry.baseUrl ?? 'https://api.minimaxi.com/v1',
        model: entry.model,
        ...configBase,
      });
    case 'openai-compatible':
      return new OpenAiCompatibleAdapter({
        provider: entry.id,
        kind: ['image', 'video'],
        baseUrl: entry.baseUrl ?? 'https://api.openai.com/v1',
        model: entry.model,
        ...configBase,
      });
    default:
      // Exhaustive over the adapter enum; unreachable.
      throw new TakeError({ code: 'INTERNAL', message: `unknown adapter: ${entry.adapter}` });
  }
}

/** Build a ProviderRouter from a v2 config. Entries are ordered failover chains. */
export function buildRouterFromConfig(config: TakeConfigV2, options: BuildRouterOptions = {}): ProviderRouter {
  const env = options.env ?? process.env;
  const build = options.buildAdapter ?? buildProvider;
  const runtimeRetry: { maxRetries?: number } = {};
  if (config.runtime?.maxRetries !== undefined) runtimeRetry.maxRetries = config.runtime.maxRetries;
  const routerConfig: ConstructorParameters<typeof ProviderRouter>[0] = {};
  if (options.capabilities !== undefined) routerConfig.capabilities = options.capabilities;

  if (config.providers.image !== undefined && config.providers.image.length > 0) {
    const entries = config.providers.image;
    const primary = entries[0];
    if (primary !== undefined) {
      routerConfig.image = {
        primary: build(primary, env, runtimeRetry),
        fallbacks: entries.slice(1).map((e: ProviderEntry) => build(e, env, runtimeRetry)),
      };
    }
  }
  if (config.providers.video !== undefined && config.providers.video.length > 0) {
    const entries = config.providers.video;
    const primary = entries[0];
    if (primary !== undefined) {
      routerConfig.video = {
        primary: build(primary, env, runtimeRetry),
        fallbacks: entries.slice(1).map((e: ProviderEntry) => build(e, env, runtimeRetry)),
      };
    }
  }
  return new ProviderRouter(routerConfig);
}

/**
 * OpenAI-compatible adapter — the universal provider covering ~90% of
 * vendors (OpenAI, Volcengine Ark, kwjm proxies, SiliconFlow, DeepSeek,
 * Minimax-compatible endpoints, ...). One adapter, configured by
 * baseUrl + apiKey + model; swap vendors by changing config, not code.
 *
 * Five responsibilities, kept in separate files under adapters/openai/:
 *   wire.ts       — wire-level types for the OpenAI-compatible shapes
 *   request.ts    — request serialization (image/video bodies)
 *   parse.ts      — response parsing (sync vs async-job auto-detect)
 *   poll.ts       — async job polling (submit/query primitives)
 *   adapter.ts    — the Provider implementation tying them together
 *
 * Auto-detect: a response with `data[].url` is synchronous; a response
 * with an `id` (and no url) is an async job we poll.
 */
import { TakeError } from '../errors.js';
import { DEFAULT_RETRY_POLICY } from '../seam.js';
import type { RetryPolicy } from '../seam.js';
import type { Provider } from '../seam.js';
import type { ImageRequest, ImageResult, ProviderHealth, VideoJob, VideoRequest } from '../seam.js';
import { transportJson } from '../transport/http.js';

export interface OpenAiCompatConfig {
  /** Provider route name, e.g. 'gpt-image', 'seedance', 'minimax'. */
  provider: string;
  /** Capability kind. */
  kind: 'image' | 'video' | readonly ['image', 'video'];
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Optional per-request retry policy override. */
  retryPolicy?: RetryPolicy;
  /** Poll interval for async jobs; defaults to 3000ms. */
  pollIntervalMs?: number;
  /** Max polls before TIMEOUT; defaults to 100. */
  maxPolls?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLLS = 100;

interface ImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message?: string };
}

interface VideoCreateResponse {
  id?: string;
  data?: Array<{ url?: string; video_url?: string }>;
  status?: string;
  error?: { message?: string };
}

interface VideoStatusResponse {
  status?: string;
  output?: { video_url?: string };
  data?: Array<{ url?: string }>;
  error?: { message?: string };
}

export class OpenAiCompatibleAdapter implements Provider {
  readonly kind: 'image' | 'video' | readonly ['image', 'video'];
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly pollIntervalMs: number;
  private readonly maxPolls: number;
  readonly retryPolicy: RetryPolicy;

  constructor(config: OpenAiCompatConfig) {
    if (!config.apiKey) {
      throw new TakeError({ code: 'MISSING_CREDENTIAL', message: `${config.provider} provider requires an API key` });
    }
    this.name = config.provider;
    this.kind = config.kind;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.maxPolls = config.maxPolls ?? DEFAULT_MAX_POLLS;
    this.retryPolicy = config.retryPolicy ?? DEFAULT_RETRY_POLICY;
  }

  private headers(): { authorization: string } {
    return { authorization: `Bearer ${this.apiKey}` };
  }

  async generateImage(req: ImageRequest): Promise<ImageResult> {
    const { data: response } = await transportJson<ImageResponse>(
      `${this.baseUrl}/images/generations`,
      {
        method: 'POST',
        body: JSON.stringify({
          model: this.model,
          prompt: req.prompt,
          size: req.size ?? '1536x1024',
          n: req.n ?? 1,
          response_format: 'url',
        }),
      },
      { headers: this.headers(), retryPolicy: this.retryPolicy },
    );

    if (response.error?.message) {
      throw new TakeError({ code: 'INTERNAL', message: `${this.name} error: ${response.error.message}` });
    }
    const item = response.data?.[0];
    if (!item?.url) {
      throw new TakeError({ code: 'EMPTY_RESPONSE', message: `${this.name} returned no image url` });
    }
    return { id: crypto.randomUUID(), url: item.url, contentType: 'image/png' };
  }

  private async submitVideo(req: VideoRequest): Promise<VideoCreateResponse> {
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: req.prompt }];
    if (req.firstFrameUrl) {
      content.push({ type: 'image_url', image_url: { url: req.firstFrameUrl } });
    }
    if (req.lastFrameUrl) {
      content.push({ type: 'image_url', image_url: { url: req.lastFrameUrl } });
    }
    if (req.referenceVideoUrl) {
      content.push({ type: 'video_url', video_url: { url: req.referenceVideoUrl } });
    }

    const body: Record<string, unknown> = { model: this.model, content };
    if (req.durationSec) body.duration = req.durationSec;
    if (req.aspectRatio) body.aspect_ratio = req.aspectRatio;
    if (req.resolution) body.resolution = req.resolution;

    const { data } = await transportJson<VideoCreateResponse>(
      `${this.baseUrl}/videos/generations`,
      { method: 'POST', body: JSON.stringify(body) },
      { headers: this.headers(), retryPolicy: this.retryPolicy },
    );
    return data;
  }

  private async pollJob(jobId: string, signal?: AbortSignal): Promise<VideoJob> {
    for (let i = 0; i < this.maxPolls; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      const options: { headers: { authorization: string }; signal?: AbortSignal } = { headers: this.headers() };
      if (signal !== undefined) options.signal = signal;
      const { data: status } = await transportJson<VideoStatusResponse>(
        `${this.baseUrl}/videos/${jobId}`,
        { method: 'GET' },
        options,
      );
      if (status.error?.message) {
        throw new TakeError({ code: 'INTERNAL', message: `${this.name} job ${jobId} failed: ${status.error.message}` });
      }
      const doneUrl = status.output?.video_url ?? status.data?.[0]?.url;
      const s = status.status ?? 'running';
      if (s === 'succeeded' || s === 'done' || s === 'completed' || doneUrl) {
        const job: VideoJob = { id: jobId, status: 'done' };
        if (doneUrl) job.url = doneUrl;
        return job;
      }
      if (s === 'failed' || s === 'error') {
        throw new TakeError({ code: 'INTERNAL', message: `${this.name} job ${jobId} failed` });
      }
    }
    throw new TakeError({ code: 'TIMEOUT', message: `${this.name} job ${jobId} did not finish in time` });
  }

  async generateVideo(req: VideoRequest): Promise<VideoJob> {
    const created = await this.submitVideo(req);
    if (created.error?.message) {
      throw new TakeError({ code: 'INTERNAL', message: `${this.name} error: ${created.error.message}` });
    }

    // Synchronous-style response (proxy gateways).
    const url = created.data?.[0]?.url ?? created.data?.[0]?.video_url;
    if (url) {
      const job: VideoJob = { id: created.id ?? crypto.randomUUID(), status: 'done' };
      job.url = url;
      return job;
    }
    if (!created.id) {
      throw new TakeError({
        code: 'EMPTY_RESPONSE',
        message: `${this.name} returned neither a job id nor a result url`,
      });
    }
    return this.pollJob(created.id);
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    return { ok: true, provider: `${this.name}:${this.model}`, latencyMs: Date.now() - start };
  }
}

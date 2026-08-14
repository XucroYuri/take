/**
 * Seedance 2.0 / 2.5 provider — the primary video model family.
 *
 * Talks to an OpenAI-compatible async video endpoint. Two common wire shapes
 * exist in the wild:
 *   1. synchronous:  POST /v1/videos/generations → { data: [{ url }] }
 *   2. async job:    POST /v1/videos/generations → { id } then poll GET /v1/videos/{id}
 * We auto-detect: if the response has a `data[].url`, we're done; if it has
 * an `id`, we poll until completion.
 */
import { TakeError } from '../errors.js';
import type {
  ImageRequest,
  ImageResult,
  Provider,
  ProviderConfig,
  ProviderHealth,
  RetryPolicy,
  VideoJob,
  VideoRequest,
} from '../seam.js';
import { DEFAULT_RETRY_POLICY } from '../seam.js';
import { transportJson } from '../transport/http.js';

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'seedance-2.0';
const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 100;

interface VideoCreateResponse {
  id?: string;
  data?: Array<{ url?: string; video_url?: string }>;
  status?: string;
  error?: { message?: string };
}

interface VideoStatusResponse {
  status?: string;
  output?: { video_url?: string };
  error?: { message?: string };
}

export class SeedanceProvider implements Provider {
  readonly kind = ['video'] as const;
  readonly name = 'seedance';
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  readonly retryPolicy: RetryPolicy;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new TakeError({ code: 'MISSING_CREDENTIAL', message: 'seedance provider requires an API key' });
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? process.env.TAKE_VIDEO_MODEL ?? DEFAULT_MODEL;
    this.baseUrl = (config.baseUrl ?? process.env.TAKE_VIDEO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.retryPolicy = DEFAULT_RETRY_POLICY;
  }

  private pollJob(jobId: string, signal?: AbortSignal): Promise<VideoJob> {
    return new Promise((resolve, reject) => {
      let polls = 0;
      const tick = async () => {
        polls += 1;
        if (polls > MAX_POLLS) {
          reject(
            new TakeError({
              code: 'TIMEOUT',
              message: `seedance job ${jobId} did not finish within ${MAX_POLLS * POLL_INTERVAL_MS}ms`,
            }),
          );
          return;
        }
        try {
          const transportOptions: { headers: { authorization: string }; signal?: AbortSignal } = {
            headers: { authorization: `Bearer ${this.apiKey}` },
          };
          if (signal !== undefined) transportOptions.signal = signal;
          const { data: status } = await transportJson<VideoStatusResponse>(
            `${this.baseUrl}/videos/${jobId}`,
            { method: 'GET' },
            transportOptions,
          );

          if (status.error?.message) {
            reject(
              new TakeError({ code: 'INTERNAL', message: `seedance job ${jobId} failed: ${status.error.message}` }),
            );
            return;
          }
          const s = status.status ?? 'running';
          if (s === 'succeeded' || s === 'done' || s === 'completed') {
            const job: VideoJob = { id: jobId, status: 'done' };
            if (status.output?.video_url) job.url = status.output.video_url;
            resolve(job);
            return;
          }
          if (s === 'failed' || s === 'error') {
            reject(new TakeError({ code: 'INTERNAL', message: `seedance job ${jobId} failed` }));
            return;
          }
          setTimeout(tick, POLL_INTERVAL_MS);
        } catch {
          // Transient poll errors: keep polling (respect failover only at creation).
          setTimeout(tick, POLL_INTERVAL_MS);
        }
      };
      void tick();
    });
  }

  async generateVideo(req: VideoRequest): Promise<VideoJob> {
    const body: Record<string, unknown> = {
      model: this.model,
      content: [{ type: 'text', text: req.prompt }],
    };
    if (req.firstFrameUrl) {
      (body.content as Array<Record<string, unknown>>).push({
        type: 'image_url',
        image_url: { url: req.firstFrameUrl },
      });
    }
    if (req.lastFrameUrl) {
      (body.content as Array<Record<string, unknown>>).push({
        type: 'image_url',
        image_url: { url: req.lastFrameUrl },
      });
    }
    if (req.referenceVideoUrl) {
      (body.content as Array<Record<string, unknown>>).push({
        type: 'video_url',
        video_url: { url: req.referenceVideoUrl },
      });
    }
    if (req.durationSec) body.duration = req.durationSec;
    if (req.aspectRatio) body.aspect_ratio = req.aspectRatio;
    if (req.resolution) body.resolution = req.resolution;

    const { data: created } = await transportJson<VideoCreateResponse>(
      `${this.baseUrl}/videos/generations`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      { headers: { authorization: `Bearer ${this.apiKey}` }, retryPolicy: this.retryPolicy },
    );

    if (created.error?.message) {
      throw new TakeError({ code: 'INTERNAL', message: `seedance error: ${created.error.message}` });
    }

    // Synchronous-style response (proxy gateways).
    const url = created.data?.[0]?.url ?? created.data?.[0]?.video_url;
    if (url) {
      const job: VideoJob = { id: created.id ?? crypto.randomUUID(), status: 'done' };
      job.url = url;
      return job;
    }

    if (!created.id) {
      throw new TakeError({ code: 'EMPTY_RESPONSE', message: 'seedance returned neither a job id nor a result url' });
    }

    return this.pollJob(created.id);
  }

  async generateImage(_req: ImageRequest): Promise<ImageResult> {
    throw new TakeError({ code: 'UNSUPPORTED', message: 'seedance does not generate images in take' });
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    return { ok: true, provider: `${this.name}:${this.model}`, latencyMs: Date.now() - start };
  }
}

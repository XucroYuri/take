/**
 * Minimax H3 provider — the fallback video model.
 * Uses Minimax's video-generation API (OpenAI-compatible shape when proxied;
 * native Minimax endpoints otherwise). Polls async jobs.
 */
import { httpJson } from './http.js';
import type {
  ImageRequest,
  ImageResult,
  Provider,
  ProviderConfig,
  ProviderHealth,
  VideoJob,
  VideoRequest,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.minimaxi.com/v1';
const DEFAULT_MODEL = 'minimax-h3';
const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 100;

interface MinimaxCreateResponse {
  id?: string;
  video_id?: string;
  data?: Array<{ url?: string }>;
  base_resp?: { status_code?: number; status_msg?: string };
}

interface MinimaxStatusResponse {
  status?: string;
  file_id?: string;
  data?: Array<{ url?: string }>;
  base_resp?: { status_code?: number; status_msg?: string };
}

export class MinimaxProvider implements Provider {
  readonly kind = ['video'] as const;
  readonly name = 'minimax';
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error('minimax provider requires an API key');
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.baseUrl = (config.baseUrl ?? process.env.TAKE_FALLBACK_VIDEO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  async generateVideo(req: VideoRequest): Promise<VideoJob> {
    const body: Record<string, unknown> = {
      model: this.model,
      prompt: req.prompt,
    };
    if (req.firstFrameUrl) body.first_frame_image = req.firstFrameUrl;
    if (req.durationSec) body.duration = req.durationSec;
    if (req.aspectRatio) body.aspect_ratio = req.aspectRatio;
    if (req.resolution) body.resolution = req.resolution;

    const created = await httpJson<MinimaxCreateResponse>(
      `${this.baseUrl}/videos/generations`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      { headers: { authorization: `Bearer ${this.apiKey}` } },
    );

    if (created.base_resp && created.base_resp.status_code !== 0 && created.base_resp.status_code !== 200) {
      throw new Error(`minimax error: ${created.base_resp.status_msg ?? created.base_resp.status_code}`);
    }

    const url = created.data?.[0]?.url;
    if (url) {
      const job: VideoJob = { id: created.id ?? crypto.randomUUID(), status: 'done' };
      job.url = url;
      return job;
    }

    const jobId = created.id ?? created.video_id;
    if (!jobId) throw new Error('minimax returned neither a job id nor a result url');

    // Poll until done.
    for (let i = 0; i < MAX_POLLS; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const status = await httpJson<MinimaxStatusResponse>(
        `${this.baseUrl}/videos/${jobId}`,
        {
          method: 'GET',
        },
        { headers: { authorization: `Bearer ${this.apiKey}` } },
      );
      if (status.base_resp && status.base_resp.status_code !== 0 && status.base_resp.status_code !== 200) {
        throw new Error(`minimax status error: ${status.base_resp.status_msg ?? status.base_resp.status_code}`);
      }
      const doneUrl = status.data?.[0]?.url ?? status.file_id;
      if (status.status === 'succeeded' || status.status === 'done' || doneUrl) {
        const job: VideoJob = { id: jobId, status: 'done' };
        if (typeof doneUrl === 'string') job.url = doneUrl;
        return job;
      }
      if (status.status === 'failed' || status.status === 'error') {
        throw new Error(`minimax job ${jobId} failed`);
      }
    }
    throw new Error(`minimax job ${jobId} did not finish in time`);
  }

  async generateImage(_req: ImageRequest): Promise<ImageResult> {
    throw new Error('minimax does not generate images in take');
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    return { ok: true, provider: `${this.name}:${this.model}`, latencyMs: Date.now() - start };
  }
}

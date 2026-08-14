/**
 * GPT-image-2 provider — best-in-class production stills.
 * Uses an OpenAI-compatible images API (`/v1/images/generations`).
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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface OpenAiImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message?: string };
}

export class GptImageProvider implements Provider {
  readonly kind = ['image'] as const;
  readonly name = 'gpt-image';
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error('gpt-image provider requires an API key');
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gpt-image-2';
    this.baseUrl = (config.baseUrl ?? process.env.TAKE_IMAGE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  async generateImage(req: ImageRequest): Promise<ImageResult> {
    const response = await httpJson<OpenAiImageResponse>(
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
      {
        headers: { authorization: `Bearer ${this.apiKey}` },
      },
    );

    if (response.error?.message) throw new Error(`gpt-image error: ${response.error.message}`);
    const item = response.data?.[0];
    if (!item?.url) throw new Error('gpt-image returned no image url');

    return { id: crypto.randomUUID(), url: item.url, contentType: 'image/png' };
  }

  async generateVideo(_req: VideoRequest): Promise<VideoJob> {
    throw new Error('gpt-image does not generate video');
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.generateImage({ prompt: 'a single gray pixel on a black background', size: '1024x1024' });
      return { ok: true, provider: this.name, latencyMs: Date.now() - start };
    } catch (error) {
      return { ok: false, provider: this.name, latencyMs: Date.now() - start, error: String(error) };
    }
  }
}

import type { ProviderConfig } from '../seam.js';
/**
 * Seedance 2.0 / 2.5 — a thin configuration over the OpenAI-compatible
 * adapter. The only vendor-specific facts: base URL default (Volcengine
 * Ark), route name, and the default model.
 */
import { OpenAiCompatibleAdapter } from './openai-compatible.js';

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'seedance-2.0';

export class SeedanceProvider extends OpenAiCompatibleAdapter {
  constructor(config: ProviderConfig) {
    super({
      provider: 'seedance',
      kind: 'video',
      model: config.model ?? process.env.TAKE_VIDEO_MODEL ?? DEFAULT_MODEL,
      apiKey: config.apiKey ?? process.env.TAKE_VIDEO_API_KEY ?? '',
      baseUrl: (config.baseUrl ?? process.env.TAKE_VIDEO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    });
  }
}

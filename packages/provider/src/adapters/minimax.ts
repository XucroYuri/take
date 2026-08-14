import type { ProviderConfig } from '../seam.js';
/**
 * Minimax H3 — a thin configuration over the OpenAI-compatible adapter.
 * The only vendor-specific facts: base URL default, route name, and the
 * default model. (Minimax exposes OpenAI-compatible endpoints; the native
 * `base_resp` envelope is normalized by the universal adapter's parser.)
 */
import { OpenAiCompatibleAdapter } from './openai-compatible.js';

const DEFAULT_BASE_URL = 'https://api.minimaxi.com/v1';
const DEFAULT_MODEL = 'minimax-h3';

export class MinimaxProvider extends OpenAiCompatibleAdapter {
  constructor(config: ProviderConfig) {
    super({
      provider: 'minimax',
      kind: 'video',
      model: config.model ?? process.env.TAKE_FALLBACK_VIDEO_MODEL ?? DEFAULT_MODEL,
      apiKey: config.apiKey ?? process.env.TAKE_FALLBACK_VIDEO_API_KEY ?? '',
      baseUrl: (config.baseUrl ?? process.env.TAKE_FALLBACK_VIDEO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    });
  }
}

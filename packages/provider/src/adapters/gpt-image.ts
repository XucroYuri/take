import type { ProviderConfig } from '../seam.js';
/**
 * GPT-image-2 — a thin configuration over the OpenAI-compatible adapter.
 * The only vendor-specific facts: base URL default and route name.
 */
import { OpenAiCompatibleAdapter } from './openai-compatible.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export class GptImageProvider extends OpenAiCompatibleAdapter {
  constructor(config: ProviderConfig) {
    super({
      provider: 'gpt-image',
      kind: 'image',
      model: config.model ?? 'gpt-image-2',
      apiKey: config.apiKey ?? process.env.TAKE_IMAGE_API_KEY ?? '',
      baseUrl: (config.baseUrl ?? process.env.TAKE_IMAGE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    });
  }
}

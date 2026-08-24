/**
 * MCP-side generation tools — thin wrappers over the shared orchestration
 * layer in @take-ai/provider.
 */
import { generateImages as sharedGenerateImages, generateVideos as sharedGenerateVideos } from '@take-ai/provider';
import type { GenerateResult } from '@take-ai/provider';

export interface GenerateOptions {
  mock?: boolean;
}

export async function generateImages(cwd: string, options: GenerateOptions = {}): Promise<GenerateResult[]> {
  return sharedGenerateImages(cwd, { mock: options.mock === true, concurrency: 2, resume: false, root: cwd });
}

export async function generateVideos(cwd: string, options: GenerateOptions = {}): Promise<GenerateResult[]> {
  return sharedGenerateVideos(cwd, { mock: options.mock === true, concurrency: 2, resume: false, root: cwd });
}

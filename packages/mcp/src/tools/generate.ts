/**
 * MCP-side generation tools — thin wrappers over the shared orchestration
 * layer in @take-ai/provider.
 */
import { generateImages as cliGenerateImages, generateVideos as cliGenerateVideos } from '@take-ai/provider';

export interface GenerateOptions {
  mock?: boolean;
}

export async function generateImages(cwd: string, options: GenerateOptions = {}): Promise<string[]> {
  return cliGenerateImages(cwd, { mock: options.mock === true, concurrency: 2, resume: false, root: cwd });
}

export async function generateVideos(cwd: string, options: GenerateOptions = {}): Promise<string[]> {
  return cliGenerateVideos(cwd, { mock: options.mock === true, concurrency: 2, resume: false, root: cwd });
}

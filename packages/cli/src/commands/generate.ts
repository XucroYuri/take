import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectPaths } from '@take-ai/core';
import type { Storyboard } from '@take-ai/core';
import { MockProvider, ProviderRouter, createImageProvider, createVideoProvider } from '@take-ai/provider';

export interface GenerateOptions {
  mock?: boolean;
  concurrency?: number;
}

async function loadStoryboard(cwd: string): Promise<Storyboard> {
  const raw = await readFile(projectPaths(cwd).shots, 'utf8');
  return JSON.parse(raw) as Storyboard;
}

/** Generate images (storyboard stills) for all approved shots. */
export async function generateImages(cwd: string, options: GenerateOptions = {}): Promise<string[]> {
  const storyboard = await loadStoryboard(cwd);
  const paths = projectPaths(cwd);
  await mkdir(paths.assetsImages, { recursive: true });

  const router = new ProviderRouter({
    image: { primary: options.mock ? new MockProvider({ provider: 'mock', kind: 'image' }) : createImageProvider() },
  });

  const outputs: string[] = [];
  const shotList = storyboard.shots.filter((s) => s.status === 'approved' || s.status === 'draft');
  for (const shot of shotList) {
    const { result } = await router.generateImage({ prompt: shot.imagePrompt });
    const filename = `${shot.id}.png`;
    // For real providers the url is remote; for mock it's a pseudo-url.
    await writeFile(join(paths.assetsImages, filename), `# ${result.url}\n`, 'utf8');
    outputs.push(join(paths.assetsImages, filename));
  }
  return outputs;
}

/** Generate videos for approved shots (using first-frame stills when present). */
export async function generateVideos(cwd: string, options: GenerateOptions = {}): Promise<string[]> {
  const storyboard = await loadStoryboard(cwd);
  const paths = projectPaths(cwd);
  await mkdir(paths.assetsVideos, { recursive: true });

  const router = new ProviderRouter({
    video: { primary: options.mock ? new MockProvider({ provider: 'mock', kind: 'video' }) : createVideoProvider() },
  });

  const outputs: string[] = [];
  const shotList = storyboard.shots.filter((s) => s.status === 'approved' || s.status === 'draft');
  for (const shot of shotList) {
    const { result } = await router.generateVideo({ prompt: shot.videoPrompt ?? shot.imagePrompt });
    const filename = `${shot.id}.mp4`;
    await writeFile(join(paths.assetsVideos, filename), `# ${result.url}\n`, 'utf8');
    outputs.push(join(paths.assetsVideos, filename));
  }
  return outputs;
}

/**
 * Orchestration: batch generation over the provider seam through the
 * JobRegistry, with idempotent resume (input hash) and concurrency.
 * Consumers (CLI, MCP, future take-dsh) share this one implementation.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectPaths } from '@take-ai/core';
import type { Storyboard } from '@take-ai/core';
import { MockProvider, createImageProvider, createVideoProvider } from './index.js';
import { JobEventLog } from './jobs-local.js';
import { JobRegistry } from './jobs.js';
import type { JobSpec } from './jobs.js';
import { ProviderRouter } from './router.js';

export interface BatchGenerateOptions {
  mock?: boolean;
  concurrency: number;
  /** Skip shots whose input hash matches a completed job. */
  resume: boolean;
  /** Project root (job owner + event log location). */
  root: string;
}

async function loadStoryboard(cwd: string): Promise<Storyboard> {
  const raw = await readFile(projectPaths(cwd).shots, 'utf8');
  return JSON.parse(raw) as Storyboard;
}

function inputHash(prompt: string, model: string): string {
  return createHash('sha256').update(`${model}|${prompt}`).digest('hex').slice(0, 12);
}

async function completedHashes(root: string): Promise<Set<string>> {
  const completed = new Set<string>();
  const log = new JobEventLog({ root });
  await log.load();
  for (const event of log.all()) {
    if (
      event.type === 'done' &&
      event.result &&
      typeof event.result.value === 'object' &&
      event.result.value !== null
    ) {
      const hash = (event.result.value as { inputHash?: string }).inputHash;
      if (hash) completed.add(hash);
    }
  }
  return completed;
}

async function runBatch(
  jobs: JobSpec[],
  options: { concurrency: number; root: string },
): Promise<Array<{ id: string; status: string; error?: string }>> {
  const log = new JobEventLog({ root: options.root });
  await log.load();
  const registry = new JobRegistry({ persist: (event) => log.append(event) });
  const results: Array<{ id: string; status: string; error?: string }> = [];

  let cursor = 0;
  const worker = async () => {
    while (true) {
      const job = jobs[cursor];
      if (job === undefined) return;
      cursor += 1;
      try {
        const id = await registry.start(job);
        const terminal = await registry.wait(id, 30 * 60 * 1000);
        const entry: { id: string; status: string; error?: string } = { id, status: terminal.status };
        if (terminal.error !== undefined) entry.error = terminal.error;
        results.push(entry);
      } catch (error) {
        const entry: { id: string; status: string; error?: string } = { id: job.kind, status: 'failed' };
        entry.error = String(error);
        results.push(entry);
      }
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  return results;
}

/** Generate images (storyboard stills) for all approved shots. */
export async function generateImages(cwd: string, options: BatchGenerateOptions): Promise<string[]> {
  const storyboard = await loadStoryboard(cwd);
  const paths = projectPaths(cwd);
  const root = options.root;
  await mkdir(paths.assetsImages, { recursive: true });

  const router = new ProviderRouter({
    image: { primary: options.mock ? new MockProvider({ provider: 'mock', kind: 'image' }) : createImageProvider() },
  });

  const shotList = storyboard.shots.filter((s) => s.status === 'approved' || s.status === 'draft');
  const completed = options.resume ? await completedHashes(root) : new Set<string>();

  const jobs: JobSpec[] = [];
  for (const shot of shotList) {
    const hash = inputHash(shot.imagePrompt, 'gpt-image');
    if (options.resume && completed.has(hash)) continue;
    const filename = `${shot.id}.png`;
    jobs.push({
      kind: 'take-image',
      owner: root,
      run: async () => {
        const { result } = await router.generateImage({ prompt: shot.imagePrompt });
        await writeFile(join(paths.assetsImages, filename), `# ${result.url}\n`, 'utf8');
        return { value: { url: result.url, inputHash: hash } };
      },
    });
  }

  const results = await runBatch(jobs, { concurrency: options.concurrency || 2, root });
  return results.map((r) => `${r.id}:${r.status}`);
}

/** Generate videos for approved shots (using first-frame stills when present). */
export async function generateVideos(cwd: string, options: BatchGenerateOptions): Promise<string[]> {
  const storyboard = await loadStoryboard(cwd);
  const paths = projectPaths(cwd);
  const root = options.root;
  await mkdir(paths.assetsVideos, { recursive: true });

  const router = new ProviderRouter({
    video: { primary: options.mock ? new MockProvider({ provider: 'mock', kind: 'video' }) : createVideoProvider() },
  });

  const shotList = storyboard.shots.filter((s) => s.status === 'approved' || s.status === 'draft');
  const completed = options.resume ? await completedHashes(root) : new Set<string>();

  const jobs: JobSpec[] = [];
  for (const shot of shotList) {
    const prompt = shot.videoPrompt ?? shot.imagePrompt;
    const hash = inputHash(prompt, 'seedance');
    if (options.resume && completed.has(hash)) continue;
    const filename = `${shot.id}.mp4`;
    jobs.push({
      kind: 'take-video',
      owner: root,
      run: async () => {
        const { result } = await router.generateVideo({ prompt });
        await writeFile(join(paths.assetsVideos, filename), `# ${result.url}\n`, 'utf8');
        return { value: { url: result.url, inputHash: hash } };
      },
    });
  }

  const results = await runBatch(jobs, { concurrency: options.concurrency || 2, root });
  return results.map((r) => `${r.id}:${r.status}`);
}

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

/** Per-shot outcome: maps a job back to the shot and its asset on disk. */
export interface GenerateResult {
  shotId: string;
  jobId?: string;
  status: 'done' | 'failed' | 'cancelled' | 'skipped';
  assetPath?: string;
  error?: string;
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

interface BatchJob {
  spec: JobSpec;
  meta: { shotId: string; assetPath: string };
}

async function runBatch(jobs: BatchJob[], options: { concurrency: number; root: string }): Promise<GenerateResult[]> {
  const log = new JobEventLog({ root: options.root });
  await log.load();
  const registry = new JobRegistry({ persist: (event) => log.append(event) });
  const results: GenerateResult[] = [];

  let cursor = 0;
  const worker = async () => {
    while (true) {
      const batchJob = jobs[cursor];
      if (batchJob === undefined) return;
      cursor += 1;
      const { spec, meta } = batchJob;
      try {
        const jobId = await registry.start(spec);
        const terminal = await registry.wait(jobId, 30 * 60 * 1000);
        const result: GenerateResult = {
          shotId: meta.shotId,
          jobId,
          status: terminal.status === 'done' ? 'done' : terminal.status === 'cancelled' ? 'cancelled' : 'failed',
          assetPath: meta.assetPath,
        };
        if (terminal.error !== undefined) result.error = terminal.error;
        results.push(result);
      } catch (error) {
        const result: GenerateResult = { shotId: meta.shotId, status: 'failed', assetPath: meta.assetPath };
        result.error = String(error);
        results.push(result);
      }
    }
  };
  await Promise.all(Array.from({ length: options.concurrency || 2 }, () => worker()));
  return results;
}

/** Generate images (storyboard stills) for all approved shots. */
export async function generateImages(cwd: string, options: BatchGenerateOptions): Promise<GenerateResult[]> {
  const storyboard = await loadStoryboard(cwd);
  const paths = projectPaths(cwd);
  const root = options.root;
  await mkdir(paths.assetsImages, { recursive: true });

  const router = new ProviderRouter({
    image: { primary: options.mock ? new MockProvider({ provider: 'mock', kind: 'image' }) : createImageProvider() },
  });

  const shotList = storyboard.shots.filter((s) => s.status === 'approved' || s.status === 'draft');
  const completed = options.resume ? await completedHashes(root) : new Set<string>();

  const jobs: BatchJob[] = [];
  const skipped: GenerateResult[] = [];
  for (const shot of shotList) {
    const hash = inputHash(shot.imagePrompt, 'gpt-image');
    const assetPath = join(paths.assetsImages, `${shot.id}.png`);
    if (options.resume && completed.has(hash)) {
      skipped.push({ shotId: shot.id, status: 'skipped', assetPath });
      continue;
    }
    jobs.push({
      meta: { shotId: shot.id, assetPath },
      spec: {
        kind: 'take-image',
        owner: root,
        run: async () => {
          const { result } = await router.generateImage({ prompt: shot.imagePrompt });
          await writeFile(assetPath, `# ${result.url}\n`, 'utf8');
          return { value: { url: result.url, inputHash: hash } };
        },
      },
    });
  }

  const results = await runBatch(jobs, { concurrency: options.concurrency || 2, root });
  return [...results, ...skipped];
}

/** Generate videos for approved shots (using first-frame stills when present). */
export async function generateVideos(cwd: string, options: BatchGenerateOptions): Promise<GenerateResult[]> {
  const storyboard = await loadStoryboard(cwd);
  const paths = projectPaths(cwd);
  const root = options.root;
  await mkdir(paths.assetsVideos, { recursive: true });

  const router = new ProviderRouter({
    video: { primary: options.mock ? new MockProvider({ provider: 'mock', kind: 'video' }) : createVideoProvider() },
  });

  const shotList = storyboard.shots.filter((s) => s.status === 'approved' || s.status === 'draft');
  const completed = options.resume ? await completedHashes(root) : new Set<string>();

  const jobs: BatchJob[] = [];
  const skipped: GenerateResult[] = [];
  for (const shot of shotList) {
    const prompt = shot.videoPrompt ?? shot.imagePrompt;
    const hash = inputHash(prompt, 'seedance');
    const assetPath = join(paths.assetsVideos, `${shot.id}.mp4`);
    if (options.resume && completed.has(hash)) {
      skipped.push({ shotId: shot.id, status: 'skipped', assetPath });
      continue;
    }
    jobs.push({
      meta: { shotId: shot.id, assetPath },
      spec: {
        kind: 'take-video',
        owner: root,
        run: async () => {
          const { result } = await router.generateVideo({ prompt });
          await writeFile(assetPath, `# ${result.url}\n`, 'utf8');
          return { value: { url: result.url, inputHash: hash } };
        },
      },
    });
  }

  const results = await runBatch(jobs, { concurrency: options.concurrency || 2, root });
  return [...results, ...skipped];
}

import { mkdtemp, rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportStoryboard } from '../src/commands/export.js';
import { generateImages, generateVideos } from '../src/commands/generate.js';
import { initProject } from '../src/commands/init.js';
import { validateConfig, validateFile } from '../src/commands/validate.js';

async function makeProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'take-cli-'));
  await initProject('test-film', dir);
  return join(dir, 'test-film');
}

describe('take init', () => {
  it('scaffolds a valid project layout', async () => {
    const root = await makeProject();
    const paths = ['script.md', 'take.config.json', 'shots.json', '.gitignore'];
    for (const p of paths) {
      await expect(readFile(join(root, p), 'utf8')).resolves.toBeTruthy();
    }
    await rm(root, { recursive: true, force: true });
  });
});

describe('take validate', () => {
  it('accepts the freshly scaffolded project', async () => {
    const root = await makeProject();
    const outcome = await validateFile(undefined, root);
    expect(outcome.ok).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  it('accepts a valid config', async () => {
    const root = await makeProject();
    const outcome = await validateConfig(root);
    expect(outcome.ok).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
});

describe('take export round-trip', () => {
  it('exports storyboard.md and imports it back', async () => {
    const root = await makeProject();
    // Seed a minimal shots.json
    const shots = {
      title: 'test-film',
      aspectRatio: '16:9',
      source: 'agent',
      shots: [
        {
          id: 'shot-001',
          beatId: 'beat-001',
          index: 1,
          summary: 'a cat walks',
          durationSec: 4,
          shotSize: 'medium',
          angle: 'eye-level',
          movement: 'static',
          characters: [],
          imagePrompt: 'a cat walking down a hallway, medium shot',
          status: 'approved',
        },
      ],
    };
    await import('node:fs/promises').then((fs) => fs.writeFile(join(root, 'shots.json'), JSON.stringify(shots)));
    const target = await exportStoryboard(root);
    const md = await readFile(target, 'utf8');
    expect(md).toContain('# test-film');
    expect(md).toContain('### Shot 1');
    expect(md).toContain('**Image prompt**: a cat walking down a hallway');
    await rm(root, { recursive: true, force: true });
  });
});

describe('take generate (mock)', () => {
  it('generates images for approved shots with the mock provider', async () => {
    const root = await makeProject();
    // Seed one approved shot
    const shots = {
      title: 'test-film',
      aspectRatio: '16:9',
      source: 'agent',
      shots: [
        {
          id: 'shot-001',
          beatId: 'beat-001',
          index: 1,
          summary: 'a cat walks',
          durationSec: 4,
          shotSize: 'medium',
          angle: 'eye-level',
          movement: 'static',
          characters: [],
          imagePrompt: 'a cat walking down a hallway, medium shot',
          status: 'approved',
        },
      ],
    };
    const fs = await import('node:fs/promises');
    await fs.writeFile(join(root, 'shots.json'), JSON.stringify(shots));
    const outputs = await generateImages(root, { mock: true, concurrency: 2, resume: false, root });
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toContain('take-image-1:done');
    await expect(readFile(join(root, 'assets', 'images', 'shot-001.png'), 'utf8')).resolves.toContain('mock://');
    await rm(root, { recursive: true, force: true });
  });

  it('generates videos with the mock provider', async () => {
    const root = await makeProject();
    const shots = {
      title: 'test-film',
      aspectRatio: '16:9',
      source: 'agent',
      shots: [
        {
          id: 'shot-001',
          beatId: 'beat-001',
          index: 1,
          summary: 'a cat walks',
          durationSec: 4,
          shotSize: 'medium',
          angle: 'eye-level',
          movement: 'static',
          characters: [],
          imagePrompt: 'a cat walking down a hallway',
          videoPrompt: 'camera pans as the cat walks',
          status: 'approved',
        },
      ],
    };
    const fs = await import('node:fs/promises');
    await fs.writeFile(join(root, 'shots.json'), JSON.stringify(shots));
    const outputs = await generateVideos(root, { mock: true, concurrency: 2, resume: false, root });
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toContain('take-video-1:done');
    await expect(readFile(join(root, 'assets', 'videos', 'shot-001.mp4'), 'utf8')).resolves.toContain('mock://');
    await rm(root, { recursive: true, force: true });
  });
});

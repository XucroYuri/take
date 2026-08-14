import { readFile, writeFile } from 'node:fs/promises';
import { parseStoryboardMarkdown, projectPaths, storyboardToMarkdown } from '@take-ai/core';
import type { Storyboard } from '@take-ai/core';

/** Export shots.json → storyboard.md (human-readable + machine-parseable). */
export async function exportStoryboard(cwd: string): Promise<string> {
  const paths = projectPaths(cwd);
  const raw = await readFile(paths.shots, 'utf8');
  const storyboard = JSON.parse(raw) as Storyboard;
  const md = storyboardToMarkdown(storyboard);
  await writeFile(paths.storyboard, md, 'utf8');
  return paths.storyboard;
}

/** Import storyboard.md → shots.json (round-trip). */
export async function importStoryboard(cwd: string): Promise<string> {
  const paths = projectPaths(cwd);
  const raw = await readFile(paths.storyboard, 'utf8');
  const { storyboard } = parseStoryboardMarkdown(raw);
  await writeFile(paths.shots, `${JSON.stringify(storyboard, null, 2)}\n`, 'utf8');
  return paths.shots;
}

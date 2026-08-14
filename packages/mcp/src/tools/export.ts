import { readFile, writeFile } from 'node:fs/promises';
import { projectPaths, storyboardToMarkdown } from '@take-ai/core';
import type { Storyboard } from '@take-ai/core';

export async function exportStoryboard(cwd: string): Promise<string> {
  const paths = projectPaths(cwd);
  const raw = await readFile(paths.shots, 'utf8');
  const storyboard = JSON.parse(raw) as Storyboard;
  const md = storyboardToMarkdown(storyboard);
  await writeFile(paths.storyboard, md, 'utf8');
  return paths.storyboard;
}

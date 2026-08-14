import { readFile } from 'node:fs/promises';
import { parseStoryboardMarkdown, projectPaths, validateProjectConfig, validateStoryboardFull } from '@take-ai/core';

export interface ValidateOutcome {
  ok: boolean;
  issues: Array<{ path: string; message: string }>;
  warnings: string[];
  path: string;
}

export async function validateFile(file: string | undefined, cwd: string): Promise<ValidateOutcome> {
  const paths = projectPaths(cwd);
  const target = file ?? paths.shots;
  const raw = await readFile(target, 'utf8');
  const warnings: string[] = [];

  if (target.endsWith('.md')) {
    const { storyboard, warnings: mdWarnings } = parseStoryboardMarkdown(raw);
    warnings.push(...mdWarnings);
    const { issues } = validateStoryboardFull(storyboard);
    return { ok: issues.length === 0, issues, warnings, path: target };
  }

  const data = JSON.parse(raw) as unknown;
  const candidate = Array.isArray(data)
    ? { title: 'Untitled', aspectRatio: '16:9', source: 'agent', shots: data }
    : data;
  const { issues } = validateStoryboardFull(candidate);
  return { ok: issues.length === 0, issues, warnings, path: target };
}

export async function validateConfig(cwd: string): Promise<ValidateOutcome> {
  const paths = projectPaths(cwd);
  const raw = await readFile(paths.config, 'utf8');
  const issues = validateProjectConfig(JSON.parse(raw) as unknown);
  return { ok: issues.length === 0, issues, warnings: [], path: paths.config };
}

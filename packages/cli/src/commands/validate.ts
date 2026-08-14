import { readFile } from 'node:fs/promises';
import { parseStoryboardMarkdown, projectPaths, validateStoryboardFull } from '@take-ai/core';
import { loadConfig } from '@take-ai/provider';

export interface ValidateOutcome {
  ok: boolean;
  issues: Array<{ path: string; message: string }>;
  warnings: string[];
  path: string;
}

/** Validate shots.json (or a storyboard markdown) against the take contract. */
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
  // Accept either a full storyboard or a bare { shots: [...] }.
  const candidate = Array.isArray(data)
    ? { title: 'Untitled', aspectRatio: '16:9', source: 'agent', shots: data }
    : data;
  const { issues, storyboard } = validateStoryboardFull(candidate);
  if (storyboard && storyboard.shots.length === 0) {
    warnings.push('shots.json has no shots yet — run the agent workflow to produce a shot list.');
  }
  return { ok: issues.length === 0, issues, warnings, path: target };
}

/** Validate take.config.json (v1 or v2; v1 is auto-migrated). */
export async function validateConfig(cwd: string): Promise<ValidateOutcome> {
  const paths = projectPaths(cwd);
  const raw = await readFile(paths.config, 'utf8');
  const data = JSON.parse(raw) as unknown;
  const { result, issues } = loadConfig(data);
  const warnings: string[] = [];
  if (result?.migrated) {
    warnings.push('config is v1 — automatically migrated to v2 on load; consider saving the migrated form.');
    warnings.push(...result.notes);
  }
  return { ok: issues.length === 0, issues, warnings, path: paths.config };
}

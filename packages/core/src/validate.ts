import type { z } from 'zod';
import type { Shot, Storyboard } from './models/types.js';
import { projectConfigSchema, scriptSchema, storyboardSchema } from './schemas.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

function collectIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Validate raw storyboard JSON; returns issues (empty = valid). */
export function validateStoryboard(data: unknown): ValidationIssue[] {
  const result = storyboardSchema.safeParse(data);
  if (result.success) return [];
  return collectIssues(result.error);
}

/** Validate project config JSON. */
export function validateProjectConfig(data: unknown): ValidationIssue[] {
  const result = projectConfigSchema.safeParse(data);
  if (result.success) return [];
  return collectIssues(result.error);
}

/** Validate script JSON. */
export function validateScript(data: unknown): ValidationIssue[] {
  const result = scriptSchema.safeParse(data);
  if (result.success) return [];
  return collectIssues(result.error);
}

/** Cross-field checks beyond zod: ordering, duplicate ids, dangling beat refs. */
export function validateStoryboardIntegrity(storyboard: Storyboard): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const shotIds = new Set<string>();
  const beatIds = new Set<string>(storyboard.beats?.map((b) => b.id) ?? []);

  storyboard.shots.forEach((shot, i) => {
    if (shotIds.has(shot.id)) {
      issues.push({ path: `shots[${i}].id`, message: `duplicate shot id: ${shot.id}` });
    }
    shotIds.add(shot.id);
    if (shot.index !== i + 1) {
      issues.push({ path: `shots[${i}].index`, message: `expected index ${i + 1}, got ${shot.index}` });
    }
    if (beatIds.size > 0 && !beatIds.has(shot.beatId)) {
      issues.push({ path: `shots[${i}].beatId`, message: `dangling beat reference: ${shot.beatId}` });
    }
  });

  return issues;
}

/** Convenience: full validation (schema + integrity). */
export function validateStoryboardFull(data: unknown): { issues: ValidationIssue[]; storyboard?: Storyboard } {
  const parsed = storyboardSchema.safeParse(data);
  if (!parsed.success) return { issues: collectIssues(parsed.error) };
  const storyboard = parsed.data as Storyboard;
  const issues = validateStoryboardIntegrity(storyboard);
  return { issues, storyboard };
}

/** Quick check used by the agent layer: does this shot list render as-is? */
export function isRenderable(storyboard: Storyboard): { ok: boolean; blocking: Shot[] } {
  const blocking = storyboard.shots.filter((s) => s.status !== 'approved' && s.status !== 'draft');
  return { ok: blocking.length === 0, blocking };
}

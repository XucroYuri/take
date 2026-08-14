import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleToolCall } from '../src/tools/handler.js';

async function makeProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'take-mcp-'));
  await writeFile(
    join(root, 'shots.json'),
    JSON.stringify({
      title: 'test',
      aspectRatio: '16:9',
      source: 'agent',
      shots: [],
    }),
  );
  await writeFile(
    join(root, 'take.config.json'),
    JSON.stringify({
      name: 'test',
      aspectRatio: '16:9',
      image: { provider: 'gpt-image' },
      video: { provider: 'seedance' },
    }),
  );
  return root;
}

describe('take-mcp tools', () => {
  it('validate_shots accepts a scaffolded project', async () => {
    const cwd = await makeProject();
    const result = await handleToolCall('validate_shots', {}, cwd);
    const parsed = JSON.parse(result.content[0]!.text) as { ok: boolean };
    expect(parsed.ok).toBe(true);
    await rm(cwd, { recursive: true, force: true });
  });

  it('doctor returns provider status without throwing', async () => {
    const cwd = await makeProject();
    const result = await handleToolCall('doctor', {}, cwd);
    const parsed = JSON.parse(result.content[0]!.text) as { health: unknown[] };
    expect(Array.isArray(parsed.health)).toBe(true);
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns an error for unknown tools', async () => {
    const result = await handleToolCall('nope', {}, process.cwd());
    expect(result.isError).toBe(true);
  });
});

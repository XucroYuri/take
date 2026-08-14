import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JobEventLog } from '../src/jobs-local.js';
import { JobRegistry } from '../src/jobs.js';
import type { JobSpec } from '../src/jobs.js';

function makeSpec(overrides: Partial<JobSpec> = {}): JobSpec {
  return {
    kind: 'take-video',
    owner: '/proj/film',
    run: async (control) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (control.signal.aborted) throw new Error('aborted');
      return { value: { url: 'https://cdn/v.mp4' } };
    },
    ...overrides,
  };
}

describe('JobRegistry', () => {
  it('starts a job and settles done with the result', async () => {
    const registry = new JobRegistry();
    const id = await registry.start(makeSpec());
    const done = await registry.wait(id, 2000);
    expect(done.status).toBe('done');
    expect(done.result?.value).toEqual({ url: 'https://cdn/v.mp4' });
  });

  it('lists only caller-owned jobs', async () => {
    const registry = new JobRegistry();
    await registry.start(makeSpec({ owner: 'a' }));
    await registry.start(makeSpec({ owner: 'b' }));
    expect(registry.list('a')).toHaveLength(1);
    expect(registry.list()).toHaveLength(2);
  });

  it('fences access by owner', async () => {
    const registry = new JobRegistry();
    const id = await registry.start(makeSpec({ owner: 'a' }));
    expect(() => registry.get(id, 'b')).toThrowError();
    expect(registry.get(id, 'a').id).toBe(id);
  });

  it('kill cancels a running job', async () => {
    let cancelled = false;
    const registry = new JobRegistry();
    const id = await registry.start(
      makeSpec({
        run: async (control) => {
          await new Promise((resolve) => {
            control.signal.addEventListener('abort', () => {
              cancelled = true;
              resolve();
            });
            setTimeout(resolve, 5000);
          });
          if (control.signal.aborted) throw new Error('aborted');
          return { value: {} };
        },
      }),
    );
    await registry.kill(id);
    const terminal = await registry.wait(id, 2000);
    expect(cancelled).toBe(true);
    expect(terminal.status).toBe('cancelled');
  });

  it('observes terminal records through onJobDone', async () => {
    const registry = new JobRegistry();
    const seen: string[] = [];
    registry.onJobDone((job) => seen.push(`${job.id}:${job.status}`));
    const id = await registry.start(makeSpec());
    await registry.wait(id, 2000);
    expect(seen).toContain(`${id}:done`);
  });

  it('reports failures with the error message', async () => {
    const registry = new JobRegistry();
    const id = await registry.start(
      makeSpec({
        run: async () => {
          throw new Error('model exploded');
        },
      }),
    );
    const terminal = await registry.wait(id, 2000);
    expect(terminal.status).toBe('failed');
    expect(terminal.error).toContain('model exploded');
  });

  it('waits respect the timeout and return the live snapshot', async () => {
    const registry = new JobRegistry();
    const id = await registry.start(
      makeSpec({
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return { value: {} };
        },
      }),
    );
    const snapshot = await registry.wait(id, 50);
    expect(snapshot.status).toBe('running');
  });

  it('persists events through the callback', async () => {
    const events: string[] = [];
    const registry = new JobRegistry({
      persist: (event) => {
        events.push(event.type);
      },
    });
    const id = await registry.start(makeSpec());
    await registry.wait(id, 2000);
    expect(events).toContain('queued');
    expect(events).toContain('running');
    expect(events).toContain('done');
  });
});

describe('JobEventLog', () => {
  it('round-trips events through the file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'take-jobs-'));
    const log = new JobEventLog({ root });
    await log.load();
    await log.append({
      type: 'queued',
      jobId: 'take-video-1',
      owner: 'o',
      kind: 'take-video',
      at: '2026-01-01T00:00:00.000Z',
    });
    await log.append({
      type: 'done',
      jobId: 'take-video-1',
      owner: 'o',
      kind: 'take-video',
      at: '2026-01-01T00:00:01.000Z',
      result: { value: { url: 'x' } },
    });

    const reloaded = new JobEventLog({ root });
    await reloaded.load();
    expect(reloaded.all()).toHaveLength(2);
    expect(reloaded.all()[1]).toMatchObject({ type: 'done', result: { value: { url: 'x' } } });
    await rm(root, { recursive: true, force: true });
  });

  it('handles a missing file as an empty log', async () => {
    const root = await mkdtemp(join(tmpdir(), 'take-jobs-empty-'));
    const log = new JobEventLog({ root });
    await log.load();
    expect(log.all()).toHaveLength(0);
    await rm(root, { recursive: true, force: true });
  });
});

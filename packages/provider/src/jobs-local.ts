/**
 * jobs-local: persists job events to `.take/jobs.json` (append-only event
 * log, atomic writes). Recovery replays events to derive job state — the
 * same "event log is the source of truth" principle as dsh's session log.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JobEvent } from './jobs.js';

export interface JobLogOptions {
  /** Project root; events land in `<root>/.take/jobs.json`. */
  root: string;
}

const EVENTS_FILE = '.take/jobs.json';

export class JobEventLog {
  private readonly file: string;
  private events: JobEvent[] = [];

  constructor(options: JobLogOptions) {
    this.file = join(options.root, EVENTS_FILE);
  }

  /** Load persisted events (idempotent; safe to call repeatedly). */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        this.events = parsed;
      }
    } catch (error) {
      // Missing or corrupt file: start with an empty log.
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        // Corrupt log: rename it aside rather than silently discarding.
        try {
          await rename(this.file, `${this.file}.corrupt`);
        } catch {
          // Best effort.
        }
      }
      this.events = [];
    }
  }

  async append(event: JobEvent): Promise<void> {
    this.events.push(event);
    await mkdir(join(this.file, '..'), { recursive: true });
    // Atomic write: temp file + rename.
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(this.events, null, 2), 'utf8');
    await rename(tmp, this.file);
  }

  /** All persisted events (for recovery replay). */
  all(): readonly JobEvent[] {
    return this.events;
  }
}

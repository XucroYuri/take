/**
 * JobRegistry — the background-job contract, aligned with dsh's `ctx.jobs`
 * semantics so a future take-dsh adapter maps take jobs onto `ctx.jobs.start()`
 * instead of rewriting the vocabulary.
 *
 * The seam owns: shared ids, owner isolation (caller fence), reads,
 * cancellation, waiting, notices, and cleanup. The process-local
 * implementation (jobs-local) persists job events to `.take/jobs.json`.
 */
import { TakeError } from './errors.js';

export type JobStatus = 'queued' | 'running' | 'stopping' | 'done' | 'failed' | 'cancelled';

export interface JobResult {
  /** Canonical JSON value of the finished job. */
  value: unknown;
  /** Provider or implementation that produced the result. */
  producer?: string;
}

export interface JobSnapshot {
  id: string;
  kind: string;
  owner: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  /** Terminal result, present when done. */
  result?: JobResult;
  /** Terminal error message, present when failed/cancelled. */
  error?: string;
  /** Producer-controlled status or notice metadata. */
  notice?: unknown;
}

export interface JobControl {
  /** Fires when the job is cancelled or the owner is disposed. */
  signal: AbortSignal;
  /** Request cooperative cancellation; resolve after cleanup. */
  cancel(): void;
  /** Producer may report progress; returned snapshots carry it. */
  setNotice(notice: unknown): void;
}

export interface JobSpec {
  kind: string;
  /** Owner identity (project path locally; SessionId in dsh). */
  owner: string;
  /** Run the job body; must honor control.signal. */
  run: (control: JobControl) => Promise<JobResult>;
  /** Optional positive model-presentation cap. */
  outputLimitBytes?: number;
}

export interface JobRegistryOptions {
  /** Optional persistence callback; local impl appends to .take/jobs.json. */
  persist?: (event: JobEvent) => Promise<void> | void;
}

export type JobEventType = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'notice';

export interface JobEvent {
  type: JobEventType;
  jobId: string;
  owner: string;
  kind: string;
  at: string;
  /** Present on done. */
  result?: JobResult;
  /** Present on failed/cancelled. */
  error?: string;
  /** Present on notice. */
  notice?: unknown;
}

export class JobRegistry {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly persist?: (event: JobEvent) => Promise<void> | void;
  private readonly doneListeners: Array<(job: JobSnapshot) => void> = [];
  private nextId = 1;

  constructor(options: JobRegistryOptions = {}) {
    if (options.persist !== undefined) this.persist = options.persist;
  }

  /** Observe each terminal record with its exact owner. */
  onJobDone(listener: (job: JobSnapshot) => void): () => void {
    this.doneListeners.push(listener);
    return () => {
      const idx = this.doneListeners.indexOf(listener);
      if (idx >= 0) this.doneListeners.splice(idx, 1);
    };
  }

  private async emit(event: JobEvent): Promise<void> {
    if (this.persist) await this.persist(event);
    const record = this.jobs.get(event.jobId);
    if (record === undefined) return;
    const snapshot = record.snapshot();
    if (event.type === 'done' || event.type === 'failed' || event.type === 'cancelled') {
      for (const listener of this.doneListeners) {
        try {
          listener(snapshot);
        } catch {
          // Contained: observer failures are logged, not vetoing.
        }
      }
    }
  }

  /**
   * Validate and start a job. A preflight rejection leaves no job id or
   * registered work; successful return commits.
   */
  async start(spec: JobSpec): Promise<string> {
    if (!spec.kind) throw new TakeError({ code: 'INTERNAL', message: 'job kind is required' });
    if (!spec.owner) throw new TakeError({ code: 'INTERNAL', message: 'job owner is required' });
    const id = `${spec.kind}-${this.nextId}`;
    this.nextId += 1;

    const controller = new AbortController();
    const record: JobRecord = new JobRecord({
      id,
      kind: spec.kind,
      owner: spec.owner,
      controller,
    });
    this.jobs.set(id, record);

    await this.emit({ type: 'queued', jobId: id, owner: spec.owner, kind: spec.kind, at: new Date().toISOString() });
    record.transition('running');
    await this.emit({ type: 'running', jobId: id, owner: spec.owner, kind: spec.kind, at: new Date().toISOString() });

    const control: JobControl = {
      signal: controller.signal,
      cancel: () => controller.abort(),
      setNotice: (notice: unknown) => {
        record.setNotice(notice);
        void this.emit({
          type: 'notice',
          jobId: id,
          owner: spec.owner,
          kind: spec.kind,
          at: new Date().toISOString(),
          notice,
        });
      },
    };

    void (async () => {
      try {
        const result = await spec.run(control);
        record.finish('done', result);
        await this.emit({
          type: 'done',
          jobId: id,
          owner: spec.owner,
          kind: spec.kind,
          at: new Date().toISOString(),
          result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const cancelled = controller.signal.aborted;
        record.finish(cancelled ? 'cancelled' : 'failed', undefined, message);
        await this.emit({
          type: cancelled ? 'cancelled' : 'failed',
          jobId: id,
          owner: spec.owner,
          kind: spec.kind,
          at: new Date().toISOString(),
          error: message,
        });
      }
    })();

    return id;
  }

  /** Non-consuming snapshot. */
  get(id: string, caller?: string): JobSnapshot {
    const record = this.jobs.get(id);
    if (record === undefined) throw new TakeError({ code: 'NO_ADAPTER', message: `job not found: ${id}` });
    if (caller !== undefined && record.owner !== caller) {
      throw new TakeError({ code: 'INTERNAL', message: `job ${id} is owned by ${record.owner}` });
    }
    return record.snapshot();
  }

  /** List caller-owned and unowned jobs. */
  list(caller?: string): JobSnapshot[] {
    return [...this.jobs.values()].filter((r) => caller === undefined || r.owner === caller).map((r) => r.snapshot());
  }

  /** Cancel a job: invokes producer cancellation before changing status. */
  async kill(id: string, caller?: string, reason?: string): Promise<void> {
    const record = this.jobs.get(id);
    if (record === undefined) throw new TakeError({ code: 'NO_ADAPTER', message: `job not found: ${id}` });
    if (caller !== undefined && record.owner !== caller) {
      throw new TakeError({ code: 'INTERNAL', message: `job ${id} is owned by ${record.owner}` });
    }
    if (record.status === 'done' || record.status === 'failed' || record.status === 'cancelled') return;
    record.transition('stopping');
    record.controller.abort(reason ?? 'killed');
  }

  /** Wait for a terminal snapshot or return the live snapshot at timeout. */
  async wait(id: string, timeoutMs: number, caller?: string, signal?: AbortSignal): Promise<JobSnapshot> {
    const started = Date.now();
    while (true) {
      const snapshot = this.get(id, caller);
      if (isTerminal(snapshot.status)) return snapshot;
      if (signal?.aborted) return snapshot;
      if (Date.now() - started >= timeoutMs) return snapshot;
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, timeoutMs)));
    }
  }
}

function isTerminal(status: JobStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'cancelled';
}

interface JobRecordOptions {
  id: string;
  kind: string;
  owner: string;
  controller: AbortController;
}

class JobRecord {
  readonly id: string;
  readonly kind: string;
  readonly owner: string;
  readonly controller: AbortController;
  status: JobStatus = 'queued';
  readonly createdAt = new Date().toISOString();
  updatedAt = this.createdAt;
  result?: JobResult;
  error?: string;
  notice?: unknown;

  constructor(options: JobRecordOptions) {
    this.id = options.id;
    this.kind = options.kind;
    this.owner = options.owner;
    this.controller = options.controller;
  }

  transition(status: JobStatus): void {
    this.status = status;
    this.updatedAt = new Date().toISOString();
  }

  setNotice(notice: unknown): void {
    this.notice = notice;
    this.updatedAt = new Date().toISOString();
  }

  finish(status: 'done' | 'failed' | 'cancelled', result?: JobResult, error?: string): void {
    this.status = status;
    this.updatedAt = new Date().toISOString();
    if (result !== undefined) this.result = result;
    if (error !== undefined) this.error = error;
  }

  snapshot(): JobSnapshot {
    const snapshot: JobSnapshot = {
      id: this.id,
      kind: this.kind,
      owner: this.owner,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    if (this.result !== undefined) snapshot.result = this.result;
    if (this.error !== undefined) snapshot.error = this.error;
    if (this.notice !== undefined) snapshot.notice = this.notice;
    return snapshot;
  }
}

# Testing

## Principles

- **Tests describe behavior, not correctness.** Change obsolete behavior with
  its tests and explain why in the PR.
- **No network in tests.** Transport and adapter contract tests run against a
  live `node:http` mock server on 127.0.0.1 — deterministic, no mocking
  libraries, no external calls.
- **Registry contributions prove disposal.** A test disposes the
  registration and observes removal (see `provider/test/seam.test.ts`).
- **`pnpm check` is the gate**: build + typecheck + lint + test + package
  contracts. CI runs the same on Node 20/22/24.

## Where tests live

- Unit tests: `<pkg>/test/*.test.ts`, importing from `src` directly (vitest
  resolves TS; no build needed).
- Contract tests (transport/adapters): same location, spinning a
  `node:http` server per describe block with queued response handlers.
- CLI tests: real temp projects via `mkdtemp`, exercising commands end to
  end with the mock provider (`--mock`).
- Job tests: in-memory `JobRegistry` plus real `.take/jobs.json` round-trips
  in temp dirs.

## Coverage expectations by layer

| Layer | Required coverage |
| --- | --- |
| `transport/retry.ts` | backoff math, Retry-After honoring, retryable vs non-retryable, abort |
| `transport/http.ts` | status classification, attribution header, network-failure mapping, budget exhaustion |
| `adapters/openai-compatible.ts` | sync vs async-job auto-detect, empty response, in-band errors, request body fields |
| `jobs.ts` | lifecycle, owner fencing, kill, observers, persistence |
| `capabilities.ts` | resolution, unknown-model passthrough, declared-dimension validation, effect disposer |
| `config.ts` | v1 migration, v2 parse, key resolution, router chain building |
| `router.ts` | capability skip → fallback, all-skipped UNSUPPORTED, execution failover |

## Test helpers to know

- `MockProvider` / `FailingProvider` — deterministic providers for router
  tests (no network).
- `buildAdapter` injection in `buildRouterFromConfig` — swap real adapters
  for mocks in config-driven tests.
- `pollIntervalMs: 10` — fast async-job polls in adapter contract tests.

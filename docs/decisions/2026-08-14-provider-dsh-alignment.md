# Provider layer alignment with dsh

> Date: 2026-08-14 ｜ Status: active

## Context

take's provider layer grew from a simple failover router. DeepSeek Harness
(dsh) demonstrates a production-grade capability architecture (seam triangle,
stable error codes, config-driven composition, job protocol). take must stay
independent (never import dsh) while speaking dsh's vocabulary so a future
take-dsh adapter layer maps concepts instead of rewriting them.

## Decision

- Provider layer is a **seam triangle**: `ProviderSeam` (Service Definition)
  + `adapters/` (Providers) + CLI/MCP (Consumers). Consumers never depend on
  concrete adapters.
- Errors use **stable codes** (`TakeError.code`) aligned with dsh `LlmError`
  semantics (`RATE_LIMIT`/`QUOTA_EXCEEDED`/`INVALID_CREDENTIAL`/…);
  routing happens on code, never message.
- **Retry is config**: `RetryPolicy` is captured at adapter registration and
  exposed via `ProviderSeam.providerRetryPolicy()`; the executor lives
  separately in `transport/retry.ts`.
- **Jobs** (`JobRegistry`) mirror dsh `ctx.jobs` semantics (start/get/kill/
  wait, owner fencing); local persistence is `.take/jobs.json` event log.
- **Config v2** is cordis.yml-minded: ordered entry lists, `apiKeyEnv`
  credential references (never literal keys), v1 auto-migrated on load.
- Model capability metadata lives in `CapabilityRegistry` (dsh
  `resolveModelInfo` mindset: unknown models preserve capacity).

## What was given up

- No dependency on dsh packages in the core (the take-dsh adapter is a
  future separate package that only translates).
- No full Cordis runtime vendoring — take implements the vocabulary with its
  own lightweight primitives.
- No webhook job delivery yet — polling only, with the strategy seam
  reserved.

## Consequences

- A new vendor = a config entry (or one adapter class), never business-code
  edits.
- `docs/architecture-v3.md` owns the layer map and migration path P0–P8.
- Verification: `pnpm check` (89 tests) covers seam semantics, transport
  contract tests, job lifecycle, capability routing, config migration.

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- P8: take-dsh adapter layer (mount take tools into dsh `ctx.tools` / `ctx.jobs` / `ctx.skills`) — deferred until real-world validation rounds complete.
- MCP job-control tools (`jobs_list`, `jobs_resume`).
- Weighted routing among equal-priority providers.

## [0.1.0] - 2026-08-24

### Added

- **Domain core** (`@take-ai/core`): script/beat/shot/storyboard models,
  zod schemas as the single validation source, integrity checks (ordering,
  duplicate ids, dangling beat refs), 3×3 nine-grid scaffold, Markdown
  round-trip serialization, canonical project paths with upward root
  discovery (`findProjectRoot`).
- **Provider layer v3** (`@take-ai/provider`) — aligned with DeepSeek Harness
  engineering patterns:
  - Seam triangle: `ProviderSeam` (Service Definition) + adapters
    (Providers) + CLI/MCP (Consumers); effect-based registration with
    disposers; `DUPLICATE_ADAPTER` / `NO_ADAPTER` stable errors.
  - Error taxonomy: `TakeError` with stable codes matching dsh `LlmError`
    semantics and retryable/non-retryable classification driving routing.
  - Production transport: exponential backoff + jitter retry executor
    (honors `Retry-After`), token-bucket rate limiting, connect/request
    timeout tiers, mandatory attribution user-agent.
  - Universal OpenAI-compatible adapter covering most vendors
    (OpenAI / Volcengine Ark / kwjm proxies / SiliconFlow / DeepSeek);
    sync vs async-job auto-detection; configurable polling. GPT-image /
    Seedance / Minimax are thin configs over it.
  - Capability registry: exact-model metadata for builtin models; unknown
    models preserve capacity (never whitelist-rejected); capability-aware
    routing skips providers that cannot honor a request before spending
    a call.
  - Job protocol mirroring dsh `ctx.jobs`: start/get/list/kill/wait, owner
    fencing, terminal observers; `.take/jobs.json` append-only event log
    with atomic writes.
  - Shared batch orchestration: concurrency pool, idempotent resume by
    input hash (prompt+model), structured per-shot results.
  - Config v2 (cordis.yml-minded): ordered provider entry lists as failover
    chains, `apiKeyEnv` credential references (never literal keys),
    per-entry or runtime-wide retry policy; v1 auto-migrated on load.
- **CLI** (`take`): init (v2 template), validate (shots/storyboard/config,
  v1+v2), generate (`--mock` / `--resume` / `-c N`, per-shot output with
  asset paths), jobs (event-log listing), export/import, doctor; project
  root auto-discovery with friendly diagnostics.
- **MCP server** (`@take-ai/mcp`): validate_shots, generate_images,
  generate_video, export_storyboard, doctor tools over stdio.
- **Agent skill** (`skills/take`): Chinese-first SKILL.md with precise
  USE / DO NOT USE boundaries, bilingual triggers, references for workflow,
  shot-language vocabulary, model routing, output contract, end-to-end example.
- **Engineering discipline**: layered AGENTS.md (root/packages/docs),
  decision notes under docs/decisions/, package contract gate
  (`verify-package-contracts`: invariant declarations + Known Limitations
  sections), CI matrix on Node 20/22/24 running build + typecheck + lint +
  tests + contracts.

### Validated

- Round-1 real-usage validation: full pipeline on a 3-scene suspense script
  (script → 5 beats → 10 shots → validate → mock images/videos → idempotent
  resume → storyboard export → job audit log). Issues found were fixed in
  the same round (project-root detection, per-shot results).

[Unreleased]: https://github.com/XucroYuri/take/compare/0.1.0...HEAD
[0.1.0]: https://github.com/XucroYuri/take/releases/tag/0.1.0

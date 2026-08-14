# AGENTS.md

take is an agent-first storyboard & AI film production toolkit. Read
[docs/architecture.md](docs/architecture.md) and
[docs/architecture-v3.md](docs/architecture-v3.md) before changing
`packages/`; follow [docs/AGENTS.md](docs/AGENTS.md) for documentation.

## Standing rules

- **Everything is a file.** A take project is `script.md` + `shots.json` +
  `storyboard.md` + `take.config.json` + `.take/`. No hidden state, no DB.
- **The agent thinks, take renders.** Text analysis stays in the agent layer;
  never add LLM calls to `packages/core`. `packages/provider` renders only.
- **Consumers depend on seams, never concrete providers.** CLI/MCP/future
  take-dsh consume `ProviderSeam`/`ProviderRouter`/`JobRegistry`, not
  adapters. New providers = new adapter + config, never business-code edits.
- **Type safety is non-negotiable.** `strict: true`, no escaping `any`;
  `exactOptionalPropertyTypes` is on — never pass `undefined` to an optional
  field.
- **Errors carry stable codes.** Route on `TakeError.code`, never on
  `message`. Codes align with dsh `LlmError` semantics; see
  [errors.ts](packages/provider/src/errors.ts).
- **Registrations are effects.** Every `register*` returns a disposer.
- **Retry is config, not code.** Providers carry a `RetryPolicy` captured at
  registration; the executor lives in `transport/retry.ts`; entry config
  overrides runtime defaults.
- **Model IDs never leak into business code.** They are config strings
  resolved by adapters; capability checks use `CapabilityRegistry`.
- **Non-trivial changes include a decision note.** Add an entry under
  [docs/decisions/](docs/decisions/README.md) in the same PR; only
  mechanical/local edits are exempt.
- **Tests describe behavior, not correctness.** Change obsolete behavior
  with its tests and say why in the PR. Run `pnpm check` before pushing.

## Repository layout

```
packages/
  core/       domain models, zod schemas, JSON/Markdown serialization
  provider/   seam + errors + transport + adapters + jobs + capabilities +
              config + orchestration (the dsh-aligned provider layer)
  cli/        the `take` command (thin consumer)
  mcp/        MCP server (thin consumer)
skills/take/  the agent skill (SKILL.md + references)
docs/         architecture, decisions, workflow, agent integration
scripts/      repo gates (verify-package-contracts)
```

## Commands

```sh
pnpm install        # pnpm workspaces, node >=20
pnpm check          # build + typecheck + lint + test + package contracts
pnpm lint:fix       # biome autofix
pnpm --filter @take-ai/<pkg> test   # one package
```

## Conventions

- ESM everywhere (`"type": "module"`); `.js` suffixes in relative imports.
- Tests live in `<pkg>/test/*.test.ts`, importing from `src` directly.
- Transport/adapters contract tests use a live `node:http` mock server —
  no network in tests, no mocking libraries.
- README and JSDoc update in the same commit as behavior changes.
- Package READMEs carry `## Known Limitations and Deferred Work` (or a
  justified entry in `scripts/verify-package-contracts.ts`).

## Editing these instructions

Keep each rule self-contained and link the owning document. Condense when
clarity survives; this file stays under ~500 words.

# AGENTS.md — Packages

These package rules supplement the repo-wide [AGENTS.md](../AGENTS.md).

- **Plugin exports:** seam packages export their service classes; function
  plugins named-export `name` / `inject` / `Config` / `apply` and have no
  default export.
- **Optional services use explicit checks** (`has`/`get`), never silent
  fallbacks at call sites; defaulting is an explicit resolve step in the
  owning implementation.
- **A capability seam comprises Service Definition / Provider / Consumer
  roles.** Adding a capability means designing all three; one role alone is
  not a seam. `provider/seam.ts` owns the Definition, `adapters/` own
  Providers, `cli` + `mcp` own Consumers.
- **Design Service Definitions for all current Consumers.** Keep
  tool-schema, transport, and provider-specific behavior in the Consumer or
  provider; do not let one Consumer dictate the service contract.
- **Registry contributions prove disposal** through a test: dispose the
  registration and observe removal (see `test/seam.test.ts`).
- **Every package owns a runtime invariant statement.** Declare it in
  `package.json` under `take.invariant` (a checkable relationship) or give a
  justified `take.invariantNone` reason; `verify-package-contracts` enforces
  it.
- **Package READMEs carry `## Known Limitations and Deferred Work`** or an
  allowlisted justification; durable consumer gaps and non-obvious
  maintainer constraints go there, ordinary cleanup stays in TODO.
- **Model-facing contracts are written from the model's perspective.**
  Prompts, tool schemas, results contain only task-relevant concepts, not
  UI/transport/implementation vocabulary.
- **Publish state only at its commit point.** Emit notifications and update
  derived state after the operation succeeds.

## Naming rules

- Package tsconfig extends `tsconfig.base.json` with `rootDir: src`,
  `outDir: dist`; `types: ["node"]` where Node APIs are used.
- `src/index.ts` is the aggregate export; internal modules stay
  implementation details unless exported through it.
- Tests live at package level under `test/`, not `src/__tests__/`.

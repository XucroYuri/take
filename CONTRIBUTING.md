# Contributing to take

Thanks for wanting to make `take` better. This project follows a few rules to
keep the codebase small, typed and reliable.

## Ground rules

- **Everything is a file.** No hidden state. Projects are directories with
  `script.md`, `shots.json`, `storyboard.md` and `take.config.json`.
- **The agent thinks, `take` renders.** Text analysis stays in the agent
  layer; `take` provides models, validation and rendering. Do not add
  LLM calls to `packages/core`.
- **Type safety is non-negotiable.** `strict: true`, no `any` escaping.
- **Tests accompany logic.** New domain logic goes into `packages/core` with
  Vitest tests.

## Development workflow

```bash
pnpm install
pnpm typecheck   # strict TS across all packages
pnpm lint        # biome
pnpm test        # vitest
pnpm build       # tsc build of all packages
```

## Project structure

```
packages/
  core/       # domain models, zod schemas, JSON/Markdown serialization
  provider/   # provider interfaces, clients, failover router
  cli/        # the `take` command
  mcp/        # MCP server
skills/
  take/       # the agent skill (SKILL.md + references)
docs/         # architecture, model routing, workflows
```

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make focused changes with tests.
3. Run the full check suite above.
4. Open a PR. Keep the description to *what* changed and *why*.

## Issues

Use the issue templates. Bugs need a repro; feature requests need a use case.

## Code of conduct

Be respectful. This is a small, focused project — disagreements are fine,
personal attacks are not.

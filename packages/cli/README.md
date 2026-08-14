# @take-ai/cli

The `take` command — a thin consumer over `@take-ai/provider` and
`@take-ai/core`.

## Commands

```
take init <name>              scaffold a project (v2 config template)
take validate [file] [-c]     validate shots.json / storyboard.md / config
take generate <stage>         images | video (--mock / --resume / -c N)
take jobs                     list jobs from the .take/jobs.json event log
take export <direction>       storyboard (export) | import
take doctor                   provider configuration + connectivity
```

## Rules

- Commands are thin: logic lives in provider orchestration; the CLI parses
  args, prints results, exits with status.
- Every command exits 0 on success or prints a diagnosis and exits non-zero.

## Known Limitations and Deferred Work

- **`generate` job ids are process-local.** `take jobs` reads the event log,
  but live cancellation across processes is not wired (kill is in-process).
- **No `take config set` yet.** Editing `take.config.json` is manual; a
  config-edit command is deferred.

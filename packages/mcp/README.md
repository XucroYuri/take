# @take-ai/mcp

MCP server (stdio) exposing take tools to MCP-capable agents (Claude Code,
Codex, zcode, ...). Thin wrappers over the shared provider orchestration.

## Tools

- `validate_shots` — validate shots.json / storyboard.md / take.config.json
- `generate_images` — render approved shots via the image provider
- `generate_video` — render approved shots via the video provider
- `export_storyboard` — shots.json → storyboard.md
- `doctor` — provider configuration + connectivity

## Rules

- Every tool call returns a `CallToolResult`; unknown tools return `isError`.
- Tools never duplicate orchestration logic — they wrap
  `@take-ai/provider`'s shared layer.

## Known Limitations and Deferred Work

- **No job-control tools yet.** `list_jobs`/`resume` are exposed via the CLI;
  MCP equivalents (`jobs_list`, `jobs_resume`) are deferred.
- **cwd is fixed at server start.** Project selection across multiple
  take projects is not yet a tool parameter.

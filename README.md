# take

> **Take your script to the screen.**

`take` is an **agent-first storyboard & AI film production toolkit**. It turns a
screenplay into shot-by-shot storyboards and finished video — running natively
inside your coding agent (Claude Code, Codex, OpenCode, zcode), not as yet
another web app.

```
script.md ──▶ beats ──▶ shots ──▶ storyboard ──▶ images ──▶ video
   │            │          │           │            │         │
   └────────────┴──────────┴───────────┴────────────┴─────────┘
                        everything is a file, nothing is a silo
```

## Why agent-first?

Storyboarding is a *reasoning* problem before it is a *rendering* problem.
The best storyboard model available today is the one already sitting inside
your agent. So `take` does not wrap text analysis in another API call:

- **Script analysis, beats, shot language** — done by **the agent's own model**,
  guided by the `take` skill and its shot-language reference.
- **Image generation** — routed to **GPT-image-2** (best-in-class for
  production stills), with configurable fallbacks.
- **Video generation** — routed to **Seedance 2.0 / 2.5** (primary) and
  **Minimax H3** (fallback), through a failover provider router.

The agent thinks. `take` renders. The frontend, if you ever want one, is a
detachable shell.

## What's inside

| Package | Purpose |
| --- | --- |
| `packages/core` | Pure domain model: script → beat → shot → storyboard. Zod-validated, serialized to JSON/Markdown. Zero I/O, zero AI. |
| `packages/provider` | dsh-aligned provider layer: seam triangle, stable error codes, production transport (retry/rate-limit/attribution), universal OpenAI-compatible adapter, capability-aware routing, job registry, config v2. |
| `packages/cli` | `take` command: init / validate / generate / jobs / export / doctor. |
| `packages/mcp` | MCP server exposing `take` tools to any MCP-capable agent. |
| `skills/take` | The agent skill: workflow, shot-language reference, output contract. |

## Quick start

```bash
# 1. Scaffold a project
npx @take-ai/cli init my-film
cd my-film

# 2. Open it in your agent and let the agent do the thinking:
#    "分镜这个故事"  (Claude Code / OpenCode)
#    or load the skill: /take

# 3. Validate what the agent produced
take validate shots.json

# 4. Render (offline smoke first — no API keys needed)
take generate images --mock
take generate video --mock

# 5. Real render — concurrent, resumable
take generate images
take generate video --resume -c 4

# 6. Inspect & export
take jobs                 # audit log of every job event
take export storyboard    # human-readable storyboard.md
```

Commands walk up from your current directory to find the project root, so
they work from any subdirectory.

### Install the skill (agents)

| Agent | Location |
| --- | --- |
| Claude Code | `~/.claude/skills/take/` |
| OpenCode | `~/.config/opencode/skill/take/` or project `.opencode/skill/take/` |
| zcode / others | follow the same `SKILL.md` convention |

### Mount the MCP server

```json
{
  "mcpServers": {
    "take": {
      "command": "npx",
      "args": ["@take-ai/mcp"]
    }
  }
}
```

## Model routing

| Capability | Primary | Fallback | Notes |
| --- | --- | --- | --- |
| Image | `gpt-image-2` | configurable entry | via OpenAI-compatible endpoints |
| Video | `seedance-2.5` / `seedance-2.0` | `minimax-h3` | Sora2 is deprecated and **not** supported |
| Text/analysis | **agent's own model** | — | no API key needed, no lock-in |

Routing is capability-aware: before spending a call, the router checks the
model's declared capabilities (durations, aspect ratios, resolutions) and
skips providers that cannot honor the request. Unknown models are never
rejected — capacity is simply unknown and left to the adapter.

Providers are configured as ordered failover chains in v2 config; secrets are
environment-variable references (`apiKeyEnv`), never literal keys:

```jsonc
{
  "version": 2,
  "providers": {
    "video": [
      { "id": "seedance", "adapter": "seedance", "apiKeyEnv": "TAKE_VIDEO_API_KEY", "model": "seedance-2.5" },
      { "id": "minimax", "adapter": "minimax", "apiKeyEnv": "TAKE_FALLBACK_VIDEO_API_KEY", "model": "minimax-h3" }
    ]
  },
  "runtime": { "concurrency": 2, "maxRetries": 2 }
}
```

See [docs/models.md](docs/models.md) for the full environment contract.

## Development

```bash
pnpm install
pnpm check        # build + typecheck + lint + test + package contracts
pnpm lint:fix     # biome autofix
pnpm --filter @take-ai/<pkg> test   # one package
```

## License

MIT — see [LICENSE](LICENSE).

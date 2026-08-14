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
| `packages/provider` | Provider abstraction + failover router. GPT-image-2 (image), Seedance 2.0/2.5 & Minimax H3 (video). |
| `packages/cli` | `take` command: init / validate / generate / export / doctor. |
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

# 4. Render
take generate images
take generate video
```

### Install the skill (agents)

| Agent | Location |
| --- | --- |
| Claude Code | `~/.claude/skills/take/` |
| OpenCode | `~/.config/opencode/skills/take/` or project `.opencode/skills/take/` |
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
| Image | `gpt-image-2` | `gemini-2.5-flash-image` | via OpenAI-compatible endpoints |
| Video | `seedance-2.5` / `seedance-2.0` | `minimax-h3` | Sora2 is deprecated and **not** supported |
| Text/analysis | **agent's own model** | — | no API key needed, no lock-in |

Configuration lives in `take.config.json` / environment variables. See
[docs/models.md](docs/models.md).

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## License

MIT — see [LICENSE](LICENSE).

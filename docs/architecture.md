# Architecture

`take` is a layered monorepo with a hard rule: **the agent thinks, take renders.**

```
┌────────────────────────────────────────────────────────┐
│                    Agent layer (external)               │
│   Claude Code · Codex · OpenCode · zcode                │
│   ┌──────────────┐   ┌───────────┐   ┌────────────┐    │
│   │ skills/take  │   │ take CLI  │   │ take MCP   │    │
│   │ (SKILL.md +  │   │ (commander)│  │ (stdio srv)│    │
│   │  references) │   └─────┬─────┘   └─────┬──────┘    │
│   └──────┬───────┘         │               │           │
└──────────┼─────────────────┼───────────────┼───────────┘
           │                 │               │
┌──────────▼─────────────────▼───────────────▼───────────┐
│                    @take-ai/core                        │
│   domain models (script/beat/shot/storyboard)           │
│   zod schemas · validation · markdown/json io · grid    │
│   ⚠ pure: no I/O, no network, no AI                     │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   @take-ai/provider                      │
│   Provider<T> abstraction · failover router              │
│   ├─ GptImageProvider   (gpt-image-2)         [image]   │
│   ├─ SeedanceProvider   (seedance-2.x)        [video]   │
│   ├─ MinimaxProvider    (minimax-h3)          [video]   │
│   └─ MockProvider / FailingProvider (tests)             │
└──────────────────────────────────────────────────────────┘
```

## Design decisions

### 1. Text analysis lives in the agent, not in take

The strongest storyboard model is the one already inside the user's agent.
`take` deliberately ships **no LLM client for analysis**. The skill guides the
agent (prompting, shot-language vocabulary, output contract); core validates
what the agent produced; provider renders it. Consequences:

- zero analysis API cost and latency
- no vendor lock-in for the "thinking" part
- the user can swap agents (Claude Code → OpenCode) without changing anything

### 2. Everything is a file

A take project is a directory:

```
script.md            # screenplay (input)
take.config.json     # project config: routing, defaults
shots.json           # structured storyboard (agent output, validated)
storyboard.md        # human-readable export (round-trippable)
assets/images|videos # rendered media
```

No database, no server, no hidden state. This is what makes the CLI, MCP and
skill interchangeable — they all read and write the same files.

### 3. Model routing is configuration, never code

`seedance-2.5`, `minimax-h3`, `gpt-image-2` are strings in
`take.config.json`/env, consumed by provider factories. The router knows only
capabilities (`image`/`video`) and failover order. When Seedance 2.6 ships,
the diff is one line of config.

### 4. The frontend is a detachable shell

There is no frontend in this repo — deliberately. `core` + `provider` are the
product. Any future Studio UI (web or desktop) consumes the same files and
the same contracts, and can be developed, versioned and distributed
independently.

## Package boundaries

| Package | Depends on | Owns |
| --- | --- | --- |
| `@take-ai/core` | zod | models, schemas, validation, serialization, grid |
| `@take-ai/provider` | core | provider contracts, HTTP clients, router, mock |
| `@take-ai/cli` | core, provider | commands, project lifecycle |
| `@take-ai/mcp` | core, provider | MCP tools (thin wrappers) |
| `skills/take` | — (docs only) | workflow, shot language, output contract |

## Error philosophy

- Domain errors surface as validation issues (structured, with paths).
- Provider errors surface as `HttpError` with status/body; the router converts
  them into failover decisions.
- `take doctor` is the canonical diagnostics entry point.

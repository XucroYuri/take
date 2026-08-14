# Agent integration

`take` is designed to be installed **inside** coding agents. This page covers
every supported integration surface.

## 1. Agent Skill (primary)

The skill is a directory with a `SKILL.md` front-matter manifest and
`references/` docs. Any agent that supports the skills convention can load it.

### Claude Code

```bash
mkdir -p ~/.claude/skills
cp -R skills/take ~/.claude/skills/take
# restart the session; then ask: "分镜这个故事"
```

### OpenCode

```bash
mkdir -p ~/.config/opencode/skills
cp -R skills/take ~/.config/opencode/skills/take
```

or per-project: `.opencode/skills/take/`.

### zcode / others

Follow the same `SKILL.md` convention. The skill only instructs the model and
references local files — no runtime dependency.

## 2. MCP server

Exposes tools: `validate_shots`, `generate_images`, `generate_video`,
`export_storyboard`, `doctor`.

```json
{
  "mcpServers": {
    "take": {
      "command": "npx",
      "args": ["-y", "@take-ai/mcp"]
    }
  }
}
```

The server runs on stdio with the project directory as cwd, so tools operate
on the same files the agent sees.

## 3. CLI

```bash
npm i -g @take-ai/cli        # or: npx @take-ai/cli ...
take init my-film
cd my-film
take validate
take generate images --mock # offline smoke test
take generate video
take export storyboard
take doctor
```

## 4. Plugin (planned)

Codex plugin marketplace distribution is on the roadmap. The plugin will wrap
the same core, exposing `take` as an installable command/skill bundle.

## Which surface when?

| Context | Recommended surface |
| --- | --- |
| Agent conversation (Claude Code / OpenCode / zcode) | **skill** — analysis + orchestration |
| Agent with MCP support (Codex, some setups) | **MCP** — tool calls with schema validation |
| Terminal / scripts / CI | **CLI** |
| GUI (future) | Studio shell consuming core+provider |

All surfaces share the same file contracts — a project created by the CLI is
instantly usable from the skill and vice versa.

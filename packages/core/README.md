# @take-ai/core

Pure domain model for take: script → beat → shot → storyboard. Zod-validated,
serialized to JSON/Markdown. **Zero I/O, zero AI, zero dependencies beyond zod.**

## What it owns

- `models/` — domain types (Script, Beat, Shot, Storyboard, ProjectConfig)
- `schemas.ts` — zod schemas (single validation source)
- `validate.ts` — schema + integrity validation (ordering, duplicate ids,
  dangling beat refs)
- `grid.ts` — 3×3 nine-grid scaffold derivation
- `io/` — Markdown round-trip, canonical project paths

## Rules

- Never add I/O, network, or LLM calls here. The agent thinks; take renders.
- Any new domain field is added to the zod schema in the same change.

## Known Limitations and Deferred Work

- **No audio/voice blocks.** The content model is image/video oriented; voice
  timing lives in the skill layer for now.
- **Nine-grid is a scaffold, not a generator.** `buildShotGrid` derives cell
  prompts deterministically; agent overrides are not persisted per-cell.

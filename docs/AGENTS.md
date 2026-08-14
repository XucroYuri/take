# AGENTS.md — Documentation

The documentation standard for take. Keep docs current, layered, and
machine-checkable where possible.

## Layering — one home per fact

| Tier | Job |
| --- | --- |
| Root `AGENTS.md` | Standing orders agents need in every session (≤500 words) |
| `docs/architecture.md` | Ordered map: layers, packages, seams, extension points |
| `docs/architecture-v3.md` | Provider-layer v3 design and P0–P8 migration path |
| `docs/decisions/` | Active decision records (why; what was given up) |
| Package README | Per-package contract: purpose, extension points, Known Limitations |
| `skills/take/` | The agent-facing product knowledge (SKILL.md + references) |

## Writing rules

- **Document current state, not change history.** No "previously/now/no
  longer", no PR numbers, no commit positions in durable prose.
- **One physical line per paragraph.**
- **Fenced `ts` blocks must compile.** If a pasted declaration drifts from
  source, fix or remove it in the same change.
- **README and JSDoc update in the same commit as behavior changes.**
- **Non-trivial changes include a decision note** in
  `docs/decisions/` (see its README).
- **Comments state complete contracts, not reasoning transcripts.** Preserve
  behavior, failure, timing, ownership facts; delete narration and test
  walkthroughs.
- **Reserve `seam` for the defined capability.** Name the exact check, type,
  or API instead of metaphorical "gate"/"surface"/"vocabulary".
- **Cross-reference with relative Markdown paths**, never bare filenames.

## The slop checklist

Hunt these in any doc:

- The same rule stated in more than one home.
- Narrated history: "previously", "now", "used to", PRs, commits.
- Hand-restated catalogs when source or a generator is authoritative.
- Reasoning transcripts: step-by-step implementation narration.
- Paragraph walls carrying several rules.
- Emphasis inflation: bold/CAPS everywhere means nothing stands out.

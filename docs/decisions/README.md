# Decision Notes

Active decision records for take. Each note captures **what was decided, what
was given up, and why** — the durable rationale behind a non-trivial change.
Follow the [template](_template.md).

## Rules

- Every non-trivial change includes a decision note in the same PR; only
  mechanical/local edits are exempt.
- Notes describe **current state in present tense** — no "previously/now",
  no PR numbers, no change history. Change stories live in commits.
- A note is frozen once superseded: move it under `archive/` and never edit
  it as current authority.
- One home per fact: if a rule now lives in `AGENTS.md` or a package README,
  the note links there instead of restating it.

## Index

| Date | Decision | Status |
| --- | --- | --- |
| 2026-08-14 | [Provider layer alignment with dsh (seam triangle, stable error codes, jobs, config v2)](2026-08-14-provider-dsh-alignment.md) | active |

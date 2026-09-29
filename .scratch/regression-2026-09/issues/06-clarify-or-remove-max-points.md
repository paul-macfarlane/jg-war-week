# 06: Clarify or remove Competition "Max points"

**What to build:** "Max points" on a Competition isn't clear to an Organizer. Today it only bounds the Placement Points rows (`src/components/placement-points-rows.tsx:59`) and Points Entry.

**Blocked by:** none

**Status:** ai-review

**Source:** regression feedback item 11

## Notes

Per the scope rule, prefer removing it. If it stays, it needs help text saying exactly what it limits.

## Acceptance criteria

- [ ] Either the field is gone (schema contract step planned and red-teamed), or the form explains what it limits.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul): **keep the field, explain it.** Help text states exactly what Max points bounds (1st place's Placement Points and any single Points Entry for the Competition). No schema change. `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.

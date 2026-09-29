# 07: Record a Bracket result in a dialog on large screens

**What to build:** Recording a Bracket result in a bottom sheet is awkward on larger screens.

**Blocked by:** none

**Status:** in-progress

**Source:** regression feedback item 13

## Notes

Use a centered dialog at `lg` and up and keep the sheet on phones (shadcn Drawer/Dialog responsive pattern).

## Acceptance criteria

- [ ] At desktop width, recording a result opens a dialog; at phone width, a sheet.
- [ ] The Bracket Playwright flow still passes.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul, via `/atlas-implement` of Epic R1): `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).

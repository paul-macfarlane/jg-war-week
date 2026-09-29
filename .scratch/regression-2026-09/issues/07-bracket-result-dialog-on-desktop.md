# 07: Record a Bracket result in a dialog on large screens

**What to build:** Recording a Bracket result in a bottom sheet is awkward on larger screens.

**Blocked by:** none

**Status:** done

**Source:** regression feedback item 13

## Notes

Use a centered dialog at `lg` and up and keep the sheet on phones (shadcn Drawer/Dialog responsive pattern).

## Acceptance criteria

- [x] At desktop width, recording a result opens a dialog; at phone width, a sheet.
- [x] The Bracket Playwright flow still passes.
- [x] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul, via `/atlas-implement` of Epic R1): `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. Verified at `968c733` (`pnpm gate`, exit 0; `test-results/r1-gate/gate.txt`). Evidence per criterion, the AI Code Review, and deviations: `../epics/R1-execution.md` ([AI CODE REVIEW], [CLOSEOUT]). PR: https://github.com/paul-macfarlane/jg-war-week/pull/91

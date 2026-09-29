# 10: See where points came from

**What to build:** On the individual leaderboard and the Team Standings, expanding a row should show the Points Entries behind the total, newest first.

**Blocked by:** none

**Status:** done

**Source:** regression feedback item 4

## Notes

Participants want to know why they have the points they have. Data already exists as Points Entries.

## Acceptance criteria

- [x] Expanding a Participant or Team shows each contributing Points Entry (Competition, points, when), newest first.
- [x] Totals in the breakdown match the row.
- [x] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul, via `/atlas-implement` of Epic R1): `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. Verified at `968c733` (`pnpm gate`, exit 0; `test-results/r1-gate/gate.txt`). Evidence per criterion, the AI Code Review, and deviations: `../epics/R1-execution.md` ([AI CODE REVIEW], [CLOSEOUT]). PR: https://github.com/paul-macfarlane/jg-war-week/pull/91

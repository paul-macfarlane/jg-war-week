# 05: End War Week shows the Winner from points

**What to build:** Ending a War Week asks the Organizer to type the Winner. The Winner should come from the Standings: the rank-1 Team (or Participant in free-for-all), or a tie declared when rank 1 is shared.

**Blocked by:** none

**Status:** done

**Source:** regression feedback item 7

## Notes

`defaultWinner()` (`src/lib/war-week-lifecycle.ts:167`) already computes this and joins ties with " & ", but the dialog shows it as editable text. Decide in triage whether an Organizer override survives.

## Acceptance criteria

- [x] The End War Week dialog shows the computed Winner read-only.
- [x] A shared rank 1 shows as a tie (e.g. "Tie: A & B") and is recorded as such in the Archive.
- [x] Unit tests cover single winner and tie.
- [x] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul): read-only, **no Organizer override**. The Winner is exactly `defaultWinner()`: rank 1, or a shared rank 1 recorded as `Tie: A & B`. `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. Verified at `968c733` (`pnpm gate`, exit 0; `test-results/r1-gate/gate.txt`). Evidence per criterion, the AI Code Review, and deviations: `../epics/R1-execution.md` ([AI CODE REVIEW], [CLOSEOUT]). PR: https://github.com/paul-macfarlane/jg-war-week/pull/91

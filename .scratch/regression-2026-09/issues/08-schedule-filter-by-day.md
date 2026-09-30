# 08: Filter the Schedule by day

**What to build:** The Schedule shows every day. Keep "All" as the default and add a way to filter to one day.

**Blocked by:** none

**Status:** done

**Source:** regression feedback item 5

## Notes

Day chips above the list; the existing day anchors and scroll-to-today stay.

## Acceptance criteria

- [x] The Schedule defaults to All.
- [x] Choosing a day shows only that day; the choice is reflected in the URL.
- [x] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul, via `/atlas-implement` of Epic R1): `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. Verified at `968c733` (`pnpm gate`, exit 0; `test-results/r1-gate/gate.txt`). Evidence per criterion, the AI Code Review, and deviations: `../epics/R1-execution.md` ([AI CODE REVIEW], [CLOSEOUT]). PR: https://github.com/paul-macfarlane/jg-war-week/pull/91

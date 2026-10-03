# 89: Games settings show what was saved

**What to build:** Paul created a Games Competition, set scoring to "5, 3, 1", saved, closed, and on reopening the setting was empty. Reproduce and fix. Leads: `GamesBuilder`'s `useState(initialFields…)` (`src/components/games-builder.tsx:182`) never resyncs after `router.refresh()`; Finish Points ("5, 3, 1" placeholder) and Placement Points (the Competition sheet) are two different fields, so the value may have gone into the other one; a trailing comma parses as 0 (`src/lib/games/input.ts:239`).

**Blocked by:** none

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: games scoring not shown after reopen)

## Decisions

- R16 (`93`) removes Finish Points and R18 (`101`) replaces these forms; this ticket fixes the resync now so Games stay usable until then, and records the reproduction for R18's tests.

## Acceptance criteria

- [x] Reproduction steps recorded in the closeout.
- [x] e2e: set Games settings and Placement Points, save, leave and come back: both show what was saved.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r15`): claimed with Epic R15; `ready-for-agent` → `in-progress`. Execution record: [`R15-execution.md`](../epics/R15-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r15`): done.

  Reproduction (from code and failing tests; not seen in the running app before the fix):
  1. `/admin/competitions/<id>/games` on a Games Competition: type "5, 3, 1" in Finish Points, Save settings. The save stores `{finishPoints:[5,3,1]}` and calls `router.refresh()`.
  2. `GamesBuilder` held its fields in `useState(initialFields…)` read once, so after the refresh the form kept what it first loaded; a form opened before the value existed stayed empty although the database held it. Failing test: mount with `[]`, re-render with `[5,3,1]`, field stays "".
  3. "5, 3, 1," stored `[5,3,1,0]` (an empty entry parsed as 0). Failing unit test in `input.test.ts`.
  4. Finish Points (per Game, Games page) and Placement Points (Standings, the Competition's Edit sheet) had no text saying which was which, so "5, 3, 1" could have gone into the other. Placement Points itself already showed its saved value on reopen.
  A fresh page load always showed the saved Finish Points, so Paul's empty field is best explained by 2 (stale form after saving) or 4 (the other field).

  Fix: the form re-derives its fields when the saved values change (edits survive an unrelated refresh), empty entries are ignored, and both fields' descriptions say which is which. Tests: `games-builder.test.tsx`, `games-builder.refresh.test.tsx`, `input.test.ts`; e2e `e2e/regression-r15-games-settings.spec.ts` (save, leave, return: both fields show what was saved). R18's tests should keep this case.

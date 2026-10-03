# 89: Games settings show what was saved

**What to build:** Paul created a Games Competition, set scoring to "5, 3, 1", saved, closed, and on reopening the setting was empty. Reproduce and fix. Leads: `GamesBuilder`'s `useState(initialFields…)` (`src/components/games-builder.tsx:182`) never resyncs after `router.refresh()`; Finish Points ("5, 3, 1" placeholder) and Placement Points (the Competition sheet) are two different fields, so the value may have gone into the other one; a trailing comma parses as 0 (`src/lib/games/input.ts:239`).

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: games scoring not shown after reopen)

## Decisions

- R16 (`93`) removes Finish Points and R18 (`101`) replaces these forms; this ticket fixes the resync now so Games stay usable until then, and records the reproduction for R18's tests.

## Acceptance criteria

- [ ] Reproduction steps recorded in the closeout.
- [ ] e2e: set Games settings and Placement Points, save, leave and come back: both show what was saved.
- [ ] `pnpm gate` passes.

# 41: The Squad Bracket e2e test cleans up after itself

**What to build:** `e2e/bracket-squads.spec.ts` removes the Squads, Bracket and Points Entries it creates, so it can run again without a fresh seed.

**Blocked by:** none

**Status:** done

**Source:** Epic R5 follow-up (`../epics/R5-execution.md` D0), 2026-09-30

## Need

- **Maintainer:** Diagnosing a flaky test means running it several times. `pnpm e2e e2e/bracket-squads.spec.ts --repeat-each=5` fails on repeat 2 with "Sam Schantz is already in Red Alpha." (`src/lib/bracket/squads.ts:74`): the test's `finally` (`e2e/bracket-squads.spec.ts:453`) restores Participant emails and the Host row, but leaves the four Squads, the Bracket and its Points Entries, and the seed reset runs once per process (`e2e/global-setup.ts`). R5 D0 had to prove the fix with five separate runs instead.

## Decisions

- Delete what the test creates, in `finally`, by the ids it creates (as `regression-r5.spec.ts` does); never touch seeded rows other specs read. Restore the Competition's `placement_points` to its seeded value.
- Test-only change; no app change.

## Acceptance criteria

- [x] `pnpm e2e e2e/bracket-squads.spec.ts --repeat-each=3` passes every repetition in one process.
- [x] The full `pnpm e2e` still passes.
- [x] `pnpm gate` passes.

## Comments
- 2026-09-30 (Paul): triaged `needs-triage` → `ready-for-agent`; delivered in Epic R6 (`../epics/R6-follow-ups-from-r5.md`).
- 2026-09-30: claimed, `ready-for-agent` → `in-progress`; branch `feat/regression-r6-follow-ups` from `staging` `d9b2a88`.
- 2026-09-30 [CLOSEOUT]: `685c9f3`: `finally` snapshots and restores Cypher's settings and deletes its Heats, Entrants, Squads and generated Points Entries. `pnpm e2e e2e/bracket-squads.spec.ts --repeat-each=3`: 1 passed, 2 failed before; 3 passed after; Cypher back to seed (Format points, no Placement Points, no rows left). Evidence `e2e/bracket-squads.spec.ts`; `pnpm format:check && pnpm gate` exit 0 at `d9be4c4` (`test-results/r6-gate/gate.txt`: 3121 unit, smoke 201 ok, e2e 53 passed). Small-change route (no separate AI code review, per Paul). `in-progress` → `done`.

# 24: End War Week warns about open Games Competitions

**What to build:** The End War Week dialog lists `games` Competitions still open, as it already does for unfinalized Brackets.

**Blocked by:** none

**Status:** done

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Organizer:** Ending a War Week with an open `games` Competition gives no warning, so its Placement Points never reach the Standings unless the Host closes it (CONTEXT.md "Games rules": it keeps taking Games until closed). Deferred in Epic R3 (plan decision 18).

## Acceptance criteria

- [ ] The End War Week dialog lists each open `games` Competition with a link to its Games setup page, beside the unfinalized-Bracket warning.
- [ ] Unit test for the query; e2e or smoke check of the dialog copy.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-29 (Paul): triaged `ready-for-agent`; delivered in Epic R4 (`../epics/R4-follow-ups-from-r3.md`).
- 2026-09-29: claimed by `/atlas-implement` (work package `regression-r4`), `ready-for-agent` → `in-progress`; branch `feat/regression-r4-follow-ups` from `staging` `8c57be6` (R3 merged, PR #92). Execution record: `../epics/R4-execution.md`.
- 2026-09-29 [AI CODE REVIEW]: T4 (Bracket case false-green), S1 (inverted JSDoc), S8, S9, S11, S12 resolved. T5 (no combined render test) approved as a deviation. Full tables: `../epics/R4-execution.md` [AI CODE REVIEW].
- 2026-09-29 [CLOSEOUT]: criteria 24-1..24-3 PASS; `pnpm format:check && pnpm gate` exit 0 at `ba3b657` (`test-results/r4-gate/gate.txt`). PR https://github.com/paul-macfarlane/jg-war-week/pull/93. `ai-review` → `done`. Details: `../epics/R4-execution.md` [CLOSEOUT].

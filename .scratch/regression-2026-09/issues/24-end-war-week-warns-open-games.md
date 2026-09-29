# 24: End War Week warns about open Games Competitions

**What to build:** The End War Week dialog lists `games` Competitions still open, as it already does for unfinalized Brackets.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Organizer:** Ending a War Week with an open `games` Competition gives no warning, so its Placement Points never reach the Standings unless the Host closes it (CONTEXT.md "Games rules": it keeps taking Games until closed). Deferred in Epic R3 (plan decision 18).

## Acceptance criteria

- [ ] The End War Week dialog lists each open `games` Competition with a link to its Games setup page, beside the unfinalized-Bracket warning.
- [ ] Unit test for the query; e2e or smoke check of the dialog copy.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-29 (Paul): triaged `ready-for-agent`; delivered in Epic R4 (`../epics/R4-follow-ups-from-r3.md`).

# 15: Participants enroll themselves in Competitions

**What to build:** A per-Competition switch that lets Participants enter (and withdraw from) fixed-list Competitions themselves, so the Organizer and Host don't add every Entrant by hand. Manual add stays. Decisions: `../grilling-2026-09-28.md` (Q32–Q38); access: ADR 0006.

**Blocked by:** 17 (fixed-list `games` Competitions are one of the targets)

**Status:** in-progress (claimed by Atlas `/atlas-implement`, work package `regression-r3`)

**Source:** regression feedback item 12

## Scope

- "Participants can enroll" switch, off by default, on Brackets and fixed-list `games` Competitions.
- Enrollment closes at the first of: Bracket built, optional Entrant limit reached, optional close time, closed by the Host, first Game logged (`games`). Best of X is never self-enrolled.
- Team scoring: any Participant on a Team enters or withdraws their Team. Squads Brackets: join or leave a Squad the Host created.
- Withdraw until enrollment closes; afterwards only the Host or an Organizer removes an Entrant.
- **Squad** help text wherever Squads appear: "a pair or group from one Team, playing as one entrant".

## Acceptance criteria

- [ ] Access unit tests per ADR 0006: switch off refuses; account linking required (pick grants nothing); each close condition refuses; team and Squad cases; withdraw before and after close.
- [ ] Playwright: a Participant enrolls in a Bracket, withdraws, re-enrolls; the Host builds the Bracket and enrollment is refused afterwards. Screenshots under `test-results/e2e/<test>/`.
- [ ] Squad help text shows in setup and on the Competition page.
- [ ] Schema change and demo seed updated together; plan red-teamed.
- [ ] `/about` and `docs/maintainers-guide.md` updated.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-29: Technical plan and red-team record for Epic R3 (tickets 17 and 15) in [`../epics/R3-execution.md`](../epics/R3-execution.md); approved by Paul. Ready to implement.
- 2026-09-29: claimed by Atlas (`/atlas-implement`, work package `regression-r3`, Epic R3) — `ready-for-agent → in-progress` on `feat/regression-r3-games`; starts after ticket 17's access facets are integrated on the branch.

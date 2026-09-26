# 13: Test net: domain gaps and Playwright flows

**What to build:** Enough automated safety to refactor (11, 12) and add features (16) without regressions.

**Blocked by:** 03, 06

**Status:** ready-for-agent

## Scope

- **Vitest domain gaps:**
  - a `getStandings` query test that the join is scoped to one War Week
  - Standings with negative points
  - a team-targeted entry on an individual Competition being refused
  - Counts Toward Team for a Participant with no Team
  - Bracket: editing Placement Points after finalize (refused, from 05)
  - Bracket: a manual Points Entry racing a finalize
  - Bracket: a re-record that keeps the same winner (07)
- **Playwright**, about five flows, against local Postgres with the demo seed and a stubbed JG session (no real Google):
  1. A non-JG session is refused, and anonymous visitors are sent to `/sign-in`.
  2. Points Entry → Standings update on `/xi/leaderboard`.
  3. A Bracket is built, results are recorded, it advances and finalizes, and Points Entries appear.
  4. The Finale plays and ends on first place.
  5. The Archive renders each past edition.
- Add Playwright to CI after smoke (ticket 06). Screenshots go to `test-results/<test-name>/` per `docs/agents/testing.md`.
- Update the `docs/agents/testing.md` command table with the new `e2e` command.

## Acceptance criteria

- [ ] The five flows pass locally and in CI.
- [ ] The new vitest cases pass and fail when the rule they cover is broken (check one of them by hand).
- [ ] `pnpm gate` includes the Playwright run and passes.

## Comments

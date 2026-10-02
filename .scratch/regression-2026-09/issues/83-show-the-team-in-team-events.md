# 83: Show a person's Team wherever they compete or score in a teams War Week

**What to build:** In a teams War Week, every place a Participant appears in a Competition or scoring context shows which Team they're on: by the Team name where there's room (as the individual leaderboard already does with its Team tag), and at least by the Team-colored Avatar where there isn't. Audit every such surface against the rule in `CONTEXT.md` ("Competition and roster display rules": the Team shows in team events), list the ones that fall short, and fix them.

**Blocked by:** none

**Status:** needs-triage

**Source:** Paul, 2026-10-02 (during R10): "in a team event, in competition and scoring context, we show a person's team or indicate it somehow."

## Need

- **Participant:** see at a glance which Team someone in a Bracket, Game or result plays for, since every individual result feeds a Team's Standings.
- **Host / Organizer:** check that the right person's points went to the right Team while recording results.

## Surfaces to audit (each at 390 and 1440, teams War Week)

- Standings: individual leaderboard on Home, `/leaderboard`, the Finale.
- Brackets: entrant marks in the bracket view and tree, Heat results, the Heat result form, the Bracket Finale.
- Games: the Games leaderboard, the Game log, the Log a Game form's player pickers.
- Recent results on Home.
- Competition page ledger (points format) and the admin Points ledger.
- Award recipients (`/awards`, the archive).
- Now/Next timed Heats on Home.

## Open questions for triage

- Is a Team-colored Avatar alone enough anywhere, or must the Team name always show? (Color alone isn't accessible; the rule below asks for the name where there's room.)
- Free-for-all War Weeks are unaffected (no Teams).
- Squads and Team entrants already are Teams; nothing to add there.

## Acceptance criteria (draft)

- [ ] Every surface above shows the Participant's Team in a teams War Week, per the `CONTEXT.md` rule.
- [ ] The regression checklist line "Teams show in team events" passes at both viewports.
- [ ] `pnpm gate` passes.

# 106: 100 Participants: demo seed and scale pass

**What to build:** War Week will have 50–100 Participants. Add a demo seed with 100 Participants (teams and free-for-all) and walk every page that lists or picks people: roster, Standings and leaderboard, Placement sheet, Entrants, pickers (`EntityCombobox`), the Bracket tree (64 entrants), Participation ticks, Finale, Home. Fix what breaks or gets unusable.

**Blocked by:** R17 merged into `staging` (R18 too if run after it)

**Status:** in-progress

**Source:** Paul's regression feedback 2026-10-03 (Participant: search scaling; 50–100 participants); grilling Q13

## Decisions

- No result cap on search: browser filtering over 100 is fine (Q13). Make sure search matches name and email.
- Made-up names only; no real employee data.
- Findings recorded in the ticket; small fixes made here, larger ones filed as tickets.

## Acceptance criteria

- [ ] The seed loads twice; smoke covers it.
- [ ] Screenshots of each page above at 1440 and 390 with 100 Participants under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

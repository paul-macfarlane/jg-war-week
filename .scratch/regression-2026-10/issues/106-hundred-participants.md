# 106: 100 Participants: demo seed and scale pass

**What to build:** War Week will have 50–100 Participants. Add a demo seed with 100 Participants (teams and free-for-all) and walk every page that lists or picks people: roster, Standings and leaderboard, Placement sheet, Entrants, pickers (`EntityCombobox`), the Bracket tree (64 entrants), Participation ticks, Finale, Home. Fix what breaks or gets unusable.

**Blocked by:** R17 merged into `staging` (R18 too if run after it)

**Status:** ai-review

**Source:** Paul's regression feedback 2026-10-03 (Participant: search scaling; 50–100 participants); grilling Q13

## Decisions

- No result cap on search: browser filtering over 100 is fine (Q13). Make sure search matches name and email.
- Made-up names only; no real employee data.
- Findings recorded in the ticket; small fixes made here, larger ones filed as tickets.

## Acceptance criteria

- [ ] The seed loads twice; smoke covers it.
- [ ] Screenshots of each page above at 1440 and 390 with 100 Participants under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Scale pass findings

2026-10-04, from the `regression-r19-scale` screenshots (`test-results/e2e/regression-r19-scale-*/`): the XII scale demo (100 Participants, free-for-all) and the live XI demo (101 in Teams), each at 1440 and 390. No page scrolls sideways at 390 (asserted on every page).

| Page | What I saw | Outcome |
|---|---|---|
| Pickers (`EntityCombobox`) | Search matched name and Team only; no picker found a Participant by email. | Fixed in `4c66899b`: a hidden `keywords` field is searched; the Organizer-only Discretionary points and Awards pickers pass each Participant's email. All 100 list with no cap (e2e). |
| Pickers a Host sees (Record placements, Entrants, Log a Game, Squads, Who took part) | Name-only search; adding emails conflicts with "Participant emails never reach the client". | Filed [108](./108-host-picker-email-search.md). |
| Placement sheet (Record placements) | At 390 the Name column was about 90 px, so even short names truncated ("Edie Doo…", "Hana Ha…"); a Finalized sheet kept an empty Remove column. | Fixed in `7ef301eb`: names wrap; a Finalized sheet has no Remove column. |
| Roster (admin) | 100 rows in one list, no search; Add Participant and Import only after the last row (5,400 px at 1440; XI's 101 in Teams 9,600 px at 390). | Filed [109](./109-roster-at-a-hundred.md). |
| Entrants and Bracket (admin) | 64 chips, 64 Seed Positions and 32 Round 1 pairings above the tree: about 12,000 px at 1440. | Filed [110](./110-bracket-admin-at-sixty-four.md). |
| Bracket tree (64 Entrants) | Scrolls inside its own Rounds region as designed, but sits in the narrow column at 1440 (Rounds 1–3 of 7 visible), is 4,700 px tall, and has no jump to Your Heat. | Filed [111](./111-bracket-tree-at-sixty-four.md). |
| Finale, Standings slide | 12–13 rows fit the slide; the rest never show. The countdown takes about a second per row (17 s for 17). | Filed [113](./113-finale-standings-at-scale.md). |
| Admin bottom bar (XI, 390) | In XI's monospace font "More" is clipped to "Mor". Not a scale issue. | Filed [112](./112-admin-bottom-bar-wide-font.md). |
| Who took part (Participation ticks) | "72 of 100" count and a name search above the list; two columns at 1440, one at 390. Usable. | No change. |
| Standings and leaderboard, Home | Only the 17 with points list; ties share a place; the long name wraps at 390. Home shows the top five. | No change. |
| Competitions list | Each row's status, preview and badges fit at 390, "Underway · Round 1 of 6" included. | No change. |

# 106: 100 Participants: demo seed and scale pass

**What to build:** War Week will have 50–100 Participants. Add a demo seed with 100 Participants (teams and free-for-all) and walk every page that lists or picks people: roster, Standings and leaderboard, Placement sheet, Entrants, pickers (`EntityCombobox`), the Bracket tree (64 entrants), Participation ticks, Finale, Home. Fix what breaks or gets unusable.

**Blocked by:** R17 merged into `staging` (R18 too if run after it)

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Participant: search scaling; 50–100 participants); grilling Q13

## Decisions

- No result cap on search: browser filtering over 100 is fine (Q13). Make sure search matches name and email.
- Made-up names only; no real employee data.
- Findings recorded in the ticket; small fixes made here, larger ones filed as tickets.

## Acceptance criteria

- [x] The seed loads twice; smoke covers it.
- [x] Screenshots of each page above at 1440 and 390 with 100 Participants under `test-results/e2e/<test>/`.
- [x] `pnpm gate` passes.

## Scale pass findings

2026-10-03, from the `regression-r19-scale` screenshots (`test-results/e2e/regression-r19-scale-*/`): the XII scale demo (100 Participants, free-for-all) and the live XI demo (101 in Teams), each at 1440 and 390. No page scrolls sideways at 390 (asserted on every page).

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

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r19`): claimed with Epic R19; `ready-for-agent` → `in-progress`. Execution record: [`R19-execution.md`](../epics/R19-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r19`): D106 `4c66899b`, `7ef301eb`, `998ff0b2`, `848b5332`, `b5c1c343` (Opus), review fixes `ec45a799`.
  - **The seed:** `seeds/demo/xii-scale.json` has 100 made-up Participants (free-for-all, live XII). A post-load fixture (`src/seed/scale.ts`) adds what the seed format can't hold, through the app's own mutations; that was the scope change, and the seed and DB schema are unchanged. `pnpm seed:demo:scale` loads the seeds then runs the fixture.
  - **Load twice:** proven by the smoke phase (`scripts/smoke/scale.ts`) and a Postgres seed-sets case.
  - **Screenshots:** `e2e/regression-r19-scale.spec.ts` covers every listed page at 1440 and 390, plus XI's 101 in Teams, with exact counts (100 roster rows, 64 Entrants, 72 of 100 ticks).
  - **Fixes:** Organizer-only pickers search by email; Placement sheet names wrap.
  - **Filed:** findings 108–113.
  - Every AC PASS; evidence in [`R19-execution.md`](../epics/R19-execution.md). `ai-review` → `done`.

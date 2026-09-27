# Epic E: Bracket formats for the milestone

**What to build:** Ticket 16's two formats due before the 2027-01-21 milestone, the ones past War Weeks used most: **Heats** (several Entrants per Heat, the top N advance) and **groups → knockout** (round-robin Groups, then single elimination). One work package, one branch, one PR into `staging`.

**Tickets:** `16`, items 1 and 2 of its Order table, plus the End War Week warning ticket 16 says to do with item 1 (file under `../issues/`)

**Contract:** `../issues/16-bracket-formats-in-usage-order.md`, and the brackets spec it points to, `../../brackets/spec.md`: user stories 10, 11, 14–18 and 28 as they apply to these two Formats; "Engine" (Heats Format, groups-knockout, `groupTable`, final placings); "Surfaces"; the Engine, Seeds and Finalize acceptance criteria; and "Decisions" (single elimination as shipped, random seeding, option (b) phone layout).

**Branch:** `feat/hardening-e-bracket-formats`

**Blocked by:** Epic D (merged in #81)

**Status:** ready-for-agent

## Scope

1. **End War Week warns about an unfinalized Bracket.** The End War Week confirm names each Competition whose Bracket isn't finalized. It warns and doesn't refuse.
2. **Heats Format** (brackets spec T9). An Organizer sets Entrants per Heat, how many advance from each, and the number of Rounds or "until one Heat left". Recording a result means tapping Entrants in finishing order. The top N advance, snake-seeded, and the last Round's order is the final placing. Finalize turns placings into Points Entries through Placement Points.
3. **Groups → knockout Format** (brackets spec T10). An Organizer sets the number of Groups and how many advance from each. Groups play round robin and show a Group table (win 1, tie ½, loss 0; tiebreak head-to-head, then score difference when scores are numeric, then Seed Position). The top N of each Group go into single elimination, cross-seeded (A1 v B2, B1 v A2, …). Group Heats allow ties; knockout Heats don't.
4. **The XI demo seed** gains one finished Heats Competition and one in-progress groups-knockout Competition. They load twice idempotently, and an Organizer-entered Heat Result survives a reload.

## Decisions for planning

- **This is a Drizzle schema change, so the plan gets a red-team review** (`docs/agents/planning.md`).
- The shipped schema is single-stage (brackets spec decision W5). `heat_entrant` allows two slots per Heat (`heat_entrant_slot_0_or_1`, migration `0010`), `heat` holds one `round` and `position`, and the format enum is `points | single-elimination`. The plan decides how Heats (more than two Entrants per Heat) and Groups (a group stage before a knockout) are stored. The brackets spec's `stage` / `bracket_group` / `round` tables are one option, not a requirement.
- Everything already built for single elimination keeps working unchanged: builder, results, forfeits, resetting later Heats, Finalize and un-finalize, "From bracket" entries, the phone view, and `e2e/bracket.spec.ts`.
- Out of scope, kept on ticket 16: Squads, self-report, Heat times and Now/Next, round robin on its own, double elimination, `per-heat` and `both` points, the Finale for a Bracket, the Slack post, MCP `get_bracket`, live refresh, the Archive bracket view, and seeding by Standings or by drag.

## Acceptance criteria

- [ ] The End War Week confirm lists each unfinalized Bracket by Competition name, and ending still works.
- [ ] **Engine** (`src/lib/bracket/`, unit tests):
  - Heats generation for 2–17 Entrants and various per-Heat and advance counts
  - Heats advancement, forfeits and resetting later Heats
  - Group tables with ties and every tiebreak
  - groups-knockout cross-seeding
  - final placings and tied places for both Formats
  - `pointsFor` placings for both Formats
- [ ] **An Organizer can run each new Format** in the admin from Entrants to Finalize, and its placings reach the Standings. Each has a Playwright flow in the style of `e2e/bracket.spec.ts`.
- [ ] **The Participant view** of each Format works at 375px and 1280px with no horizontal page scroll. There are screenshots in War Week XI and in one dark past edition.
- [ ] **Seeds:** the XI seed loads twice idempotently with the two new demo Brackets. Invalid bracket fixtures are rejected by the seed schema tests.
- [ ] **Single elimination is unchanged:** `e2e/bracket.spec.ts` and the existing engine tests pass as they are.
- [ ] **Docs:** `CONTEXT.md` (Heats, Group, Group table), the maintainer's guide ("Run a knockout Competition as a Bracket"), and `/about` (the Brackets card copy and still) match the change.
- [ ] Ticket 16 records which items this epic closed. The epic records its closeout and is set to `done` in its branch.
- [ ] `pnpm gate` passes locally and in CI.

## Comments

# Epic E: Bracket formats, milestone slice

**What to build:** The part of ticket `16` that must land before the 2027-01-21 milestone, as one work package, one branch and one PR into `staging`: the End War Week warning for an unfinalized Bracket, the **Heats** Format (T9), and removing the unbuilt `per-heat` and `both` Bracket points modes from the code. T10 (qualifiers or groups → knockout) is dropped (see "Scope changes"). The rest of ticket 16 (Squads, self-report, Heat times and Now/Next, round robin with ties, double elimination, the T6/T14 extras, seeded Brackets, seeding by Standings or drag) stays in the ticket for later epics and never delays this one.

**Tickets:** `16` (item 1 of its Order table, plus the End War Week warning and the points-mode removal from "Also carried"); files under `../issues/`

**Branch:** `feat/hardening-e-bracket-formats`

**Blocked by:** Epic D (its PR #81 merged into `staging`); ticket 16's own blockers 03 and 13 are `done` and merged

**Status:** ai-review

## Order

1. The End War Week warning (small, independent; ticket 16 says "do this first, with item 1").
2. T9 Heats: multi-entrant Heats, the top N of each Heat advancing until one Heat is left.
3. Remove the `bracketPoints` field from the code (with item 2's wiring).

## Acceptance criteria

Ticket 16's contract for T9 and the warning (`.scratch/brackets/spec.md` stories 10, 11, 15–18, 22 and its Engine decisions), plus:

- [ ] Engine unit tests for the Heats Format: generation for 2–17 Entrants across the config values the builder offers (including the refused combinations), byes and short Heats, advancement and snake seeding, reset of later Rounds, final placings and ties, `pointsFor` under placings.
- [ ] Single elimination behaves exactly as before: the existing engine, mutation, smoke and Playwright bracket checks pass unchanged in what they assert.
- [ ] A Playwright flow builds, runs and finalizes a Heats Bracket on the XI demo seed and finds its "From bracket" Points Entries; a Playwright check opens End War Week while a Bracket is unfinalized, sees the warning naming it, and cancels.
- [ ] Screenshots at 375px and 1280px of the Heats builder, results screen and participant view; zero horizontal overflow at 375/768/1280.
- [ ] The migration applies to the seeded local database; every seed still loads twice; smoke passes on it.
- [ ] CONTEXT.md (glossary and "Bracket rules"), `/about` copy and media, the Organizer guide and `docs/maintainers-guide.md` match every user-visible change.
- [ ] No code reads or writes `bracketPoints`; Bracket points come only from placings and the Competition's Placement Points.
- [ ] Ticket 16 records a `[PROGRESS]` comment for this slice and its `Status:` line is unchanged (it stays open for the rest of its Order table); this epic records its closeout and is set to `done` in this branch.
- [ ] `pnpm gate` passes locally and in CI.

## Scope changes against ticket 16 and the brackets spec (Paul, 2026-09-26)

- **T10 dropped.** Ticket 16 credits "qualifiers or groups → knockout" with ~14 past uses, but Paul confirmed none needs a new Format: Pool is plain single elimination, and Bouncy Ping Pong ran as two Competitions (a points qualifier, then a four-Entrant single-elimination Bracket of the top finishers). Two Competitions stay the answer. Round-robin Groups, Group tables and their tiebreaks belong to T7.
- **One new column, no stage/round tables.** Following spec Decision W5 (single-stage rows), `heat` gains only `slot_count`; no `stage`, `pool` or new tables in this slice. Details in `E-execution.md`, decision 10. Planner's call (Paul deferred to it).
- **Heats end "until one Heat is left"**; no fixed-Rounds option (Paul approved).
- **Per-heat and both points removed** (Paul): no Competition needs points per Heat; past multi-entrant games paid only 1st place, which Placement Points on the Competition already express. This epic removes `bracketPoints` from the code; the `competition.bracket_points` column and its enum are dropped in a later migration, after this ships to `main`, so an Instant Rollback never meets a missing column.
- **No seeded Bracket in XI** (ticket 16 "Seeds"): Paul has no history to seed one from. Open for a later epic only if that changes.

## Comments

- 2026-09-26 [EXECUTION PLAN]: claimed by Atlas (`/atlas-implement`, Epic E); branch `feat/hardening-e-bracket-formats` from `staging` `cb8162b`; plan, decisions and verification map in `E-execution.md`. Ticket 16 stays `ready-for-agent` (this slice is part of it).

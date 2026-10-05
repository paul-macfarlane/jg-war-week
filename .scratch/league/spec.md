---
title: League, round robin and Swiss (Epic R23)
status: ai-review
claimed: atlas-implement, Paul Macfarlane, 2026-10-04
grilled: 2026-10-04 (see ../regression-2026-10/grilling-2026-10-04.md)
created: 2026-10-04
source: Paul's regression feedback "10/3", item 13.1 (chess tournaments)
---

# League: round robin and Swiss

**Epic:** R23 · **Branch:** `feat/r23-league` · **Blocked by:** R21
(`../competition-setup/spec.md`) merged into `staging`. League reuses its
self-report setting, its scoring config and the Close / Reopen lifecycle ·
**Red-team:** required (Drizzle schema change) · **Status:**
ai-review

## Summary

War Week has no way to run a chess tournament. Chess needs two things no
Format has:

- **Draws.**
- **Many players each playing several opponents**, with standings built from
  match points.

Round robin and Swiss are the standard ways to run that. They differ only
in how pairings are made, so they are one new Format, **League**, with a
Pairing setting.

Named need: an Organizer running a chess tournament for War Week XII (Paul,
2026-10-04).

## Decisions

1. **One Format, "League"**, with **Pairing** set to **Round robin**
   (everyone plays everyone) or **Swiss** (N rounds, paired one round at a
   time).
   - Remove **League** from the `CONTEXT.md` banned list and from the
     banned-term scan.
   - It sits beside Placement, Bracket, Head-to-head, Best score and
     Participation in `COMPETITION_FORMATS`.
2. **Entrants** are Participants or Teams, following the Competition's
   scoring, like the other Formats.
   - Organizers and Hosts add them with the `ParticipantPicker` (spec C if
     it has merged; otherwise the current picker).
   - "Participants can enroll" is offered as for Bracket, and enrollment
     closes when round 1 is paired, the limit is reached, or the
     Competition is Closed.
3. **Each pairing is one Match.**
   - Its result is a win for either Entrant, or a draw. An optional Score
     per Entrant uses the shared direction and unit from spec B: with a
     direction set, Scores decide the result, and equal Scores are a draw.
   - No best-of inside a pairing in v1. No white/black colors in v1.
4. **Match points: win 1, draw ½, loss 0.** These are fixed, not
   configurable.
5. **Round robin pairings.**
   - Generated all at once when an Organizer or Host clicks "Pair rounds",
     using the circle method so each Entrant plays once per round.
   - With an odd count, one Entrant sits out each round, worth 0.
   - Pairings can be edited (swap Entrants) before a Match has a result.
6. **Swiss pairings.**
   - **Rounds.** The Organizer sets the number of rounds (default ⌈log₂ N⌉,
     range 1 to N−1). Round 1 pairs by Seed Position, or randomly if there
     are no seeds.
   - **Next round.** Once every Match in a round has a result, "Pair next
     round" groups Entrants by match points, then by current rank, and pairs
     within groups. It floats down when needed and **avoids rematches**.
   - **Byes.** With an odd count, the bye goes to the lowest-ranked Entrant
     who hasn't had one, worth 1.
   - **Editing.** Pairings can be edited before the round has a result.
   - **Engine.** A pure module with unit tests, like
     `src/lib/bracket/engine.ts`.
7. **Standings and tiebreaks.** Rank by match points.
   - **Round robin:** the head-to-head result among the tied Entrants, then
     Sonneborn-Berger.
   - **Swiss:** Buchholz (sum of opponents' match points).
   - **Still tied:** a shared place, with full points each (the existing tie
     rule).
   - Tiebreak values show as columns in the results table.
8. **Who records.** Organizers and Hosts record any Match. With self-report
   on (spec B's setting, off by default), either player in a Match, or
   someone on their Team, records it. Edit and delete follow spec B's
   Head-to-head rule.
9. **Points.**
   - **Close** writes Placement Points by final standing; **Reopen**
     withdraws them.
   - Placement Points have no place limit, as with Placement.
   - Closing before every Match is played is allowed, with a warning naming
     the unplayed Matches.
10. **Participant page.**
    - The results table (spec A) with Rank · Entrant · W · D · L · Match
      points · tiebreak · War Week points (Provisional until Closed), then
      the rounds, each listing its Matches and results.
    - The viewer's own Match is highlighted ("Your next Match" names the
      round and opponent).
    - The Top finishers block (spec A) shows the decided places once
      Closed.
11. **Admin page.** League settings (Pairing, rounds, scoring direction and
    unit, self-report, enrollment), Entrants, pairing buttons, and the
    rounds with "Record result" on each Match, opening as a dialog at 1440
    and a bottom sheet at 390 (`ResponsiveSheetDialog`). Settings lock once
    round 1 is paired.
12. **MCP.** A read-only `get_league` (or `get_competition` extended): it
    returns pairing type, rounds, Matches with results, and standings with
    tiebreaks, with no `@`.

## Schema change (for the red-team)

- `competition.format` gains `league`, plus a `league_config` (pairing,
  rounds), with CHECK constraints like `game_config`'s.
- New tables for League rounds and Matches. The plan picks the names. Each
  Match holds the round, two Entrant slots (one empty for a bye), the
  result (win A, win B, draw), optional Scores, who recorded it and when.
  Reuse `entrant`.
- Demo seed: one completed round robin and one in-progress Swiss in the XII
  demo, plus one in the scale seed. Seeds load twice with no row-count
  change.

## Acceptance criteria

- [ ] Round robin of 5:
      - every pair meets exactly once over 5 rounds;
      - one Entrant sits out each round, worth 0;
      - standings and head-to-head and Sonneborn-Berger tiebreaks match a
        hand-worked example (vitest).
- [ ] Swiss of 9 over 4 rounds:
      - no rematches;
      - byes go to the lowest-ranked Entrant without one, worth 1, never
        twice;
      - Buchholz matches a hand-worked example (vitest).
- [ ] An Organizer creates a Swiss League, adds 6 Entrants, pairs round 1,
      records results including a draw, pairs the next round, runs to the
      last round and Closes. The Placement Points appear in the War Week
      standings, and Reopen withdraws them (e2e at 1440 and 390,
      screenshots).
- [ ] With self-report on, a player records their own Match and a
      non-player is refused on the server. With it off, both are refused
      (e2e; smoke over HTTP).
- [ ] A Score with direction set decides the result, and equal Scores
      record a draw (vitest).
- [ ] Pairings can be edited before a round has a result, and are refused
      after (e2e).
- [ ] The Participant page shows the table with W/D/L, match points,
      tiebreak and Provisional points, plus the rounds and "Your next
      Match". axe passes in both schemes (e2e).
- [ ] MCP returns the League with no `@` (smoke).

## Out of scope

- Best-of within a pairing; white/black colors; Elo or ratings; time
  controls; importing games from chess.com or lichess.
- Other Swiss pairing systems (Dutch/FIDE accuracy). The rule above is the
  spec.

## Definition of Done

- [ ] Red-team the plan before implementation (`/atlas-red-team`).
- [ ] Migration and demo seed together; smoke on seeded local Postgres.
- [ ] `CONTEXT.md`: League, Pairing (Round robin, Swiss), match points,
      tiebreaks, bye; League removed from the banned terms.
- [ ] `/about` (a League feature card and still), `docs/maintainers-guide.md`
      and `docs/regression-checklist.md` updated.
- [ ] e2e screenshots at 1440 and 390 committed under `test-results/e2e/`.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

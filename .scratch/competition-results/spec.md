---
title: Competition results and language (Epic R20)
status: ready-for-agent
grilled: 2026-10-04 (see ../regression-2026-10/grilling-2026-10-04.md)
created: 2026-10-04
source: Paul's regression feedback "10/3", items 1, 3.1, 3.3, 4, 5.5, 6, 8.2, 8.6, 9.1, 10.2, 10.4, 11
---

# Competition results and language

**Epic:** R20 · **Branch:** `feat/r20-competition-results` · **Blocked by:**
R19 merged into `staging` · **Red-team:** not required (no schema change; if
planning finds one is needed, it becomes required) · **Status:**
ready-for-agent

## Summary

The Participant Competition pages say the same thing twice and in too many
words. Each result is shown as a scoreboard, and then again as a list of
Point Entries. Every Score cell repeats "Score". The four Formats use three
words for one lifecycle. This epic makes results one sortable table with
points in it, puts the description first, and settles the words: **Match**,
**Attempt**, **Winner**, **Close / Reopen**. It changes what people see and
the glossary, not the data model. Spec B changes the model and runs after
this one.

## Decisions

1. **One results table.** Every ranked view uses one shared component built
   on the shadcn `Table` (`pnpm dlx shadcn@latest add table` if it isn't
   there yet):
   - Placement, Best score, Participation (team, ranked by headcount),
     Bracket top places and the War Week standings / leaderboard.
   - Columns: **Rank · Participant or Team · Score (unit) · War Week
     points**. The Score column is left out where a Format has no Score.
     The unit comes from config where one exists today (Best score); spec B
     adds it elsewhere.
   - Every column header sorts (ascending/descending, `aria-sort` set). The
     default sort is Rank.
   - Cells hold values only, with no "Score x" text in each cell.
   - The Winner's row (place 1, or every tied first place) is highlighted
     with a mark and a text label ("Winner"). Color is not the only cue.
   - At 390px the table fits with no page-level sideways scroll. Columns may
     collapse (for example, points under the name) but no data is dropped.
2. **Provisional points.** While a Competition is not Closed, the War Week
   points header shows a "Provisional" badge. Its tooltip, also reachable by
   keyboard and touch, says the points become final when the Competition is
   Closed. Once Closed, the badge goes and the points are the generated
   Points Entries.
3. **No Point Entries section** on any Participant Competition page. Points
   show in the results table, or the podium or series view.
   `PointsEntryList` stays only where it is still used (Profile, history,
   Discretionary points).
4. **Best score standings: one row per person (or Team) from their best
   Attempt.**
   - A person never holds more than one place.
   - Their other Attempts sit in an expandable row under their entry,
     keyboard-operable, with a count ("3 more attempts").
   - The separate games list is removed from the Participant page and from
     admin. Admin edit and delete move into the expanded rows.
   - In `count: total` mode, the row shows the person's total, and the
     expansion lists the Attempts that make it up.
5. **Bracket results: a podium of decided places.**
   - The Champion card is replaced by a "Top finishers" block. It shows
     every place the Bracket decides, each with its points: 1st and 2nd from
     the final; 3rd and 4th only with a 3rd place match; in a Group final,
     the final match's order.
   - Semifinal losers with no 3rd place match are not placed and not shown.
   - 1st is highlighted as Winner.
   - The same block shows top places for Placement and Best score above
     their table, so all Formats look alike. It is a summary, not a second
     list of points.
6. **"Play the finale" goes** from the Participant Bracket view
   (`bracket-view.tsx`) and Bracket admin (`bracket-admin.tsx`). Bracket
   Finales stay reachable from `/admin/finale` and its routes. The Finale is
   unchanged.
7. **Head-to-head series view.** A Head-to-head Competition with exactly two
   Entrants shows no leaderboard. It shows:
   - the Matches in order, each with both Scores and its Winner (or Draw);
   - the series score ("2–1"), with the series Winner once decided;
   - the Placement Points each Entrant gets, Provisional until Closed.

   Any other Entrant count keeps the results table until spec B makes two
   Entrants the rule.
8. **Page order.** Back link → group, name and facts → **description** →
   enroll button → the Format's results. The rich-text description moves
   above the results. A long description collapses after a few lines with
   "Show more", so the results stay near the top.
9. **Cross-links.** A **"Manage"** button (`outline`) on the Participant
   Competition page links to `/admin/competitions/<id>`. It shows only to
   Organizers and that Competition's Hosts, decided on the server with the
   existing `can` rules. The admin page already links the other way. The
   ad-hoc "Close it" link in `games-view.tsx` is replaced by this button.
10. **Words.**
    - **Match** replaces Heat (Bracket) and Game (Head-to-head).
    - **Attempt** replaces Game (Best score).
    - **Winner** replaces Champion.
    - **Close / Reopen** replaces Finalize, Un-finalize and the Bracket's
      "Un-finalize" on every Format, in buttons, toasts, help text, the
      status line ("Done · Winner: X" stays), MCP descriptions and docs.
    - These apply to UI copy, MCP output field names and descriptions,
      `CONTEXT.md`, `/about`, `docs/maintainers-guide.md` and the regression
      checklist.
    - Code identifiers that need no schema change rename here too
      (`champion` → `winner`, component and helper names such as
      `HeatSettingsFields`, copy keys). Identifiers tied to tables and
      columns (`heat`, `game`, `finalized_at`, `GAME_FORMATS`,
      `src/lib/games/`) rename in spec B with the schema, so nothing is
      named twice.
    - Routes that contain old words keep working (308 redirect) if any are
      renamed.
11. **Banned terms.** Remove **Match** from the `CONTEXT.md` banned list and
    from the banned-term scan. Add **Heat**, **Champion** and **Finalize**
    (in UI copy) as banned, with "Match", "Winner" and "Close" as the
    replacements, so the old words don't creep back. Identifiers that must
    keep `heat`, `game` or `finalized` until spec B are excepted by a
    short, named allowlist that spec B deletes. **League** is spec D's to lift.
12. **Free-for-all hides scoring.** In a free-for-all War Week every
    Competition is Individual, so:
    - `CompetitionFacts` and the settings form don't show the
      Individual/Team choice or an "Individual" label;
    - a Competition that is already Team in a free-for-all War Week still
      shows "Team", because it's the exception.

## Acceptance criteria

- [ ] Placement, Best score, team Participation and the War Week
      leaderboard use the one results table. It sorts by every header,
      defaults to Rank, highlights the Winner with text, and has no "Score"
      text inside cells (vitest on the sort and rank helpers; e2e at 1440
      and 390 with no sideways scroll).
- [ ] An open Competition shows "Provisional" on the points header, with its
      tooltip reachable by keyboard. Closing removes it, and the points then
      equal the generated Points Entries (e2e).
- [ ] No Participant Competition page renders a Point Entries section
      (e2e on each Format).
- [ ] Best score: a person with three Attempts holds one place (their best),
      and expanding the row shows the other two. In `total` mode the row is
      the sum. Admin edits and deletes an Attempt from the expanded row
      (vitest on ranking; e2e).
- [ ] Bracket without a 3rd place match: Top finishers shows 1st and 2nd
      only. With one: 1st to 4th. A Group final shows its order. Each place
      shows its points, and nothing says "Champion" or "Play the finale"
      (e2e; extends the existing Bracket specs).
- [ ] A two-Entrant Head-to-head shows the series view (Matches, series
      score, Winner, points) and no leaderboard (e2e).
- [ ] The description renders above the results, with "Show more" on a long
      one (e2e at 1440 and 390).
- [ ] "Manage" shows for an Organizer and for that Competition's Host. It
      doesn't show for another Competition's Host or a Participant, and the
      admin route still refuses them (e2e with stub sessions).
- [ ] No "Heat", "Game" (for Bracket, Head-to-head or Best score),
      "Champion", "Finalize" or "Un-finalize" in UI copy or MCP output. The
      banned-term scan enforces it and passes (vitest).
- [ ] A free-for-all War Week's Competition pages and settings show no
      Individual/Team choice or "Individual" label (e2e on a free-for-all
      seed).
- [ ] MCP stays read-only with no `@` in any output. `get_bracket` and
      `get_games` use the new words (smoke).

## Out of scope

- Any schema change, and the table, column and code renames tied to it
  (spec B).
- Units on Formats other than Best score, score direction on matches, and
  Head-to-head's two-Entrant rule (spec B).
- The Finale's slides and Standings.

## Definition of Done

- [ ] `/about` (copy, and media via `scripts/about-media.ts` where affected),
      `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated
      (team rules in `docs/agents/testing.md`).
- [ ] `CONTEXT.md` updated per the grilling record's glossary list for what
      ships here (Match, Attempt, Winner, Close / Reopen, banned terms).
- [ ] e2e screenshots under `test-results/e2e/<test>/` at 1440 and 390 for
      every changed page, committed. axe passes on the results table and the
      podium in both schemes.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

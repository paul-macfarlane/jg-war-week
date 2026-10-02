# 56: Home shows Recent results

**What to build:** A **Recent results** section on the War Week Home page, after Now/Next and Log a Game: the latest few results across the War Week, newest first: a Bracket finalized (champion), a `games` Competition closed (winner), a Participation Competition closed (once ticket 69 ships), and Points Entries added (Competition, who, points). Each links to its Competition. Up to 5 rows, with "All Competitions" linking to `/[edition]/competitions`.

**Blocked by:** none

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P5; grilling Q5

## Decisions

- Grouping: Points Entries of one Competition added together collapse into one row ("Trivia: Red 10, Blue 5").
- Hidden when nothing has been scored yet. Archived War Weeks keep their archive view.
- Read through a query in `src/queries/` with a unit-tested pure shaping function; refreshes with the page's existing ~10 s refresh.

## Acceptance criteria

- [ ] Unit tests for the shaping (ordering, grouping, limit 5).
- [ ] On the XII demo with a finalized Bracket and Points Entries, Home shows them newest first; screenshots at both viewports.
- [ ] `pnpm gate` passes.

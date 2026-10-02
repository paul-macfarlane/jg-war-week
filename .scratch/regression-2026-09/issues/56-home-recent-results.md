# 56: Home shows Recent results

**What to build:** A **Recent results** section on the War Week Home page, after Now/Next and Log a Game: the latest few results across the War Week, newest first: a Bracket finalized (champion), a `games` Competition closed (winner), a Participation Competition closed (once ticket 69 ships), and Points Entries added (Competition, who, points). Each links to its Competition. Up to 5 rows, with "All Competitions" linking to `/[edition]/competitions`.

**Blocked by:** none

**Status:** done

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

## Comments

- 2026-10-02 [AI CODE REVIEW] (atlas-implement): Two fresh Opus reviewers read `0e19fa6..d7c4096`, one per axis. The orchestrator adjudicated each finding against the cited hunks; the full record is in `../epics/R9-execution.md` [AI CODE REVIEW]. One blocking finding: F2, settings autosave wrote the whole row and could revert a newer Winner. It was fixed in `aae6856`/`6360357` with partial saves merged over the locked row. Every non-blocking finding was fixed or approved as a deviation.
- 2026-10-02 [CLOSEOUT] (atlas-implement): Branch `feat/regression-r9-navigation`; worker D56 (Sonnet), commit `0c12d50`; orchestrator fix `62acabf` (e2e sign-in); review fixes `aae6856` (targets compared by id, bounded query).
  - AC1 PASS: `src/lib/recent-results.test.ts` covers ordering, grouping (one Competition's entries within 10 minutes of each other), ties, same-name targets and the limit of 5.
  - AC2 PASS: `e2e/regression-r9-home.spec.ts` shows newest first, one row per Competition's entries. Screenshots `recent-results-390`/`-1440` on the XII demo with a finalized Bracket made for the shot and removed after. The XII demo's seeded Points Entries are dated Feb 2027, so they sort above today's Bracket row (correct ordering).
  - AC3 PASS: gate at `6360357`.
  - The shaper lives in `src/lib/recent-results.ts`; the loader is `src/queries/recent-results.ts`. Participation awaits ticket 69.

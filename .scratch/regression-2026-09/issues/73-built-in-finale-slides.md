# 73: Built-in Finale slides

**What to build:** The built-in slides, each themed with the War Week's Appearance Theme at projector scale:

- **Title:** War Week, edition and Story Theme.
- **By the numbers:** Competitions run, Games logged, Heats played, Points Entries, points awarded, Participants (only non-zero figures).
- **Awards:** each Award revealed one at a time (step within the slide), grouped by Award Category; the Organizer chooses "all on one slide" or "one slide per Category".
- **Champions:** each finalized Bracket's champion and each closed `games`/Participation Competition's winner.
- **Winner:** the main Standings' first place, read from the same `getStandings` rows (ties shown as ties).

**Blocked by:** 72, 70 (Categories)

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** grilling Q19, Q27

## Acceptance criteria

- [ ] Unit tests for the By the numbers figures and the Champions list on the demo seed.
- [ ] Screenshots of each slide at 1920×1080 and 390×844 on the XII demo.
- [ ] `pnpm gate` passes.

## [CLOSEOUT]

2026-10-03, atlas-implement (Claude Opus 5.5). Deliverable D73 (worker: atlas-worker, opus; commit `5fe725f`, merged with D74 by the orchestrator in `2531728`), plus the review fixes `6096595` (RF). Verified on `feat/regression-r13-finale-slides` at `6096595` (code; the closeout commits add only `.scratch/` and `test-results/`), local Postgres `war-weeker-postgres` :2345, `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`. Final gate: `pnpm format:check && pnpm gate` exit 0 (format clean; lint 0 errors, 11 existing-pattern `<img>` warnings; vitest 173 files / 3729 tests; build; smoke 246 ok; Playwright 91 passed) → `test-results/r13/gate.txt`. PR: [paul-macfarlane/jg-war-week#121](https://github.com/paul-macfarlane/jg-war-week/pull/121).

| AC | Verdict | Evidence |
|---|---|---|
| Unit tests for the By the numbers figures and the Champions list on the demo seed | PASS | pure `byTheNumbers`/`championsList`/`finalWinners`/`tieTitle` tests (`src/lib/finale-slides.test.ts`, inputs from `seeds/demo/xii.json`) and the DB-backed `src/queries/finale-slides.test.ts` (loads `seeds/demo/xi.json`, `getFinaleCounts` against SQL counts, a tied closed `games` Competition and a finalized Bracket through `getChampions`) in the gate → `test-results/r13/gate.txt` |
| Screenshots of each slide at 1920×1080 and 390×844 on the XII demo | PASS | `test-results/r13/slides/{title,numbers,awards,champions,standings,winner,custom}-{1920x1080,390x844}.png` from `pnpm build && pnpm seed:demo:xii && pnpm stills:finale --out test-results/r13/slides` (fixtures added and torn down by the script); 390 stills rerun after review fixes T6/T8. At 1920×1080 no slide scrolls; the 12-row Standings slide scrolls a few pixels at 390×844 |
| `pnpm gate` passes | PASS | `test-results/r13/gate.txt` |

Deviations: "Other Awards" names the uncategorized slide; per-Category falls back to one Awards slide when no Award has a Category (review T3); Winner is skipped when every total is zero; Champions has no steps; individual-scoring Participation has no winner and is left out; the figure is "Points handed out".

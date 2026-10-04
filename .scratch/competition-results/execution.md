# Execution record: Epic R20, Competition results and language

Contract: [`spec.md`](./spec.md) (one work package; decisions 1–12, eleven
acceptance criteria, four DoD items) and the grilling record
[`../regression-2026-10/grilling-2026-10-04.md`](../regression-2026-10/grilling-2026-10-04.md)
(decisions 12, 15, 21–23; glossary list). No `/atlas-plan` ran. On
2026-10-04, `/atlas-implement` derived this plan against `staging` at
`d97b5364` (PR #132 merged; R19's PR #131 merged, so "Blocked by" is met).
Red-team: not required (no schema change planned; a schema need stops the
run and comes back to Paul). Branch: `feat/r20-competition-results`.

## [EXECUTION PLAN]

2026-10-04.

### Run record

- Work package `r20-competition-results`; branch from `staging` at
  `d97b5364`, the review comparison point.
- **Isolation (Paul: "in a worktree to avoid conflicts with any other
  work"):** the integration checkout is the worktree
  `.claude/worktrees/r20-competition-results/war-weeker/`. Other sessions
  may use the main checkout and the shared local Postgres, so this work
  package never touches the `war_weeker` database or ports 3100/3200. Each
  checkout gets its own database on the same server (localhost:2345) and its
  own ports:

  | Checkout | Database | `SMOKE_PORT` | `E2E_PORT` |
  | --- | --- | --- | --- |
  | integration (`…/war-weeker`) | `war_weeker_r20` | 3120 | 3220 |
  | worker A (`…/war-weeker-a`) | `war_weeker_r20a` | 3121 | 3221 |
  | worker B (`…/war-weeker-b`) | `war_weeker_r20b` | 3122 | 3222 |

  Every command runs with
  `DATABASE_URL=postgres://postgres:postgres@localhost:2345/<db>?sslmode=disable DATABASE_DRIVER=pg`
  plus the two ports (the dev credentials from `compose.yaml`; no `.env`
  file is read).
- **Structure: waves.** Each wave's two deliverables run in parallel in
  worker worktrees branched from the integration head, then merge in.
  - **Wave 1**
    - **D1, the results table** (decisions 1, 2; AC1, AC2). One shared
      `ResultsTable` on the shadcn `Table` with pure sort/rank helpers
      (vitest), a Provisional badge with a keyboard- and touch-reachable
      tooltip, and a `TopFinishers` summary block. Applied to Placement,
      team Participation and the War Week leaderboard. axe on the table in
      both schemes.
    - **D2, the page shell** (decisions 3, 8, 9, 12; AC3, AC7, AC8, AC10).
      Page order with the description first and "Show more"; no Point
      Entries section; the "Manage" button replacing "Close it";
      free-for-all hides Individual/Team.
  - **Wave 2** (after wave 1)
    - **D3, Best score and Head-to-head** (decisions 4, 7; AC4, AC6). One
      row per person with expandable Attempts, admin edit and delete in the
      rows, no separate list; Top finishers above the table; the two-Entrant
      series view.
    - **D4, the Bracket podium** (decisions 5, 6; AC5). Top finishers
      replaces the Champion card; "Play the finale" goes from the
      Participant view and Bracket admin; `champion` → `winner` in code and
      `get_bracket`. axe on the podium in both schemes.
  - **Wave 3: D5, the words** (decisions 10, 11; AC9, AC11). Match,
    Attempt, Winner, Close / Reopen across UI copy, MCP descriptions and
    output fields, and non-schema identifiers; one banned-term scan.
  - **Wave 4: D6, docs** (DoD 1, 2). `CONTEXT.md`, `/about` (copy and
    stills), the guide, the regression checklist, `docs/agents/testing.md`
    cells.
  - Then the aggregate review, `pnpm format:check && pnpm gate` on the
    integrated commit in the integration worktree, closeout and the PR.
  - Edges: {D1, D2} → {D3, D4} → D5 → D6 → gate. D3 and D4 render D1's
    `ResultsTable` and `TopFinishers`; D5 sweeps the copy D1–D4 leave; D6
    describes the final UI.
- **Predicted overlaps** (re-checked at closeout):
  - D1 ∥ D2 share `src/app/[edition]/competitions/[id]/page.tsx` only. D1
    edits only the `PlacementView` / `ParticipationView` props there; D2
    owns the page's order and sections. `ledger` stays loaded for D1, D3
    and D4.
  - D3 ∥ D4 share `page.tsx` (each its own view's props) and read D1's
    components without changing their API (additive props only). Their
    smoke and e2e files are disjoint (`scripts/smoke/games.ts`,
    `scripts/smoke/brackets.ts`).
  - D5 touches most of `src/` and runs alone.
- Workers run `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (Postgres test files must run, not skip), `pnpm build`, their own e2e
  specs (`pnpm exec playwright test <spec>…`) and, where they change smoke,
  `pnpm smoke`.
- Proof-artifact root `test-results`: R19's `test-results/r19/` and
  `test-results/e2e/` are removed in the claim commit;
  `test-results/about-media/` stays until D6 regenerates it. R20 evidence:
  `test-results/r20/` (vitest summary, gate log) and
  `test-results/e2e/<test>/` from the final gate.

### Resolved decisions

- **Shared components.** `src/components/results-table.tsx` (`ResultsTable`)
  and `src/components/top-finishers.tsx` (`TopFinishers`); pure helpers in
  `src/lib/results-table.ts` (sort by column with `aria-sort` state, default
  Rank; rank ties share a place, 1, 1, 3; every tied first place is a
  Winner). Rows carry a stable key, rank, name (with the existing
  `EntrantMark` / avatar where the view has one), optional score and unit,
  and points. The Score column is omitted when no row has a Score. At 390px
  the points column folds under the name; nothing is dropped.
- **Provisional points** are computed by the same pure rule the close step
  uses (`placementPointsByRow`, `pointsFor`, `scoreParticipation`, the games
  leaderboard's placings), never a second rule. Once Closed (Placement and
  Bracket Finalized; Games and Participation closed), the points column is
  read from the Competition's generated Points Entries (`ledger`).
- **Which views use the table:** Placement; team Participation (Score =
  headcount, ranked by it); Best score and Head-to-head with other than two
  Entrants (D3); the `/[edition]/leaderboard` standings, team and
  individual, with the existing points breakdown kept as an expandable row.
  Home's compact standings card stays as it is (a preview, not a results
  view). Individual Participation keeps its who-took-part list and shows
  each person's points in it, since the Point Entries section goes.
- **Provisional tooltip** uses a focusable trigger (button) so Tab, tap and
  hover all open it; text: "Points become final when the Competition is
  Closed."
- **"Manage"** shows when `can(actor, "competition.edit", …)` (the rule the
  admin Competition page enforces) allows it, decided on the server; the
  page receives a boolean, never the email.
- **Description collapse:** a client wrapper around `RichText` that clamps
  after about six lines with a "Show more" / "Show less" button
  (`aria-expanded`), shown only when the content overflows.
- **Free-for-all:** `CompetitionFacts` and the settings form hide the
  Individual/Team choice and label when the War Week has no Teams and the
  Competition is Individual; a Team Competition still shows "Team".
- **Words in new code:** D1–D4 write new copy with Match, Attempt, Winner
  and Close / Reopen from the start; D5 sweeps the rest.
- **Identifier renames (D5):** UI component, helper and copy-key names
  rename (`HeatSettingsFields` → `MatchSettingsFields`, `finalizeCopy` →
  `closeCopy`, `YourNextHeatCard` → `YourNextMatchCard`, and the like).
  Anything named after a table or column stays for spec B: `src/db/`,
  `src/lib/games/`, `src/lib/bracket/` row types (`Heat`, `HeatResult`),
  queries, mutations and actions keyed on `heat`, `game`, `finalized_at`,
  `GAME_FORMATS`. No route is renamed (none needs it), so no new redirect.
- **MCP output (D5; D4 does `champion`):** `get_bracket` `heats` →
  `matches` and its Heat-named fields to Match names, `champion` → `winner`;
  `get_games` lists `matches` for Head-to-head and `attempts` for Best
  score. Tool names stay. Descriptions use the new words.
- **The banned-term scan (D5)** is one vitest (`src/lib/banned-terms.test.ts`)
  over string literals and JSX text in `src/` (tests excluded), covering UI
  copy and MCP output: Heat, Champion, Finalize / Un-finalize (any
  inflection) and Game for the three Formats, plus the existing CONTEXT list
  minus Match (League stays until spec D). Identifiers are not scanned. A
  short named allowlist (file, term, reason "spec B") holds what must keep
  an old word until spec B. The per-page banned regexes in the `/about`,
  Privacy, Terms and guide tests drop `match` and add the new terms.

### Verification map

| Criterion | Command / action | Surface | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC1 table | `pnpm test src/lib/results-table.test.ts`; e2e `regression-r20-results-table` (and D3's Best score spec) | vitest; build + Postgres | sort by every header, `aria-sort`, default Rank, Winner text label, no "Score" text in cells; no sideways scroll at 1440 and 390 | `test-results/r20/vitest.txt`; `test-results/e2e/regression-r20-results-table-*/` | after D1 (Best score after D3) | results-table files, the views using it |
| AC2 provisional | e2e `regression-r20-results-table` | build + Postgres | open Placement: badge, tooltip opened by keyboard; after Close: no badge, points equal the generated Points Entries read from the DB | e2e dir | after D1 | results-table, placement view, close action |
| AC3 no Point Entries | e2e `regression-r20-page` on each Format | build + Postgres | no "Points Entries" heading on a Placement, Bracket, Head-to-head, Best score and Participation page | e2e dir | after D2 | page.tsx |
| AC4 Best score | `pnpm test` (ranking per person, `total` mode); e2e `regression-r20-best-score` | vitest; build + Postgres | one place per person; "2 more attempts" expands keyboard-first; `total` sums; admin edits and deletes from the row | vitest.txt; e2e dir | after D3 | `src/lib/games/leaderboard.ts`, games view, admin games |
| AC5 podium | e2e extending `bracket.spec`, `bracket-third-place.spec`, `bracket-heats.spec` | build + Postgres | no 3rd place match: 1st, 2nd only; with one: 1st–4th; Group final order; points per place; no "Champion" or "Play the finale" | e2e dirs | after D4 | bracket view, podium, bracket admin |
| AC6 series | e2e `regression-r20-head-to-head` | build + Postgres | two-Entrant Head-to-head: Matches with Scores and Winner/Draw, series score, series Winner, Placement Points (Provisional until Closed), no leaderboard | e2e dir | after D3 | games view, series component |
| AC7 description | e2e `regression-r20-page` | build + Postgres | description above results; long one shows "Show more" at 1440 and 390 | e2e dir | after D2 | page.tsx, collapse component |
| AC8 Manage | e2e `regression-r20-page` (stub sessions) | build + Postgres | shown to an Organizer and the Competition's Host; hidden from another Competition's Host and a Participant; admin route refuses those two | e2e dir | after D2 | page.tsx, access rules |
| AC9 words + scan | `pnpm test src/lib/banned-terms.test.ts` | vitest | scan passes; it fails on a planted "Heat" literal (shown once by the worker) | vitest.txt | after D5 | any copy change |
| AC10 free-for-all | e2e `regression-r20-page` on the free-for-all XII seed | build + Postgres | no Individual/Team choice or "Individual" label on the page or settings; a Team Competition still says "Team" | e2e dir | after D2 | facts, settings form |
| AC11 MCP | `pnpm smoke` (MCP phase); `pnpm test src/mcp` | build + Postgres | read-only, no `@`; `get_bracket` and `get_games` use Match / Attempt / Winner | `test-results/r20/gate.log` | after D5 | `src/mcp/`, smoke |
| DoD1 showcase | review `/about`, stills, guide, checklist | repo | updated where user-visible | D6 commit | after D6 | later UI change |
| DoD2 CONTEXT | review `CONTEXT.md` | repo | glossary (Match, Attempt, Winner, Close / Reopen), banned table, display rules | D6 commit | after D6 | — |
| DoD3 screenshots + axe | final gate e2e | build + Postgres | screenshots at 1440 and 390 for every changed page; axe passes on the table and the podium in light and dark | `test-results/e2e/` | final gate | any UI change |
| DoD4 gate | `pnpm format:check && pnpm gate`; PR CI | local + CI | exit 0; CI green | `test-results/r20/gate.log` | before PR | any change |
| X1 skip grep | `git diff d97b5364 -- e2e src scripts \| grep -n '^+.*\(\.skip(\|\.fixme(\|\.only(\)'` | repo | no hits | closeout | before gate | any test change |

Human gates: none. No deploy step (no schema change, nothing to reset).
CI on the PR runs on its own after the push.

## [PROGRESS]

- 2026-10-04: claimed; spec `ready-for-agent` → `in-progress`; proof root
  cleared (R19's `test-results/r19/` and `test-results/e2e/`).
- 2026-10-04, D2 (Sonnet): `4afb078b`. `CollapsibleDescription` (clamp `max-h-36`, Show more / less with `aria-expanded` only on overflow); Points Entries section gone (`ledger` still loaded); "Manage" link (`outline`) when `can(actor, "competition.edit", …)` passes; free-for-all: `CompetitionFacts` and `CompetitionList` take the War Week `mode`, `shownSettings` shows scoring only in teams mode or for a Team Competition. Bracket e2e and smoke checks that read the old section now read Points Entries from the DB and assert the section is absent. "Close it" link removed from `games-view`; the admin `games-builder` sentence stays (admin page text, no link). `e2e/regression-r20-page.spec.ts` (4 tests). Vitest 195 / 3918; smoke 278 ok.
- 2026-10-04, D1 (Opus): `5f481be6`. `src/lib/results-table.ts` (sort, `aria-sort`, ranks, Winners, `entryPointsFor`, `PROVISIONAL_TEXT`), `ResultsTable` with `ProvisionalBadge` and an expandable-row seam, `TopFinishers`; Placement (Top finishers 1–3 + table; badge reads "Closed"), team Participation (Score = headcount), individual Participation (points per person), `/[edition]/leaderboard` (breakdown as an expandable row; Team shown as a dot plus plain text for contrast). Closed points come from a new `entryPoints` field on the Placement and Participation views (`src/queries/entry-points.ts`), since `ledger` carries no target ids. At 390 the points fold under the name. `e2e/regression-r20-results-table.spec.ts` (5 tests incl. axe light/dark). Vitest 196 / 3931; smoke 278 ok.
- 2026-10-04: wave 1 integrated (`d77c4977`, merge clean) plus orchestrator fix `8eab5fe4` (unused import D1 left in `regression-r13-built-in-slides.spec.ts`). Candidate check on `d77c4977` in the integration worktree (`war_weeker_r20`): typecheck clean, lint 0 errors, vitest 196 files / 3934 passed, build ok, both R20 specs 9 passed. Open: `ledger` is now unused on the page (lint warning); wave 2 uses it or removes it.
- 2026-10-04, D3 (Opus): `b4f3db3d`. `attemptsOf` (best Attempt by direction, others newest first), `attemptsLabel`, `seriesOf`; `GamesViewRow.points` (Provisional by `pointsFor(placingsOf(…))`, Closed from Points Entries). Best score: Top finishers + results table with expandable Attempts ("2 more attempts"; total mode "3 attempts"), separate list gone on the Participant page and admin, Edit / Delete in the expanded row. Head-to-head with a fixed list of exactly two Entrants: series view (Series, Matches, Placement Points with Provisional); any other Head-to-head: results table plus its Matches. Approved reading: an open Head-to-head always gets the table (spec B makes two Entrants the rule). Vitest 196 / 3964; smoke 281 ok; 13 e2e passed.
- 2026-10-04, D4 (Opus): `5c5cf80c`. `src/lib/bracket/podium.ts` (`decidedPlaces`, `podium`, `podiumOf`; Group final capped at 4th like the close step), `BracketPodium` on `TopFinishers` (additive `provisional` and `after` props) replacing the Champion card in the view and admin; "Play the finale" and `finaleHref` gone; `champion` → `winner` (`getBracket`, `FormatEngine.winner`, `bracketWinner()`, `get_bracket`); unused `ledger` removed from the page. Bracket copy in its two files moved to Match / Close / Reopen. Squads of one Team: each place takes one of the Team's entries, best place the largest. Vitest 197 / 3946; smoke 278 ok; 17 e2e passed incl. podium axe light/dark.
- 2026-10-04: wave 2 integrated (`b3be2261`, `80619500`, merges clean). Candidate check on `80619500` (`war_weeker_r20`): typecheck clean, vitest 197 files / 3976 passed, build ok, smoke 278 ok, 23 e2e passed (every Bracket spec, games, placement, r18 games admin, all R20 specs). Left for D5 (from the reports): "Log a Game", "Save Game", "Game logged", "Entrants and Games", `organizer-guide.tsx` "Play the Finale" line, `recent-results.tsx` "Champion" / "Bracket finalized", "Finish every Heat before finalizing.", `heatName`, the Finale's "Champion of …".

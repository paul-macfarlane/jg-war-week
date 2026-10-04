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
- 2026-10-04, D5 (Opus): `b658350c`, `3b03eddb`. Match / Attempt / Winner / Close / Reopen across UI copy, refusals, the guide, `/about` and Finale copy; Format-aware nouns via `resultNoun` ("Log a Match" / "Log an Attempt"; "Log a result" on Home). MCP fields: `get_bracket` `heatSize` → `matchSize`, `thirdPlaceGame` → `thirdPlaceMatch`, `finalized` → `closed`, `rounds[].heats` → `rounds[].matches`; `get_games` `games` → `matches` / `attempts`; `get_placements` `finalized` / `finalizedAt` → `closed` / `closedAt` (approved: same rule, one more tool). UI components and helpers renamed (`MatchResultForm`, `ResultForm`, `LogAResult`, `WinnersSlide`, `MatchSettingsFields`, `YourNextMatchCard`, `closeCopy`, `matchName`, …); schema-tied names kept for spec B (config keys `entrantsPerHeat`, `thirdPlaceGame`, slide kind `"champions"`, `GamesView` / `GamesBuilder` named after the module). `src/lib/banned-terms.test.ts` scans literals and JSX text with the TypeScript compiler API; two spec-B allowlist entries. Vitest 198 / 3982; smoke 278 ok; full e2e 140 passed.
- 2026-10-04, D6 (Sonnet): `50ca7e2f`, `bcaa43b0`. CONTEXT glossary and banned table, guide "Read a results table" and the scan, checklist lines, testing.md cells; `scripts/about-media.ts` reads `ABOUT_MEDIA_PORT` / `ABOUT_MEDIA_DEBUG_PORT`; `/about` stills regenerated (`--stills`).
- 2026-10-04: D5 and D6 integrated (fast-forward). Aggregate code review started (below).
- 2026-10-04, DR1 (Opus): `84dee64b`, the code review fixes (below). Vitest 200 / 3994; smoke 278 ok; full e2e 141 passed.
- 2026-10-04, DR2 (Opus): `cfe50527`, `9c0ec252`. **[SCOPE CHANGE]** found by the docs review, inside the contract: decision 5 says semifinal losers with no 3rd place match "are not placed", but `finalPlacings` still tied them 3rd, so Close paid them. Now a head-to-head Bracket without a 3rd place match places only 1st and 2nd; no committed history seed has a Bracket, so no history points move. Plus the 24 docs review fixes. Vitest 198 / 3983; smoke 278 ok; 12 Bracket and Finale e2e passed.
- 2026-10-04: orchestrator fix `cd7024a7`: the Placement, Participation and Games closed notes said the Points Entries "are in the ledger"; they now say "in the Standings". DR2 and DR1 integrated; review complete.

## [AI CODE REVIEW]

2026-10-04. Two fresh Opus reviewers read `git diff d97b5364 3b03eddb` (code), one per axis; a third read the docs diff (`d97b5364..bcaa43b0`). The orchestrator ruled on each finding from the cited hunks. Every finding is resolved; one accepted risk.

**Technical implementation and spec conformity** (no blocking finding from the code reviewer; every AC mapped to a test):

| # | Finding | Severity | Disposition |
|---|---|---|---|
| T1 | Every tied rank 1 marked "Winner", even with no points (a teams leaderboard before any points) | non-blocking | Fixed `84dee64b`: no Winner when nothing decides first (no points or Score, or all tied); Top finishers follow the table |
| T2 | "Manage" 404s when the Competition's War Week isn't the admin edition | non-blocking | Fixed `84dee64b`: `/<edition>/competitions/<id>/manage` checks `admin.view`, sets the admin edition cookie, redirects; e2e from XII |
| T3 | Scan skips MCP property names | non-blocking | Fixed `84dee64b`: property names under `src/mcp/` scanned; planted `finalized:` fails |
| T4 | Allowlist exempts whole files | non-blocking | Fixed `84dee64b`: entries name the exact literal |
| T5 | `get_participation` description promises a close time | non-blocking | Fixed `84dee64b` |
| T6 | A Closed level series still says "decided at Close" | non-blocking | Fixed `84dee64b`: "Closed level: no series Winner." (`seriesNote`) |
| T7 | Free-for-all still shows Individual in the admin New Competition form and list | non-blocking | Fixed `84dee64b` |
| T8 | `sharedRanks` dead | non-blocking | Fixed `84dee64b` (deleted) |
| T9 | e2e assertion that can't fail ("No Games yet.") | non-blocking | Fixed `84dee64b` |
| T10 | Closed points summed every entry on the Competition, not just generated | non-blocking | Fixed `84dee64b`: `generatedByBracket = true` (every Close sets it) |
| T11 | Links in a clamped description stay tabbable | non-blocking | Accepted risk: Show more sits right after the clamp |
| T12 | (docs review) Close tied semifinal losers 3rd without a 3rd place match, against decision 5 | blocking | Fixed `cfe50527` |

**Coding standards** (no emails reach the client, MCP read-only, UI rules held, spec-B identifiers untouched, every new spec owns and deletes its records):

| # | Finding | Severity | Disposition |
|---|---|---|---|
| S1 | Ledger stack dead, its `points_entry` query still ran on every Competition page | blocking | Fixed `84dee64b`: plain `getCompetition`; `getCompetitionWithLedger`, `PointsEntryList`, `buildCompetitionLedger` deleted |
| S2 | `GameLog`, `GameActions`, `ResultFormGame`, `nextHeatFor` left with old words | non-blocking | Fixed `84dee64b` (`MatchLog`, `ResultActions`, `ResultFormValue`, `nextMatchFor`) |
| S3 | Finale `champions` data field and locals | non-blocking | Fixed `84dee64b` (`winners`; slide kind `"champions"` stays, a DB enum) |
| S4 | Old-word comments; half-renamed `src/db/schema.ts` comment | non-blocking | Fixed `84dee64b`; `schema.ts` restored to `staging` |
| S5 | = T8 | non-blocking | Fixed |
| S6 | `MatchLog` dead props | non-blocking | Fixed `84dee64b` |
| S7 | Inline Match/Attempt ternaries instead of `resultNoun` | non-blocking | Fixed `84dee64b` |
| S8 | = T5 | non-blocking | Fixed |
| S9 | `found_`, hand-typed mode union, shadowed `pointsFor`, duplicated `TOP_PLACES`, raw `<th>` | non-blocking | Fixed `84dee64b` |
| S10 | (docs review, 24 items) docs out of step with the fixes; mechanical swaps ("Closed or Closed"); stale "ledger" lines | non-blocking | Fixed `9c0ec252`; three closed notes in code `cd7024a7` |

Accepted risks: T11; the Manage route switches the admin edition on a GET (needs a session that passes `admin.view`; the admin page gates again); a Placement whose places earn 0 points and have no Score shows no Winner (as R19's "Done" with no winner).

## [CLOSEOUT]

2026-10-04.

- **Repository delivery:** `war-weeker`, branch `feat/r20-competition-results` from `staging` at `d97b5364`. Integration worktree `.claude/worktrees/r20-competition-results/war-weeker` with its own database (`war_weeker_r20`) and ports; worker worktrees `-a` and `-b` with `war_weeker_r20a` / `war_weeker_r20b`. Nothing touched the main checkout, the `war_weeker` database or ports 3100/3200, so the R22 session in its own worktree ran undisturbed.
- **Deliverables:**
  - D1 results table (Opus): `5f481be6`.
  - D2 page shell (Sonnet): `4afb078b`.
  - D3 Best score and Head-to-head (Opus): `b4f3db3d`.
  - D4 Bracket podium (Opus): `5c5cf80c`.
  - D5 the words and the banned-term scan (Opus): `b658350c`, `3b03eddb`.
  - D6 docs and stills (Sonnet): `50ca7e2f`, `bcaa43b0`.
  - DR1 code review fixes (Opus): `84dee64b`.
  - DR2 Close placing rule and docs review fixes (Opus): `cfe50527`, `9c0ec252`.
  - Orchestrator fixes: `8eab5fe4` (unused import), `cd7024a7` (closed notes point at the Standings).
- **Isolation check:** the predicted overlap (`page.tsx` between D1 ∥ D2 and D3 ∥ D4) was real: all four edited it, in separate hunks, and every merge was clean. D3 ∥ D4 also both regenerated each other's screenshots (Playwright wipes `test-results/e2e`); the final gate regenerated them all. Parallel waves were safe because each worker had its own database and ports.
- **Scope changes and approved readings:**
  - Close places only 1st and 2nd in a head-to-head Bracket without a 3rd place match (decision 5; DR2). No committed history seed has a Bracket.
  - The series view applies to a Head-to-head with a fixed list of exactly two Entrants; an open one keeps the table until spec B.
  - `get_placements` renamed `closed` / `closedAt` with the other MCP fields.
  - Home's compact standings card is unchanged; the leaderboard page uses the table.
  - Manage goes through `/<edition>/competitions/<id>/manage`, which sets the admin edition and redirects.
  - No Winner is marked when nothing decides first place.
  - Seed data names ("Chess Heats", Award names with "Champion") are data, outside the scan.
- **Gate:** the first full gate on `bd9f4f10` failed one vitest case, `src/mutations/account.test.ts` "refuses the last Organizer" (`ok: true`). That file is unchanged from `staging`. It passed 3 of 3 alone. The test deletes every Organizer inside its transaction, so a parallel test file committing an Organizer row can race it; this is an existing flake. The first log is kept outside the repo.
- **Verified run command:** `pnpm format:check && pnpm gate` with `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker_r20?sslmode=disable DATABASE_DRIVER=pg SMOKE_PORT=3120 E2E_PORT=3220`, exit 0 on `bd9f4f10`:
  - format clean; lint 0 errors, 9 warnings (the `<img>` baseline, one fewer than `staging`);
  - vitest 200 files, 3995 tests passed, 0 skipped;
  - smoke 278 ok, 0 FAIL;
  - e2e 141 passed (6.4m), 0 failed, 0 flaky.

  Log: `test-results/r20/gate.log`. No deploy and no schema change, so nothing to reset.

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| AC1 table | PASS | gate.log (vitest `results-table.test.ts`, `leaderboard.test.ts`); `test-results/e2e/regression-r20-results-tab-*`, `regression-r20-best-score-*` (sort, `aria-sort`, Winner label, no "Score" in cells, no sideways scroll at 1440 and 390) |
| AC2 provisional | PASS | `regression-r20-results-tab-…-generated-Points-Entries-*` (tooltip by Tab; after Close points equal the DB's generated entries); `regression-r20-head-to-hea-*` |
| AC3 no Point Entries | PASS | `regression-r20-page-r20-no-*` (all five Formats, 1440 and 390) |
| AC4 Best score | PASS | gate.log (`attemptsOf`, total mode); `regression-r20-best-score-*` (one place, keyboard expansion, total sum, admin edit and delete in the row) |
| AC5 podium | PASS | `bracket-a-Bracket-…-1st-and-2nd-*`, `bracket-third-place-…-10-7-5-and-3-*`, `bracket-heats-…-final-Match-s-order-*` (podium shots and axe light/dark); `podium.test.ts` |
| AC6 series | PASS | `regression-r20-head-to-hea-*`; `view.test.ts` (`seriesOf`, `seriesNote`) |
| AC7 description | PASS | `regression-r20-page-r20-th-*` (1440 and 390) |
| AC8 Manage | PASS | `regression-r20-page-r20-Ma-*` (two tests: roles; from XII to its admin page) |
| AC9 words + scan | PASS | gate.log (`banned-terms.test.ts`; planted "Heat" literal and `finalized:` MCP key shown failing in D5 and DR1 reports) |
| AC10 free-for-all | PASS | `regression-r20-page-r20-a--*`; `competitions-editor.test.tsx`, `competitions.test.tsx` |
| AC11 MCP | PASS | gate.log smoke (`matches`, `attempts`, `closed`, `winner`, no old keys, no `@`); `src/mcp/*.test.ts` |
| DoD1 showcase | PASS | `/about` copy (D5), stills `public/about/*` (`bcaa43b0`), guide and checklist (`50ca7e2f`, `9c0ec252`) |
| DoD2 CONTEXT | PASS | `CONTEXT.md` glossary, banned table, display rules (`50ca7e2f`, `9c0ec252`) |
| DoD3 screenshots + axe | PASS | `test-results/e2e/` from the final gate (1440 and 390 for every changed page); axe on the table (`regression-r20-results-tab-*` light/dark) and the podium (Bracket specs, light/dark) |
| DoD4 gate | PASS (local); CI on the PR pending | gate.log |
| X1 skip grep | PASS | `git diff d97b5364 -- e2e src scripts \| grep …` empty |

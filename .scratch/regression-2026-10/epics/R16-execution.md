# Execution record: Epic R16, the Competition model

Contract: [`R16-competition-model.md`](./R16-competition-model.md) (one work package) and its parts
[`90`](../issues/90-placement-format.md), [`91`](../issues/91-discretionary-points.md),
[`92`](../issues/92-remove-max-points.md), [`93`](../issues/93-head-to-head-and-best-score-formats.md),
[`94`](../issues/94-participation-follows-scoring.md), [`95`](../issues/95-placement-points-without-a-limit.md),
with the decisions in each and `../grilling-2026-10-03.md`. `96` is folded into the epic.
No `/atlas-plan` ran. On 2026-10-03, `/atlas-implement` derived this plan against `staging` at `e68f474` (PR #125 merged).
Red-team: required; passes 1–3 done, contract accepted by Paul.
Branch: `feat/regression-r16-competition-model`.

## [EXECUTION PLAN]

2026-10-03.

### Run record

- Work package `regression-r16`; branch from `staging` at `e68f474`, which is the review comparison point.
- Structure: waves. Schema work is serial (the epic's rule); after the foundation the three remaining parts run in parallel.
  - **Wave 1, D1a — schema and the one migration** (one worker, direct checkout). Every part's schema change goes into `src/db/schema.ts` at once (90: `placement` Format, `score_direction`, `placement` table; 91: `points_entry.war_week_id`, nullable `competition_id`, `points_entry_reason_without_competition`, seed uniqueness on `(war_week_id, seed_key)`; 92: drop `max_points`; 93: `head-to-head` / `best-score`, drop `game_type` and its enum, new `game_config` CHECK; 94: drop `participation_team_scoring` and its enum, new `competition_participation_columns`). `pnpm db:generate` runs once under `script`, answering create; the SQL is hand-edited in the epic's six steps; the epic's migration test is written; the local database is migrated. The app won't typecheck after D1a; that is expected and D1b follows at once.
  - **Wave 1, D1b — make it compile; parts 92 and 94 whole, 93's removals.** Same checkout, after D1a. Max Points removed everywhere (92 complete). Participation's team mode removed and the settings show only the fields that apply (94 complete). `game_type`, `ranked` and Finish Points removed, `games` split into `head-to-head` / `best-score` and `points` renamed `placement` through code, seed schema and loader, MCP. Every Points Entry insert sets `war_week_id`. Seed JSON gets only the **mechanical** strip (the four dropped keys, Format renames, ranked → empty `placement`, Daily Workout Check-in's team mode) so seeds keep loading; the substantive conversion is DS. Typecheck, lint and unit green at the end.
  - **Wave 2, in parallel worktrees `.claude/worktrees/regression-r16/war-weeker/<d>`:**
    - **D90 — the Placement sheet** (part 90 whole except its e2e run): rules, actions, `placement.*` access, route `/admin/placements/[competitionId]`, Score direction, the Participant page, Recent results, the seed loader's `placements` / `finalized*`, MCP. Writes the e2e spec; doesn't run it.
    - **D91 — Discretionary points** (part 91 whole except its e2e run): actions, `discretionary.*`, the page and redirects, every Points Entry read scoped by `war_week_id`, the Points page and its dependants deleted or rewritten (smoke, e2e, about-media), the seed loader's `discretionaryPoints`, MCP. Writes the e2e spec; doesn't run it.
    - **D93 — parts 93 and 95 remainder:** the Formats in the UI (labels, Format picker, game settings without Finish Points), `e2e/games.spec.ts` rewritten, smoke's `games` checks, MCP `get_games`; part 95's open Placement Points list (per-Format limit in one place, Brackets 5) and its list editor with the 20-place component test.
    - Predicted collisions: `src/lib/access.ts` and `access.test.ts` (D90 and D91 each add actions: additive), `src/seed/schema.ts` and `src/seed/load.ts` (D90 placements, D91 discretionary: additive sections), `src/components/competitions-editor.tsx` (D90 Score direction, D93 Format list and Placement Points editor), `scripts/about-media.ts` and `scripts/smoke/*` (D91 Points page removal, D93 games checks), `docs/agents/testing.md`'s command table. The orchestrator resolves these at integration. Integration order D93, D90, D91.
  - **Wave 3, DS — seed conversion and seed tests** (direct checkout): the epic's Seed conversion rule over every seed file, Subjective Points → Discretionary, Step Challenge with Scores, old `pointsEntries` removed from seeds and the seed schema; the frozen XI test; the three load-twice sets in throwaway databases; the seed grep.
  - **Wave 4, DE — smoke and e2e** on the integrated branch: build once, add the smoke checks (placement row count, the three CHECK refusals, MCP Formats / Placements / Discretionary), run the full smoke and e2e serially (port 3200 and the shared local database can't run in parallel worktrees), fix test-side defects, report product defects.
  - **Wave 5, DX — docs:** the new ADR (Placement writes, Discretionary points) and ADR 0002's table, `CONTEXT.md` (grilling glossary list and each part's line), `/about` copy and stills, `docs/maintainers-guide.md` (including the staging and prod reset), `docs/regression-checklist.md`, `docs/agents/testing.md`'s rows.
  - Then the aggregate review, `pnpm format:check && pnpm gate` on the integrated commit, closeouts and the PR.
  - Edges: D1a → D1b → {D90, D91, D93} → DS → DE → DX → gate.
- Workers run `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` with local Postgres (`docker compose up -d`, `DATABASE_URL`/`DATABASE_DRIVER` from `.env.example`). Postgres test files must run, not skip.
- Proof-artifact root `test-results`: the prior work package's `test-results/r15/` and the stale `test-results/r10-accounts/` are removed in the claim commit. `test-results/e2e/` is regenerated by the gate; `test-results/about-media/` by DX. R16 evidence lives under `test-results/e2e/<test>/` and `test-results/r16/` (gate log, migration and seed test output).

### Resolved decisions

- **Migration:** one `drizzle/0028_*.sql`. Executing workers may not generate another; D1a owns it. A later schema need found in wave 2 comes back to the orchestrator, which amends 0028 serially (regenerate from the 0027 snapshot and reapply the hand edits), never adds 0029.
- **Interim seed state:** between D1b and DS, a `placement` Competition may still carry seeded typed entries (the old `points` ones). D90's loader doesn't refuse them; DS removes them and the seed schema's `pointsEntries`.
- **New ADR:** `docs/adr/0010-placement-and-discretionary-points.md`.
- **Seed keys for generated entries of a seeded finalized Placement:** `<competition seed key>:<placement key>` (part 91).

### Verification map

| Criterion | Command / action | Surface | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| E1 migration | `pnpm test src/db/migrations.test.ts` | vitest, local Postgres, throwaway database | old-row shapes migrate in one transaction; Formats mapped; ranked emptied; team Participation coerced; `war_week_id` backfilled | `test-results/r16/vitest.txt` (ran, not skipped) | after D1a | `drizzle/`, `schema.ts` |
| E2 frozen XI | `pnpm test` (frozen XI test) | vitest, Postgres | `getStandings` Red 38.5, Blue 31 | `test-results/r16/vitest.txt` | after DS | `seeds/xi.json`, `src/seed/`, standings |
| E3 load twice | `pnpm test` (three sets, throwaway databases) | vitest, Postgres | row counts stable; one Subjective Points entry per XI Team; Step Challenge finalized with Scores | `test-results/r16/vitest.txt` | after DS | `seeds/`, `src/seed/`, `drizzle/` |
| E4 seed grep | the epic's `grep … seeds` | repo | no hits | closeout | after DS | `seeds/` |
| E5 skip grep | `git diff e68f474 -- e2e src scripts \| grep …` | repo | no hits | closeout | before gate | any test change |
| E6 smoke checks | `pnpm smoke` | build + Postgres | placement count stable; three CHECKs refuse violating inserts | `test-results/r16/gate.log` | after DE | `scripts/smoke/`, schema |
| E7 ADR | review `docs/adr/` | repo | new ADR; ADR 0002 table updated | DX commit | after DX | — |
| E8 MCP | `pnpm test src/mcp`; smoke MCP check | vitest + smoke | Formats, Placements, Discretionary reported; no `@` | gate log | after DE | `src/mcp/` |
| E9 showcase | review `/about`, stills, guide, checklist | repo | updated where user-visible; reset described | DX commit | after DX | later UI change |
| E10 CONTEXT | review `CONTEXT.md` | repo | glossary list and part lines applied | DX commit | after DX | — |
| E11 closeouts | part files and epic | repo | closeouts, `done`, PR URL | closeout commit | closeout | — |
| E12 PR step | PR body | GitHub | reset listed as Paul's post-merge step | PR | closeout | — |
| E13 gate | `pnpm format:check && pnpm gate`; PR CI | local + CI | exit 0; CI green | `test-results/r16/gate.log` | before PR | any change |
| P90-unit, -access, -action, -mcp | `pnpm test` | vitest, Postgres | part 90's cases | gate log | after D90 | Placement code |
| P90-e2e | `pnpm e2e` (Placement spec) | build, demo XI | part 90's flow; 1440 and 390 shots | `test-results/e2e/<test>/` | after DE | Placement UI |
| P91-unit, -access, -action, -query, -mcp, -loader | `pnpm test` | vitest, Postgres | part 91's cases | gate log | after D91 | Discretionary code, Points Entry reads |
| P91-e2e | `pnpm e2e` (Discretionary spec) | build | give, edit, delete; Host refused; redirect; `/admin` lands on Competitions | `test-results/e2e/<test>/` | after DE | admin pages |
| P92-grep | `grep -rni "max.\?points\|No max" src e2e scripts` | repo | no hits | closeout | after D1b | any change |
| P93-unit, -mcp | `pnpm test` | vitest | leaderboards, Close/Reopen; `get_games` Formats | gate log | after D93 | games code |
| P93-grep | part 93's grep | repo | no hits outside `drizzle/` | closeout | after D93 | any change |
| P93-e2e | `pnpm e2e e2e/games.spec.ts` | build | head-to-head from Home, Host closes, Standings move | gate log | after DE | games UI |
| P94-unit | `pnpm test src/lib/participation` | vitest | individual N each; team by headcount with ties | gate log | after D1b | participation code |
| P94-e2e | `pnpm e2e` (Participation specs) | build | team rewritten; individual N each | gate log | after DE | participation UI |
| P95-unit | `pnpm test` | vitest | 12 places for Placement; 6 refused for a Bracket; non-increasing | gate log | after D93 | `placement-points.ts` |
| P95-ui | component test; e2e 390 screenshot with 20 places | vitest + build | every input reachable, no horizontal scroll | `test-results/e2e/<test>/` | after DE | Placement Points editor |

Human gates: none before or during delivery. **Announced for later (outside this work package):** the epic's reset of staging then prod (Seed workflow with reset, prod pre-check before the `staging` → `main` merge). It needs the merged PR, so it goes in the PR description as Paul's post-merge step (E12).

## [PROGRESS]

- 2026-10-03, wave 1 on the branch (claim commit `c980ebc`):
  - D1a (Opus): `dbaf067`. Schema and migration `0028_flimsy_vertigo`, generated once under `script` (one create-or-rename prompt, answered create), then hand-edited in the epic's six steps. Migration test on a throwaway database. The shared local database migrated.
  - D1b (Sonnet): `85d008d`, `3877706`, `774afee`. The app compiles; parts 92 and 94 done; 93's removals; seed JSON mechanical pass; every Points Entry insert sets `war_week_id`.
- Wave 2, in parallel worktrees, integrated in the order D93, D91, D90:
  - D93 (Sonnet): `2023076`.
  - D91 (Sonnet): `3e8783d`. Three conflicts with D93, all in copy (organizer guide, `llms.txt`, an import); resolved keeping both sides.
  - D90 (Opus): `88b00c4`, `a6247ad`. Additive conflicts with D91 in the seed schema and `setup.ts`, and with D93 in the Competitions-list link label; resolved keeping both.
  - Integrated typecheck, lint and unit (183 files, 3790 tests) green.
- Wave 3, DS (Sonnet): `06405ae`. Every seed converted, `pointsEntries` retired from the seed schema, frozen XI test, three load-twice sets.
- Wave 4, DE (Sonnet): `63e09a8`. Smoke and e2e green on the build. Test-side fixes only: `openForBracket` in `e2e/db.ts` (the Bracket specs used seeded Competitions that are now Finalized Placements), the ledger's edited mark, a header `li`, the phone section bar. Orchestrator copy fix `dfddb76`: the Competitions intro and the Placement Format description still described the Points page.
- Wave 5, DX (Sonnet): `4dd2d95`.
- Review fixes: RFB (Sonnet) `09167ba`, `4214f9f`; RFA (Opus) `f745fd7`; orchestrator `d3fbc3b` (leftover comments in RFA's files) and `b1b8758` (the About spec's card title).
- Parallelism check: wave 2's predicted collisions (access, seed schema and loader, `competitions-editor.tsx`, smoke, about-media) were partly right. The real conflicts were the seed schema, `setup.ts`, `competitions.ts`/`.test.ts` (the setup link label), `points-entry.ts`, the organizer guide and `llms.txt`. `access.ts`, `competitions-editor.tsx` and smoke merged cleanly. Every conflict was additive or copy, so running wave 2 in parallel was the right call.

## [AI CODE REVIEW]

2026-10-03. Two independent Opus reviewers read `e68f474..dfddb76` (code, tests, scripts, seeds; docs reviewed by the orchestrator). The orchestrator adjudicated each candidate by reading the cited hunks. Fixes are in `09167ba`, `4214f9f`, `f745fd7` and `d3fbc3b`.

- **Spec conformity, blocking (resolved):**
  - F1: closing a Best score Competition noted its entries "From head-to-head"; a test had locked it in.
  - F2: a Finalized Placement was refused with Bracket wording ("Un-finalize the Bracket"). It now says "This Competition is finalized. Reopen it first."
  - F3: part 90's refusal cases were tested only at mutation level. They are now action tests through `authorize`.
  - F5: typing any Score re-filled every Place and wiped manual tie-breaks. `refilledPlaces` now overwrites only rows whose computed place moved or whose own Score changed. Unit tests added, and the e2e edits a Score after the tie-break.
- **Coding standards, blocking (resolved):**
  - S1: a deleted race test had no replacement. Added a two-connection test, `addPlacement` beside a scoring change.
  - S4: the free-for-all "no Teams" rule for Discretionary points was enforced only on the page. It is now enforced server-side on create and edit.
- **Non-blocking (resolved):**
  - Migration test gains an individual Participation row (F4).
  - Re-Finalize comments match its behaviour (F6).
  - Recent results' unreachable manual-entry grouping removed and its e2e retargeted to Discretionary points (F7).
  - Edited means `updatedAt > createdAt`, with no backdating in e2e (F8).
  - Smoke's entry count follows the Placement Points length (F11).
  - `placementEntryValues` and row ordering moved to `src/lib/placement/score.ts` (S2, S3).
  - One ledger type (S5).
  - `games`-Format and "hand-entered" comments and wording (S6, S7).
  - `getPointsEntryFormOptions` → `getTargetOptions` in `src/queries/target-options.ts` (S8).
  - "Choose Head-to-head or Best score." (S9).
  - One limit message (S10).
  - Bracket snapshots carry `score_direction` (S11).
  - Save shows "Saving…" only for Save; one icon-button size (S12).
  - Docs: the guide pointed at a deleted form; `/about` and `CONTEXT.md` named "Games" as a Format (S13).
- **Recorded deviations (accepted):**
  - F9: part 91's MCP AC is met by a separate `get_discretionary_points` tool (reason and points, no emails); `get_leaderboard` still reports totals only.
  - F10: migration step 2 recreates `competition_format` through a `text` cast (drop old type, create new one of the same name, cast back with the `CASE`). This is not the epic's create → alter → drop order: a new type can't take the old one's name while it exists. The result is the same: no `RENAME`, no `ADD VALUE`.
  - Seed key: a seeded Finalize's generated entries use `placement:<placement key>`, because Competitions have no seed key (part 91 assumed `<competition seed key>:<placement key>`).
  - Part 92's and 93's greps still hit the migration test's pre-R16 fixture and the seed-schema test that refuses the removed keys. Those lines must name the old columns and keys.
  - S12: Score formatting in `placement-view.tsx` stays inline (no lib formatter fits `numeric(12,3)` without a unit).
- No finding was rejected.

## [VERIFICATION]

2026-10-03. Every criterion has a final, evidence-backed verdict. Gate log: `test-results/r16/gate.log`. Commands were run with `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`.

| Criterion | Verdict | Proven at | Evidence |
|---|---|---|---|
| E1 migration | PASS | `b1b8758` | `src/db/migrations.test.ts` R16 block in the gate's unit run (184 files, 3800 tests, none skipped); it was shown to fail without the team-Participation coercion and without the individual one |
| E2 frozen XI | PASS | `b1b8758` | `src/seed/seed-sets.test.ts` "War Week XI's frozen Standings": Red 38.5, Blue 31 under edition `xifrozen` |
| E3 load twice | PASS | `b1b8758` | `src/seed/seed-sets.test.ts`: three sets in throwaway databases; one Subjective Points entry per XI Team; Step Challenge finalized with 12 scored rows |
| E4 seed grep | PASS | `b1b8758` | `test-results/r16/greps.txt` (no hits) |
| E5 skip grep | PASS | `b1b8758` | `test-results/r16/greps.txt` (no hits vs `f6d1605`) |
| E6 smoke checks | PASS | `b1b8758` | gate smoke: placement count stable after two loads; `points_entry_reason_without_competition`, `placement_exactly_one_target` (both ways) and `competition_participation_columns` (three ways) refused; 263 ok, 0 FAIL |
| E7 ADR | PASS | `b1b8758` | `docs/adr/0010-placement-and-discretionary-points.md`; ADR 0002's table |
| E8 MCP | PASS | `b1b8758` | `src/mcp/placements.test.ts`, `discretionary-points.test.ts`, `games.test.ts` (no `@`); smoke MCP checks for the Formats, `get_placements` and `get_discretionary_points` |
| E9 showcase | PASS | `b1b8758` | `/about` copy and stills (`public/about/`), `docs/maintainers-guide.md` (reset section), `docs/regression-checklist.md` |
| E10 CONTEXT | PASS | `b1b8758` | `CONTEXT.md`: Placement, Record placements, Score direction, Discretionary points, Formats; Game Type, ranked, Finish Points and per-person retired |
| E11 closeouts | PASS | closeout commit | part files 90–95 and the epic: `[CLOSEOUT]`, `Status: done` |
| E12 PR step | PASS | PR | the PR description lists the reset as Paul's post-merge step |
| E13 gate | PASS (local); CI pending on the PR | `b1b8758` | `pnpm format:check && pnpm gate` exit 0: 184 files (3800 tests), build, smoke 263 ok, e2e 106 passed |
| P90 unit, access, action, MCP | PASS | `b1b8758` | `src/lib/placement/*.test.ts`, `access.test.ts`, `src/actions/placements.test.ts`, `src/mutations/placements.test.ts`, `src/mcp/placements.test.ts` |
| P90 e2e | PASS | `b1b8758` | `e2e/placement.spec.ts`; shots at 1440 and 390 in `test-results/e2e/placement-r16-90-*/` |
| P91 unit, access, action, query, MCP, loader | PASS | `b1b8758` | `discretionary-points` tests in lib, actions, mutations, queries and MCP; `access.test.ts`; `src/seed/load.test.ts` |
| P91 e2e | PASS | `b1b8758` | `e2e/discretionary-points.spec.ts`: give 3, edit to 4, delete; Host refused; `/admin/points` redirects; `/admin` lands on Competitions |
| P92 grep | PASS | `b1b8758` | `test-results/r16/greps.txt` (only the recorded migration-fixture lines) |
| P93 unit, MCP | PASS | `b1b8758` | `src/mutations/games.test.ts` (Close notes by Format), leaderboard tests, `src/mcp/games.test.ts` |
| P93 grep | PASS | `b1b8758` | `test-results/r16/greps.txt` (only the recorded fixture and rejection-test lines) |
| P93 e2e | PASS | `b1b8758` | `e2e/games.spec.ts` (Head-to-head from Home, Host closes, Standings move) |
| P94 unit | PASS | `b1b8758` | `src/lib/participation/score.test.ts`, `src/mutations/participation.test.ts` |
| P94 e2e | PASS | `b1b8758` | `e2e/regression-r12-participation.spec.ts`: team ranked; individual N each |
| P95 unit | PASS | `b1b8758` | `src/lib/competitions.test.ts`, `setup.test.ts`, `src/seed/schema.test.ts` (12 places for Placement; 6 refused for a Bracket; non-increasing) |
| P95 UI | PASS | `b1b8758` | `placement-points-rows.test.tsx` (20 places saved); `test-results/e2e/placement-points-20-places/390.png`, no horizontal scroll asserted |

The first gate run (`test-results/r16/gate-run1-failed.log`, at `d3fbc3b`) failed one e2e. `e2e/about-games.spec.ts` still expected the old `/about` card title. It was fixed in `b1b8758`, and the full gate was rerun green.

## [CLOSEOUT]

2026-10-03, `/atlas-implement`.

- **Repository:** `war-weeker`, branch `feat/regression-r16-competition-model`, base `staging` at `e68f474` (the comparison point).
- **Deliverables and models:**
  - Opus: D1a, D90, RFA.
  - Sonnet: D1b, D91, D93, DS, DE, DX, RFB.
  - Reviews: two Opus reviewers.
  - Orchestrator fixes: `dfddb76` (Points-page copy), `d3fbc3b` (comments), `b1b8758` (About spec), and conflict resolution at each integration.
- **Deviations:** see [AI CODE REVIEW], "Recorded deviations". Also, beyond the contract:
  - A team Participation Competition defaults to Placement Points `[3, 2, 1]`.
  - A scoring change is refused while a Placement has rows.
  - A switch to a Bracket Format is refused when the Placement Points exceed 5.
  - The seed schema refuses removed keys and the retired `pointsEntries`; the migration nulls stray `game_config` and adds `points_entry_competition_id_idx`.
  - Recent results no longer groups non-generated Competition entries (none can be created).
- **Verified run command:** `pnpm format:check && pnpm gate`, with the local `DATABASE_URL`/`DATABASE_DRIVER` from `.env.example`. No deploy in this work package.
- **Human step after merge (Paul):** reset staging, then prod, as in the epic's "Human prerequisite" (also in `docs/maintainers-guide.md`).
- **Remaining risks:**
  - The migration has run only on local data and the throwaway-database test, never on staging's real rows. If `migrate.yml` fails, don't reseed; fix it on a `fix/…` branch.
  - The Placement sheet is deliberately simple; Paul expects feedback.
  - `src/mutations/account.test.ts` flaked once during DS and passed on every later run.
- **PR:** https://github.com/paul-macfarlane/jg-war-week/pull/126 into `staging`.

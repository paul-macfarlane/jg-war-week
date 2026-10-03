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

# Execution record: Epic R17, Brackets

Contract: [`R17-brackets.md`](./R17-brackets.md) (one work package) and its parts
[`97`](../issues/97-one-bracket-format.md), [`99`](../issues/99-remove-seeding-forfeit-time-and-place.md),
[`98`](../issues/98-third-place-game.md), [`100`](../issues/100-one-bracket-tree.md),
with the decisions in each and `../grilling-2026-10-03.md`.
No `/atlas-plan` ran. On 2026-10-03, `/atlas-implement` derived this plan against `staging` at `8ceb8f3` (PR #126 R16 and PR #127 red-team merged).
Red-team: required; pass 1 resolved in the epic.
Branch: `feat/regression-r17-brackets`.

## [EXECUTION PLAN]

2026-10-03.

### Run record

- Work package `regression-r17`; branch from `staging` at `8ceb8f3`, the review comparison point.
- Structure: **sequential**, direct checkout. The epic makes the Bracket files serial (one owner at a time, part order 97 → 99 → 98 → 100), and nearly every deliverable touches them (`src/lib/bracket/*`, `src/mutations/brackets.ts`, `src/actions/brackets.ts`, `bracket-builder.tsx`, `heat-result-form.tsx`, `bracket-tree.tsx`, `bracket-view.tsx`, `e2e/bracket*.spec.ts`), so no two run in parallel and no worktrees are made.
  - **D1 — schema and the one migration.** Every schema change in the epic's table goes into `src/db/schema.ts` / `src/lib/enums.ts` at once; `script -q /dev/null pnpm db:generate` once, answering create; the SQL hand-edited in the epic's six steps into `drizzle/0029_*.sql`; the epic's migration test on old rows in `src/db/migrations.test.ts`; the local database migrated. The app need not typecheck after D1.
  - **D97 — one Bracket Format** (part 97 whole): Format `bracket`, `bracket_config` never null (2/1/false default), the engine dispatch in one place in `src/lib/bracket/`, `placementLimit`, builder's one Format option with heat size / advancing and the "Head-to-head (single elimination)" preset, seed schema (`bracket` with required config, old names refused, the renamed seed-schema test), seed JSON conversion (demo XII Chess Heats and every seed), MCP Format naming. May leave typecheck red only where 99 removes things (Heat time and place, Forfeit, Standings seeding).
  - **D99 — removals and `recorded_at`** (part 99 whole): Standings seeding, Forfeit, Time & place with every reader listed in 99, `recorded_at` set and cleared, the schedule test, the e2e specs rewritten (not run). Typecheck, lint and unit green at the end.
  - **D98 — 3rd place game; places up to 4th** (part 98 whole): the switch, server refusals and lock, `loser_to_*` and the `third_place` Heat at Generate, places and points, every "final" reader, `BRACKET_PLACEMENTS = 4`, the e2e spec written (not run).
  - **D100 — one tree** (part 100 whole): record from the tree for whoever may record, `bracket-results.tsx` and its tests deleted, no List toggle, the tree scrolls in its own container, the e2e specs written (not run); the Postgres action refusal test.
  - **DE — smoke and e2e** on the integrated branch: build once; smoke's MCP and Bracket checks updated; run full smoke and e2e serially (port 3200 and the shared local database); fix test-side defects, report product defects to the orchestrator.
  - **DX — docs:** `CONTEXT.md`, `/about` copy and stills, `docs/maintainers-guide.md` (including the reset), `docs/regression-checklist.md`, `docs/agents/testing.md`'s smoke and e2e rows.
  - Then the aggregate review, `pnpm format:check && pnpm gate` on the integrated commit, closeouts and the PR.
  - Edges: D1 → D97 → D99 → D98 → D100 → DE → DX → gate.
- Workers run `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` with `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg` (local Postgres container `war-weeker-postgres`). Postgres test files must run, not skip.
- Proof-artifact root `test-results`: the prior work package's `test-results/r16/`, the stale `test-results/r10-accounts/` and `test-results/e2e/` are removed in the claim commit; the gate regenerates `test-results/e2e/`, DX regenerates `test-results/about-media/`. R17 evidence: `test-results/r17/` (vitest summary with skipped count, gate log) and `test-results/e2e/<test>/`.

### Resolved decisions

- **Migration:** one `drizzle/0029_*.sql`, owned by D1. A later schema need comes back to the orchestrator, which amends 0029 serially (regenerate from the 0028 snapshot and reapply the hand edits), never adds 0030.
- **Engine names stay internal:** the single-elimination and Heats engines keep their module and function names; only the Format value, config, UI, copy, MCP and seeds say Bracket.
- **Interim state:** between D1 and D99, code that reads dropped columns may not compile; D99 ends with the build checks green.

### Verification map

| Criterion | Command / action | Surface | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| E1 migration on old rows | `pnpm test src/db/migrations.test.ts` | vitest, local Postgres, throwaway DB | commits; both `bracket`; configs {2,1,false}, {4,2,false}; no Heats, generated entries or `finalized_at`; 4 Placement Points | `test-results/r17/vitest.txt` (ran, not skipped) | after D1 | `drizzle/`, `schema.ts` |
| E2 seeds load twice | `pnpm test src/seed/seed-sets.test.ts` | vitest, Postgres | row counts unchanged on second load | `test-results/r17/vitest.txt` | after D97 | `seeds/`, `src/seed/`, `drizzle/` |
| E3 Format grep | epic's `grep … src/lib/enums.ts src/seed/schema.ts seeds` | repo | no hits | closeout | after D97 | those files |
| E4 skip grep | `git diff 8ceb8f3 -- e2e src scripts \| grep …` | repo | no hits | closeout | before gate | any test change |
| E5 MCP | `pnpm test src/mcp`; smoke MCP check on Chess Heats | vitest + smoke | Bracket with heat size, advancing, 3rd place game; no Heat time/place/Forfeit; `recordedAt`; 3rd place marked; champion = final's winner; no `@` | `test-results/r17/gate.log` | after DE | `src/mcp/`, smoke |
| E6 testing.md rows | review | repo | smoke and e2e rows describe the rewritten flows | DX commit | after DX | later flow change |
| E7 showcase | review `/about`, stills, guide, checklist | repo | updated; reset described | DX commit | after DX | later UI change |
| E8 CONTEXT | review `CONTEXT.md` | repo | Bracket terms; retired terms | DX commit | after DX | — |
| E9 closeouts | part files and epic | repo | closeouts, `done`, PR URL | closeout commit | closeout | — |
| E10 PR step | PR body | GitHub | reset listed as Paul's post-merge step | PR | closeout | — |
| E11 gate | `pnpm format:check && pnpm gate`; PR CI | local + CI | exit 0; CI green | `test-results/r17/gate.log` | before PR | any change |
| P97-engines, P97-dispatch | `pnpm test src/lib/bracket` | vitest | engine tests through `bracket` at 2/1 and 4/2; dispatch picks single-elim for 2/1 only | gate log | after D97 | `src/lib/bracket/` |
| P97-builder | `pnpm test src/components/bracket-builder.test.tsx`; E3 grep | vitest | one Bracket option, heat size / advancing, preset label | gate log | after D97 | builder |
| P99-grep | part 99's two greps | repo | no hits | closeout | after D99 | any change |
| P99-recorded | `pnpm test` (Postgres mutation tests) | vitest, Postgres | `recorded_at` set on Organizer save, self-report, edit; cleared by Reset and forced regenerate | gate log | after D99 | `src/mutations/brackets.ts` |
| P99-schedule | `pnpm test src/queries/schedule.test.ts` | vitest, Postgres | no Heat in Schedule | gate log | after D99 | `src/queries/schedule.ts` |
| P99-e2e | `pnpm e2e` (bracket, heats, squads specs) | build, Postgres | flows without time / Forfeit; "Your next Heat" no time; "Recorded <time>" | `test-results/e2e/<test>/` | after DE | Bracket UI |
| P98-unit | `pnpm test src/lib/bracket` | vitest | places/points with and without; Heats final 1–4; 4 Entrants; refusals; final readers | gate log | after D98 | bracket lib |
| P98-pg | `pnpm test` (Postgres) | vitest, Postgres | toggle refused once a Heat Result exists | gate log | after D98 | mutations |
| P98-cap | `pnpm test` | vitest | over 4 refused with `placementLimitRefusal` | gate log | after D98 | `competitions.ts` |
| P98-e2e | `pnpm e2e` (3rd place spec) | build | 8 with 3rd place to Finalize; 10/7/5/3; 1440 shot | `test-results/e2e/<test>/` | after DE | Bracket UI |
| P100-record, P100-access | `pnpm e2e` (tree specs); Postgres action test | build + vitest | records from both trees; no List toggle; no button where not allowed; server refuses | `test-results/e2e/<test>/`, gate log | after DE | tree, access |
| P100-390 | `pnpm e2e` | build | container scrolls, page doesn't; shots 1440 and 390 | `test-results/e2e/<test>/` | after DE | tree layout |
| P100-axe | `pnpm e2e` | build | axe passes in both schemes | gate log | after DE | tree |
| P100-delete | `grep -rn 'Run results\|BracketResults' src e2e` | repo | no hits | closeout | after D100 | any change |

Human gates: none before or during delivery. **Announced for later (outside this work package):** the epic's reset of staging then prod (Seed workflow with reset; prod pre-check before the `staging` → `main` merge). It needs the merged PR, so it goes in the PR description as Paul's post-merge step (E10).

## [PROGRESS]

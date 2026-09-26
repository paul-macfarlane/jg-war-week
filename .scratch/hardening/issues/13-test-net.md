# 13: Test net: domain gaps and Playwright flows

**What to build:** Enough automated safety to refactor (11, 12) and add features (16) without regressions.

**Blocked by:** 03, 06

**Status:** done

## Scope

- **Vitest domain gaps:**
  - a `getStandings` query test that the join is scoped to one War Week
  - Standings with negative points
  - a team-targeted entry on an individual Competition being refused
  - Counts Toward Team for a Participant with no Team
  - Bracket: editing Placement Points after finalize (refused, from 05)
  - Bracket: a manual Points Entry racing a finalize
  - Bracket: a re-record that keeps the same winner (07)
- **Playwright**, about five flows, against local Postgres with the demo seed and a stubbed JG session (no real Google):
  1. A non-JG session is refused, and anonymous visitors are sent to `/sign-in`.
  2. Points Entry → Standings update on `/xi/leaderboard`.
  3. A Bracket is built, results are recorded, it advances and finalizes, and Points Entries appear.
  4. The Finale plays and ends on first place.
  5. The Archive renders each past edition.
- Add Playwright to CI after smoke (ticket 06). Screenshots go to `test-results/<test-name>/` per `docs/agents/testing.md`.
- Update the `docs/agents/testing.md` command table with the new `e2e` command.

## Acceptance criteria

- [x] The five flows pass locally and in CI.
- [x] The new vitest cases pass and fail when the rule they cover is broken (check one of them by hand).
- [x] `pnpm gate` includes the Playwright run and passes.

## Comments

- 2026-09-26 [EXECUTION PLAN]: claimed by Atlas (`/atlas-implement`, Epic C); branch `chore/hardening-c-tests-and-layering`; deliverables D1 (vitest gaps) and D2 (Playwright, CI, gate, docs); plan and verification map in `../epics/C-execution.md`.

- 2026-09-27 [AI CODE REVIEW] Epic C aggregate review of `git diff 2db3b38..7e38298`. Two independent reviewers read the diff, one per axis; the orchestrator adjudicated each finding against the cited code. Fixes landed in `d772937`, `c60e155`, `6f84220`.
  - **Technical implementation and spec conformity.** Checked correct: `resolveClock(at, now)` and its callers; every changed mutation signature and caller; `DEFAULT_SETTINGS` in lib; `useMediaQuery` server snapshots; `teamSwatches`; hex and points regexes; uuid helpers; one result type; pgEnum value order, messages and defaults; `finaleDurationMs`; the dead code gone; the smoke split's shared state (same 177 `ok` lines as Epic B); `upsertDeletingAbsent` end state per table; each action's revalidation reach (`/history` reads only War Week rows, so per-edition is enough for setup writes and Awards).
    - BLOCKING, fixed: ticket 13's "manual Points Entry racing a finalize" only flipped a column by hand. Now `finalizeBracket` really races `createPointsEntry` on two connections, in both orders: the hand entry survives and the generated entries match the Placement Points. The two writes touch different rows, so removing either Competition lock doesn't fail it; dropping `deleteGenerated`'s generated-only filter does.
    - BLOCKING, fixed: lib's pgEnum-derived zod enums pulled Drizzle `pg-core` and the table definitions into the `/admin` client chunk (orchestrator confirmed in `.next/static`). Enum tuples now live in `src/lib/enums.ts`; `src/db/schema.ts` builds its pgEnums from them (`db:generate`: no changes); lib may only type-import `@/db/schema`, enforced by lint and ADR 0001. `grep -rl 'drizzle:' .next/static` finds nothing.
    - Fixed: the lint rule now also refuses `@/db`, `@/db/local-url`, `@/db/test-transaction`, `pg`, `@neondatabase/*`, `drizzle-orm`, `@/mcp`, bare `@/app` and `@/auth`, and relative climbs out of lib; exact Team match in `e2e/standings.ts`; CI uploads Playwright results on failure; `revalidateSite()` called directly; the Heat overlay no longer shifts on press.
    - Deviation: two of the seven vitest cases (team target on an individual Competition; a same-winner re-record) tighten existing tests rather than add new ones. They test the named rules.
    - Deviation (follow-up): `e2e/bracket.spec.ts` and `finale.spec.ts` rely on the seed reset per run (Beyblades' Placement Points; the leader's row); port 3200 has no busy check; `upsertDeletingAbsent`'s column parameters aren't tied to the table type.
  - **Coding standards.** Banned-term scan clean. Action order and `(input, ctx, dbOrTx)` signatures conform. UI uses the shadcn `Button`.
    - Fixed: stale comments naming `scripts/smoke.ts` and a deleted evidence script; two stale ADR 0001 lines (UI coverage; step 4 names `revalidateWarWeek`/`revalidateSite`); dead seed re-exports and `*Seed` types; `Parsed` defined once in `src/lib/result.ts`; the smoke harness uses `WriteResult` and one host email; `finaleRows` loses the multi-list `durationMs`; the hook moves to `src/hooks/`; `OptionSelect`'s `placeholder` removed (no call site passes it; D5's report that six did was wrong); the maintainer's guide names the one-time Chromium install; `uuidSchema` un-exported; a JSDoc rewrap.
    - Deviation (follow-up): `src/lib/install-prompt.ts` is a stateful browser module in lib; the DB tests still copy the local-database guard; e2e and smoke each sign stub sessions. None is in ticket 11's list.
  - Remaining risk: `src/db/schema.ts` now imports `@/lib/enums` through the `@/` alias; drizzle-kit, tsx, the build and smoke resolve it.

- 2026-09-27 [CLOSEOUT] Epic C delivered on `chore/hardening-c-tests-and-layering` (base `staging` `2db3b38`). The verified code head is `6f84220`; later commits add only records and evidence.
  - **Deliverables** (orchestrator Opus):
    - D1, vitest gaps (Sonnet): `d07d8a5`.
    - D2, Playwright, CI, gate and docs (Opus): `d3f663c`.
    - D3, layering, lint rule and `withTransaction` (Opus): `c8f85e4`.
    - D5, dead code, evidence scripts, smoke split and Heat button (Sonnet): `c97e465`, `03ebca8`, `52498ac`, `a1c86d7`.
    - D4, duplication, the one revalidation rule, seed helper and enums (Opus): `b9a81a3`, `7e38298`.
    - Orchestrator fix (vitest and eslint ignore `.claude/**`): `5107556`.
    - Review fixes, R1 (Opus): `d772937`, `c60e155`, `6f84220`.
  - **Verified run command:** `pnpm gate` with the local Postgres from `docker compose` (`DATABASE_URL` as in `.env.example`, `DATABASE_DRIVER=pg`). Result: typecheck clean; lint 0 errors; vitest 80 files / 1371 tests; build ok; smoke 177 ok / 0 FAIL (the same sequence as Epic B); Playwright 17 passed; exit 0.
  - **Verdicts:**
    - 13-AC1 PASS: the five flows pass locally (`test-results/hardening-c-gate/`, screenshots in `test-results/e2e/`) and in CI (`test-results/hardening-c-ci/runs.md`).
    - 13-AC2 PASS: the new cases pass; unscoping the Standings join fails the new query test, 1003 vs 3 (`test-results/hardening-c-focus/mutation-probe.txt`). Two of the seven cases tighten existing tests.
    - 13-AC3 PASS: `gate` ends in `pnpm e2e` and passes.
    - 11-AC1 PASS: vitest, the Playwright flows and smoke pass, and smoke's checks are unchanged.
    - 11-AC2 PASS: `@typescript-eslint/no-restricted-imports` refuses seed, queries, mutations, actions, components (and value imports of `@/db/schema`) in `src/lib` (`test-results/hardening-c-focus/lint-probe.txt`).
    - 11-AC3 PASS: `pnpm gate`.
    - Scope PASS: `test-results/hardening-c-docs/grep.txt`.
    - Epic AC1 PASS: this record, and `done`.
    - Epic AC2 PASS: CI ran smoke and Playwright on the PR and passed.
    - Epic AC3 PASS: `pnpm gate` locally.
  - **Deviations** are recorded in `[AI CODE REVIEW]`. Also: `cn@0.4.0` stays, because it already merges Tailwind classes; folding `/admin` page visibility into `can` was not in ticket 11's list and stays open.
  - **Isolation re-check:**
    - Wave 1: D1 touched only `src/**/*.test.ts` and D2 nothing under `src/`, as predicted (disjoint).
    - Wave 2: D3 and D5 shared no file, so the cherry-picks applied cleanly. Moving `--ww-primary` to D4 and `withTransaction` to D3 kept them apart.
    - D4 edited `src/actions/*`, `src/mutations/setup*.ts` and `src/lib/setup*.ts`, all of which D3 also changed, so serializing it was right.
    - Running parallel worktrees under `.claude/` made the main checkout's vitest collect their tests. `5107556` fixes that.
  - **PR:** https://github.com/paul-macfarlane/jg-war-week/pull/80
  - **Follow-ups:**
    - Move `src/lib/install-prompt.ts` out of lib.
    - Share one local-database guard across the DB tests.
    - Share the stub-session helper between e2e and smoke.
    - Resolve the e2e Bracket fixture from the database.
    - Add a busy-port check for e2e.
    - Type `upsertDeletingAbsent`'s column parameters.
    - Fold `/admin` visibility into `can`.

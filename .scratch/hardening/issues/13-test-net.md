# 13: Test net: domain gaps and Playwright flows

**What to build:** Enough automated safety to refactor (11, 12) and add features (16) without regressions.

**Blocked by:** 03, 06

**Status:** ai-review

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

- [ ] The five flows pass locally and in CI.
- [ ] The new vitest cases pass and fail when the rule they cover is broken (check one of them by hand).
- [ ] `pnpm gate` includes the Playwright run and passes.

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

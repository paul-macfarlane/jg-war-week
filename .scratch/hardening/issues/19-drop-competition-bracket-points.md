# 19: Drop `competition.bracket_points` (the contract step of Epic E's points-mode removal)

**What to build:** Remove the `competition.bracket_points` column and its `bracket_points` enum once no deployment can read them. Epic E removed every read and write of `bracketPoints` from the code but left the column and enum in place, so an Instant Rollback to a pre-Epic E deployment never meets a missing column (Epic E's closeout, follow-ups).

**Blocked by:** none (Epic E is `done`); see the human precondition

**Status:** done

## Precondition (human)

Epic E's code (PR #84) is on `main` and has run in production long enough that rolling back past it is no longer an option. Paul confirms this before the ticket moves to `ready-for-agent`. Same shape as ticket 18.

## Scope

- Delete the column and the enum from the Drizzle schema and generate the migration (`pnpm db:generate`; never hand-edited).
- Remove the `BRACKET_POINTS` constant and any comment that keeps the column for rollback.
- This is a Drizzle schema change, so the plan needs a red-team review (`docs/agents/planning.md`).

## Acceptance criteria

- [ ] No code under `src/`, `scripts/`, `seeds/` or `drizzle/` (other than past migrations) names `bracket_points`, `bracketPoints` or `BRACKET_POINTS`.
- [ ] The migration applies cleanly to the seeded local database; every seed still loads twice; smoke passes locally and in CI.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-27: created from Epic E's closeout follow-up and grouped with ticket 18 into `../epics/G-squads-and-self-report.md`.
- 2026-09-27 (Paul): precondition confirmed — Epic E (PR #84) has run on `main` long enough that rolling back past it is off the table. Moved to `ready-for-agent`; delivered inside Epic G (`../epics/G-squads-and-self-report.md`).
- 2026-09-27: `ready-for-agent → in-progress` — delivered as D1 of Epic G on branch `feat/hardening-g-squads-and-self-report` (`/atlas-implement`, work package `hardening-g`).
- 2026-09-27 **[CLOSEOUT]** `in-progress → done`: delivered as D1 of Epic G, migration 0013 (`drizzle/0013_chief_the_initiative.sql`, commit `de75a5f`). Every AC PASS locally: grep gates empty, before/after dumps byte-identical, the column and type gone (`test-results/hardening-g-migrate/`), seeds twice, smoke 187 ok and `pnpm gate` exit 0 on `3a34427` (`test-results/hardening-g-gate/gate.txt`); CI on PR https://github.com/paul-macfarlane/jg-war-week/pull/89. Promotion to `main` is Paul's human gate (see the epic's closeout).

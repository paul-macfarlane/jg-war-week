# 18: Drop `war_week.organizer_emails` (the contract step of ticket 03's migration)

**What to build:** Remove the per-edition `organizer_emails` column once nothing can read it. Ticket 03 stops reading and writing the column and copies it into the global Organizer list, but leaves it in place (expand/contract). Instant Rollback doesn't undo a migration, so dropping the column in the same release would break every page of any older deployment you roll back to (`.scratch/roles-and-access/spec.md`, "Migration and deploy").

**Blocked by:** 03

**Status:** done

## Precondition (human)

Epic B's code is on `main` and has run in production long enough that rolling back past it is no longer an option. Paul confirms this before the ticket moves to `ready-for-agent`.

## Scope

- Delete the column from the Drizzle schema and generate the migration (`pnpm db:generate`; never hand-edited).
- Remove the deprecation comment ticket 03 leaves on the column.
- This is a Drizzle schema change, so the plan needs a red-team review (`docs/agents/planning.md`).

## Acceptance criteria

- [ ] No code under `src/`, `scripts/` or `drizzle/` (other than past migrations) names `organizer_emails` or `organizerEmails`.
- [ ] The migration applies cleanly to the seeded database; smoke passes in CI.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-27: grouped with ticket 19 into `../epics/G-squads-and-self-report.md`. The precondition above still gates it; if G is wanted earlier, 18 and 19 leave the epic for their own `chore/` PR.
- 2026-09-27 (Paul): precondition confirmed — Epic B has run on `main` long enough that rolling back past it is off the table. Moved to `ready-for-agent`; delivered inside Epic G (`../epics/G-squads-and-self-report.md`).
- 2026-09-27: `ready-for-agent → in-progress` — delivered as D1 of Epic G on branch `feat/hardening-g-squads-and-self-report` (`/atlas-implement`, work package `hardening-g`).
- 2026-09-27 **[CLOSEOUT]** `in-progress → done`: delivered as D1 of Epic G, migration 0013 (`drizzle/0013_chief_the_initiative.sql`, commit `de75a5f`). Every AC PASS locally: grep gates empty, before/after dumps byte-identical, the column and type gone (`test-results/hardening-g-migrate/`), seeds twice, smoke 187 ok and `pnpm gate` exit 0 on `3a34427` (`test-results/hardening-g-gate/gate.txt`); CI on PR https://github.com/paul-macfarlane/jg-war-week/pull/89. Promotion to `main` is Paul's human gate (see the epic's closeout).

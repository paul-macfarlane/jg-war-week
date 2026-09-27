# 18: Drop `war_week.organizer_emails` (the contract step of ticket 03's migration)

**What to build:** Remove the per-edition `organizer_emails` column once nothing can read it. Ticket 03 stops reading and writing the column and copies it into the global Organizer list, but leaves it in place (expand/contract). Instant Rollback doesn't undo a migration, so dropping the column in the same release would break every page of any older deployment you roll back to (`.scratch/roles-and-access/spec.md`, "Migration and deploy").

**Blocked by:** 03

**Status:** needs-triage

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

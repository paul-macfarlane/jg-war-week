# 19: Drop `competition.bracket_points` (the contract step of Epic E's points-mode removal)

**What to build:** Remove the `competition.bracket_points` column and its `bracket_points` enum once no deployment can read them. Epic E removed every read and write of `bracketPoints` from the code but left the column and enum in place, so an Instant Rollback to a pre-Epic E deployment never meets a missing column (Epic E's closeout, follow-ups).

**Blocked by:** none (Epic E is `done`); see the human precondition

**Status:** needs-triage

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

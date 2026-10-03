# 92: Remove Max Points

**What to build:** Max Points goes everywhere: the column, the field and its help text, the "Max N pts" / "No max" badges, the over-max warning, the check against 1st's Placement Points (`src/lib/setup.ts`, `src/lib/placement-points.ts`, `src/lib/points-entry.ts`, `src/components/competitions.tsx`, the War Week copy in `src/mutations/war-week-lifecycle.ts`), seeds and MCP. A Competition's top prize is its 1st-place Placement Points.

**Part of:** Epic R16's one work package (`../epics/R16-competition-model.md`): no gate, order or migration of its own. Schema changes go into `src/db/schema.ts`; the epic generates and hand-edits the one migration and converts the seeds.

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: max points useless; Participant: "No max" unhelpful; Participation max); grilling Q3. Supersedes `../../regression-2026-09/issues/06` (keep and explain); red-team 2026-10-03 (M3)

## Decisions

- Drop the column (the epic's migration); strip `maxPoints` from the seed schema (the epic cleans the seed JSON).
- CONTEXT.md: remove Max Points from the Competition page display rule.
- Delete the tests for the over-max warning and the Max Points check; rewrite any that assert a badge to assert its absence.

## Acceptance criteria

- [ ] `grep -rni "max.\?points\|No max" src e2e scripts` finds nothing (the epic's seed grep covers `seeds`) (migrations live in `drizzle/`, outside the search).

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r16`): claimed with Epic R16; `ready-for-agent` → `in-progress`. Execution record: [`R16-execution.md`](../epics/R16-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r16`): done. Max Points removed from schema, seed schema, setup, Placement Points checks, Points Entry warning, Competition badges, lifecycle copy, MCP, smoke and docs. Deleted tests: `formatMaxPoints`, `overMaxWarning`, `firstPlaceOverMax`, the 1st-over-max row and seed tests; `competitions.test.tsx` asserts no cap badge. Grep: only `src/db/migrations.test.ts`'s pre-R16 fixture (recorded deviation). Evidence and review: [`R16-execution.md`](../epics/R16-execution.md).

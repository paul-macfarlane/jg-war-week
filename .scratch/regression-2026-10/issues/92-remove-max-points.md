# 92: Remove Max Points

**What to build:** Max Points goes everywhere: the column, the field and its help text, the "Max N pts" / "No max" badges, the over-max warning, the check against 1st's Placement Points (`src/lib/setup.ts`, `src/lib/placement-points.ts`, `src/lib/points-entry.ts`, `src/components/competitions.tsx`, the War Week copy in `src/mutations/war-week-lifecycle.ts`), seeds and MCP. A Competition's top prize is its 1st-place Placement Points.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: max points useless; Participant: "No max" unhelpful; Participation max); grilling Q3. Supersedes `../../regression-2026-09/issues/06` (keep and explain); red-team 2026-10-03 (M3)

## Decisions

- Drop the column in the migration; strip `maxPoints` from the seed schema (the seed JSON is cleaned in `96`).
- CONTEXT.md: remove Max Points from the Competition page display rule.
- Delete the tests for the over-max warning and the Max Points check; rewrite any that assert a badge to assert its absence.

## Acceptance criteria

- [ ] `grep -rni "max.\?points\|No max" src e2e scripts` finds nothing (`seeds` after `96`) (migrations live in `drizzle/`, outside the search).
- [ ] `src/db/migrations.test.ts`: the migration applies to a scratch schema with Competitions that have `max_points` set and drops the column.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass (the full gate runs once, in `96`).

# 92: Remove Max Points

**What to build:** Max Points goes everywhere: the column, the field and its help text, the "Max N pts" / "No max" badges, the over-max warning, the check against 1st's Placement Points (`src/lib/setup.ts`, `src/lib/placement-points.ts`, `src/lib/points-entry.ts`, `src/components/competitions.tsx`), seeds and MCP. A Competition's top prize is its 1st-place Placement Points.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: max points useless; Participant: "No max" unhelpful; Participation max); grilling Q3. Supersedes `../../regression-2026-09/issues/06` (keep and explain).

## Decisions

- Drop the column in the migration; strip `maxPoints` from the seed schema and every seed.
- CONTEXT.md: remove Max Points from the Competition page display rule.

## Acceptance criteria

- [ ] `grep -ri "max.\?points\|No max"` in `src`, `seeds`, `e2e` finds nothing but the migration.
- [ ] Seeds load twice; `pnpm gate` passes.

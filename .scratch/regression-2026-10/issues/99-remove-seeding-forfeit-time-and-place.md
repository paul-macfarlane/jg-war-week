# 99: Remove seeding by Standings, Forfeit and Time & place

**What to build:** Three Bracket features go:

- **Seeding by Standings** (`src/lib/bracket/seeding.ts:37`, the button in `bracket-builder.tsx`): seeding is Random with Re-roll (and manual reordering if it exists).
- **Forfeit** (`heat_entrant.forfeited`, Heat status `forfeit`, the switch in the result form): a no-show just loses.
- **Time & place** on Heats (`heat.day_id`, `start_time`, `location`, the "Time & place" button and `HeatScheduleForm`): a Heat shows when its result was recorded; no override.

**Blocked by:** `97`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: by standings, forfeit, time and place); grilling Q18–Q20

## Decisions

- Drop the columns and status value in the migration. Anything that read a Heat's time (Home's "Your next Heat", Now/Next, the Schedule, the "timed Heats" confirm) is removed or falls back to the Competition's Schedule Items.
- Show "Recorded <time>" on a played Heat.

## Acceptance criteria

- [ ] No `forfeit`, `byStandings`/"By Standings", `startTime`/`location` on Heats left outside the migration.
- [ ] e2e flows that timed a Heat are updated; a played Heat shows when it was recorded.
- [ ] `pnpm gate` passes.

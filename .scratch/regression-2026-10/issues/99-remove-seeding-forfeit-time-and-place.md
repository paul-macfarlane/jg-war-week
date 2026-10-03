# 99: Remove seeding by Standings, Forfeit and Time & place; store when a Heat was recorded

**What to build:** Three Bracket features go, and a Heat stores when its result was recorded:

- **Seeding by Standings** (`standingsSeedPositions` in `src/lib/bracket/seeding.ts`, the `seeding: "standings"` option of `generateBracket`, the "By Standings" button in `bracket-builder.tsx`): seeding is Random with Re-roll. There is no manual reordering today and none is added.
- **Forfeit** (`heat_entrant.forfeited`, Heat status `forfeit`, the switch in the result form): a no-show just loses.
- **Time & place** on Heats (`heat.day_id`, `start_time`, `location`, the "Time & place" button, `HeatScheduleForm`, `src/lib/bracket/heat-schedule.ts`): removed with **no fallback**. Heats don't have times.
- **Recorded time:** new `heat.recorded_at`, shown as "Recorded <time>" on a played Heat.

**Part of:** epic R17 (`../epics/R17-brackets.md`), one work package.

**Blocked by:** `97` (order inside R17)

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: by standings, forfeit, time and place); grilling Q18–Q20; red-team pass 1 W1, W4

## Decisions

- **`recorded_at`:** set to now whenever a Heat Result is saved (by an Organizer, a Host, or a self-reporting Participant), including an edit; cleared when the Heat's result is cleared (Reset, regenerate with `force`, or a change that sends it back to not played). `updated_at` is not used for display.
- **Every reader of a Heat's time and place loses it, with no Schedule Item fallback:**
  - Home's "Your next Heat" (`src/app/[edition]/(home)/page.tsx`) still shows the Participant's next undecided Heat (round and opponents), without a time.
  - Heats leave Now/Next (`src/lib/bracket/now-next.ts`) and the Schedule (`src/queries/schedule.ts`); a Competition's own Schedule Items are unchanged.
  - The "timed Heats" confirm and the Heat-schedule access rule (`src/lib/access.ts`) go.
  - `src/mcp/bracket.ts` (`get_bracket`) and `src/mcp/schedule.ts` drop Heat time and place; `src/mcp/llms-txt.ts` stops promising them.
  - `src/components/bracket-view.tsx`, `src/queries/brackets.ts`, `src/lib/bracket/view.ts`, `src/actions/brackets.ts`, `src/mutations/brackets.ts`.
- `bracket-results.tsx` (the admin round cards) is deleted in `100`; this part removes from it only what typecheck needs.

## Acceptance criteria

- [x] `grep -rn -E 'forfeit|standingsSeedPositions|By Standings|"standings"|HeatScheduleForm|heat-schedule|heat_day_id|startTime|start_time|location' src/lib/bracket src/components/bracket* src/components/heat* src/mutations/brackets.ts src/actions/brackets.ts src/queries/brackets.ts src/mcp/bracket.ts` finds nothing; and `grep -rn -E 'heat\.(dayId|startTime|location)|heatSchedule' src e2e scripts` finds nothing.
- [x] Unit/Postgres tests: `recorded_at` is set on an Organizer save, a self-report and an edit, and cleared by Reset and by a forced regenerate.
- [x] e2e flows that timed a Heat or used Forfeit (`e2e/bracket.spec.ts`, `bracket-heats.spec.ts`, `bracket-squads.spec.ts`) are rewritten without them; "Your next Heat" shows the next Heat with no time; a played Heat shows "Recorded <time>".
- [x] `src/queries/schedule.test.ts` asserts no Heat appears in the Schedule.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r17`): claimed; `ready-for-agent` → `in-progress`. Execution record: [`R17-execution.md`](../epics/R17-execution.md).

- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r17`): D99 `9591ced` (Sonnet). Deleted: `heat-schedule-form.tsx`, `heat-schedule.ts`(+test), `now-next.ts`(+test), Forfeit and Standings seeding tests, `setHeatSchedule` tests; rewritten e2e `bracket`, `bracket-heats`, `bracket-squads`, `regression-r5`. Both greps empty. Every AC PASS; evidence and the AI Code Review in [`R17-execution.md`](../epics/R17-execution.md). `ai-review` → `done`.

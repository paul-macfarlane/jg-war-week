# D5 evidence (ticket 10), worker commit abef77d, integrated as 2e82621

- Worktree `pnpm test` (database `war_weeker_d5`, migration-copy test included): Test Files 68 passed, Tests 1222 passed.
- Race tests (`src/mutations/races.test.ts`, two connections). Each fails with its guard removed:
  - Points Entry `WHERE generated_by_bracket = false` removed: `expected [ { ok: true }, { ok: true } ] to deeply equal [ { ok: false, …(1) }, …(1) ]`.
  - `updateCompetition` lock removed: 3 of 3 runs `expected [ { ok: true }, { ok: true } ] to have a length of 1 but got 2`.
  - `createPointsEntry` lock removed: 3 of 3 runs, the same failure.
  - `deleteDay` lock removed: 3 of 3 runs, the same failure.
  - `createScheduleItem` lock removed: 3 of 3 runs, FK violation `schedule_item_day_id_day_id_fk`.
- Ledger tie-break: `buildCompetitionLedger > keeps entries entered at the same moment in a stable order, by id`. Red before the fix.
- Check constraints: `brackets > refuses a Heat slot other than 0 or 1, or a place below 1`. `slot` 2 and -1 and `place` 0 give 23514; valid rows insert.
- Migration `drizzle/0010_green_morlocks.sql` (generated): the nine indexes and two `heat_entrant` checks. Drift check: "No schema changes", porcelain empty.

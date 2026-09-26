# 10: Races, indexes and small audit bugs

**What to build:** Close the low-severity consistency gaps from the 2026-09-26 audit.

**Blocked by:** 03 (both touch the mutations)

**Status:** ready-for-agent

## Scope

- **Check-then-write races:**
  - `updatePointsEntry` / `deletePointsEntry` check `generatedByBracket` in one statement and write in another (`src/mutations/points-entries.ts:110-134`). Repeat the check in the write's `WHERE`, or lock inside a transaction.
  - `competitionRefusal` reads scoring and the entry count without a lock (`src/mutations/setup.ts:487-504`).
  - `deleteDay` counts Schedule Items without a lock or War Week scoping (`src/mutations/setup.ts:186-189`).
  - `createFaqItem` computes `max(sortOrder)+1` with no lock (`src/mutations/setup-schedule-faq.ts:165-173`).
  - The lifecycle access check runs before the transaction (`.scratch/brackets/execution.md`).
- **Ledger tie-break:** the Competition ledger sort (`src/lib/competitions.ts:124`) tie-breaks by id, as the admin ledger does (`src/lib/points-entry.ts:165-168`).
- **Indexes** (one migration): `points_entry.team_id`, `points_entry.participant_id`, `participant.team_id`, `schedule_item.competition_id`, `award.team_id`, `award_participant.participant_id`, `heat_entrant.entrant_id`, `heat.winner_to_heat_id`.
- **Bracket integrity:** check constraints on `heat_entrant.slot` and `place` (accepted in `.scratch/brackets/execution.md`).
- **Not in scope:** `created_at` and `updated_at` stay `timestamp` without time zone. They're audit columns and never shown, and the database session runs in UTC. Add a schema comment saying so.

This changes the schema, so the plan needs a red-team review, and the seed and migration update together.

## Acceptance criteria

- [ ] A mutation test per race proves the write refuses a row that changed after the check (for example, a Points Entry that became bracket-generated).
- [ ] The Competition ledger order is stable across reloads for entries with equal `enteredAt` (unit test).
- [ ] The migration applies cleanly on a copy of the seeded database; smoke passes.
- [ ] `pnpm gate` passes.

## Comments

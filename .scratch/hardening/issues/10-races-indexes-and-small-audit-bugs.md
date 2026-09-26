# 10: Races, indexes and small audit bugs

**What to build:** Close the low-severity consistency gaps from the 2026-09-26 audit.

**Blocked by:** 03 (both touch the mutations)

**Status:** ready-for-agent (red-teamed 2026-09-26 with `.scratch/roles-and-access/spec.md`; delivered inside Epic B, whose single branch supersedes this ticket's `Blocked by`)

## Scope

- **Check-then-write races.** Each fix names its lock and which writers share it; each is proved by a two-connection test (pattern in `.scratch/roles-and-access/spec.md`, "Testing Decisions"):
  - `updatePointsEntry` / `deletePointsEntry` check `generatedByBracket` in one statement and write in another (`src/mutations/points-entries.ts:110-134`). Fix: repeat `generated_by_bracket = false` in the write's `WHERE` (and the War Week scope), so a row that became bracket-generated between the check and the write is refused with the same message. Test: connection A finalizes the Bracket after B's check and before B's write (B blocks on A's row lock, or A commits first); B's write updates 0 rows and returns the refusal.
  - `competitionRefusal` reads scoring and the entry count without a lock (`src/mutations/setup.ts:487-504`). Fix: `updateCompetition` locks the Competition row (`SELECT … FOR UPDATE`) in its transaction, and every writer that adds a Points Entry or Entrant to a Competition, or finalizes its Bracket (`createPointsEntry`, `replaceEntrants`, `finalizeBracket`), takes the same Competition row lock in its transaction. Test: a scoring change and a Points Entry create started together end with either the refusal or the entry, never both.
  - `deleteDay` counts Schedule Items without a lock or War Week scoping (`src/mutations/setup.ts:186-189`). Fix: lock the Day row (`FOR UPDATE`, scoped to the War Week) before counting, and `createScheduleItem` / `updateScheduleItem` lock the target Day row the same way. Test: a delete and a Schedule Item create on the same Day end with either the refusal or the item, never a deleted Day with an orphaned item.
  - `createFaqItem` computes `max(sortOrder)+1` with no lock (`src/mutations/setup-schedule-faq.ts:165-173`). Accepted as harmless: two equal `sortOrder`s only tie the display order, and any move renumbers the list. Add a comment saying so; no lock, no test.
  - The lifecycle access check before the transaction: dropped. Under `.scratch/roles-and-access/spec.md` every action checks `can` before its mutation, and the residual staleness was accepted in `.scratch/brackets/execution.md`.
- **Ledger tie-break:** the Competition ledger sort (`src/lib/competitions.ts:124`) tie-breaks by id, as the admin ledger does (`src/lib/points-entry.ts:165-168`).
- **Indexes** (one migration set with ticket 03's): `points_entry.team_id`, `points_entry.participant_id`, `participant.team_id`, `schedule_item.competition_id`, `award.team_id`, `award_participant.participant_id`, `heat_entrant.entrant_id`, `heat.winner_to_heat_id`, and the new `competition_host.competition_id` (its unique key leads with `email`).
- **Bracket integrity:** check constraints `heat_entrant.slot in (0, 1)` (the engine is 0-based) and `heat_entrant.place is null or place >= 1` (accepted in `.scratch/brackets/execution.md`).
- **Not in scope:** `created_at` and `updated_at` stay `timestamp` without time zone. They're audit columns and never shown, and the database session runs in UTC. Add a schema comment saying so.

This changes the schema, so the plan needs a red-team review, and the seed and migration update together.

## Acceptance criteria

- [ ] A two-connection mutation test per race (Points Entry, Competition scoring, Day delete) proves the outcome named above; the FAQ race carries its accepted-as-harmless comment.
- [ ] The Competition ledger order is stable across reloads for entries with equal `enteredAt` (unit test).
- [ ] The migration set applies cleanly and smoke passes (smoke migrates an empty database, then seeds; no seed contains Heats, so the new check constraints are exercised by the Bracket mutation tests).
- [ ] `pnpm gate` passes.

## Comments

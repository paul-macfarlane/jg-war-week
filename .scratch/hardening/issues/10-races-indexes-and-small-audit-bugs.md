# 10: Races, indexes and small audit bugs

**What to build:** Close the low-severity consistency gaps from the 2026-09-26 audit.

**Blocked by:** 03 (both touch the mutations)

**Status:** done

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
- 2026-09-26 [EXECUTION PLAN]: claimed by Atlas (`/atlas-implement`, Epic B); branch `feat/03-roles-and-access`; plan and verification map in `.scratch/roles-and-access/execution.md`.

- 2026-09-26 [AI CODE REVIEW] Epic B aggregate review of `git diff 4a41296..611f9b8`. Two independent reviewers read the diff, one per axis; the orchestrator adjudicated each finding against the cited code.
  - **Technical implementation and spec conformity.** The core is clean: every War Week write runs `authorize` → `can` → parse → mutation; a posted Competition grants access only via a DB-loaded (Competition, War Week) pair; no action writes to the `admin_edition` cookie's edition; `src/` no longer reads `organizer_emails`; locks are taken inside transactions; `guarded` rethrows Next control flow.
    - BLOCKING, fixed: a Host could unpin an Organizer-pinned Announcement by leaving `pinned` out of `updateAnnouncement` (the parser defaulted it to `false`).
    - Fixed: `updatePointsEntry` moving an entry to another Competition didn't take that Competition's row lock.
    - Fixed: `scripts/about-media.ts` granted the demo user through `organizer_emails`.
    - Fixed: Host and Organizer emails had no format or length check (one shared JG email schema now).
    - Deviation: the Points Entry race test flips `generated_by_bracket` directly. Finalize never converts a hand-entered row, so the `WHERE` guard is defensive, and the test proves the guard, not a live race.
    - Deviation: the preview OAuth `redirect_uri` comes from `BETTER_AUTH_URL`. It's covered by ticket 08's human gate.
  - **Coding standards.** Banned-term scan clean. Removed helpers have no callers. Migrations: 0008 and 0010 generated, 0009 the one custom data step. DB test guards are in place. UI conventions are followed.
    - Fixed:
      - not-found messages per family;
      - refusal wording ("Organizers and Hosts only.");
      - dead code (a second sign-in check, an unused `actorEmail`, a test-only query) and a double War Week load in the lifecycle actions;
      - a duplicate Competition row-lock helper;
      - `canPin` defaulting to `false`;
      - `guarded` consistency;
      - the smoke constant;
      - stale docs: ADR 0001's step order, `docs/agents/planning.md`, three CONTEXT.md lines, the maintainers-guide command.
    - Deviations:
      - The global Organizer-list mutations take `actorEmail`, not a War Week `MutationContext`; ADR 0001 notes it.
      - The new Organizers and Hosts forms use the existing `useTransition` pattern; ticket 12 converts every form (ADR 0004).
      - `/admin` UI trimming derives visibility from the actor, while `can` enforces every write; folding page visibility into `can` is for ticket 11.
      - Ticket 04's per-family action tests mock `authorize` and the mutation to isolate the catch-all.
      - The old `scripts/*-evidence.ts` files still write `organizer_emails`; ticket 11 deletes them, before ticket 18 drops the column.
  - Remaining risk: the race tests depend on timing (a 100 ms stagger and a 300 ms hold). With the guards in place they assert only the invariant, so slow CI weakens them but shouldn't fail them.

- 2026-09-26 [CLOSEOUT] Epic B delivered on `feat/03-roles-and-access` (base `staging` `4a41296`). The final verified head is `26bc170`; the closeout commit adds only records and evidence.
  - **Deliverables (all Opus workers except D4 on Sonnet; orchestrator Opus):**
    - D1 (data layer): `23c63b0`.
    - D2 (access rule, actions, `/admin`): `1395b21`, `3467069`.
    - D3 (ticket 04): `31f7a6e`.
    - D4 (ticket 08): `51b109d`.
    - D5 (ticket 10): `2e82621`.
    - D6 (smoke checks and docs): `d4b7f33`, `611f9b8`.
    - Review fixes: `235dce2`, `26bc170`.
  - **Verified run command:** `pnpm db:migrate && pnpm gate` with the local Postgres from `docker compose` (`DATABASE_URL` as in `.env.example`, `DATABASE_DRIVER=pg`). Result: typecheck clean; lint 0 errors; vitest 78 files / 1362 tests; build ok; smoke 177 ok / 0 FAIL, exit 0 (`test-results/hardening-b-gate/gate.txt`).
  - **Evidence** (committed under `test-results/`):
    - `hardening-b-gate/gate.txt`
    - `hardening-b-focus/vitest-verbose.txt` (the named focused tests)
    - `hardening-b-docs/grep.txt`
    - `hardening-b-browser/host-admin.md` (a Host's `/admin` in a browser)
    - `hardening-b-d1…d5/`, `hardening-b-smoke/d6-report.md` (per-deliverable evidence)
  - **Isolation re-check:** wave 3 (D3, D4, D5) ran in parallel worktrees. The predicted disjoint ownership held: the cherry-picks applied with no conflicts, and D3 touched no smoke file, so serializing D6 after it was correct.
  - **PR:** see the epic's closeout for the URL.
  - **Ticket 10 verdicts** (on `26bc170`):
    - AC1 a two-connection test per race: PASS (`src/mutations/races.test.ts`, 7 cases, each red with its guard removed). A move of a Points Entry into a Competition during a scoring change was added from the review.
    - The FAQ `sortOrder` race carries its accepted-as-harmless comment.
    - AC2 ledger tie-break: PASS.
    - AC3 migration set applies and smoke passes: PASS (smoke `pnpm db:migrate` step, 177 ok).
    - AC4 `pnpm gate`: PASS.
  - **Deviations:**
    - The race editions are `zz-r-*` (the edition column is varchar 8).
    - The Points Entry race sets `generated_by_bracket` directly; finalize never converts rows, so the `WHERE` guard is defensive.
    - The scoring and Day races run in both orders so a missing lock always fails.

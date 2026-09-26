# Epic B: Access and the action layer

**What to build:** The Organizer and Host roles, the write target taken from the request, actions that never throw, and the consistency fixes in the same mutations, delivered as one work package, one branch and one PR into `staging`.

**Tickets:** `03`, `04`, `08`, `10` (files under `../issues/`)

**Branch:** `feat/03-roles-and-access`

**Blocked by:** Epic A (its PR merged into `staging`, #78). Ticket 03's spec is red-teamed. Inside this epic, the tickets' `Blocked by: 03` lines are ordering, not availability: the epic is one branch, so 04, 08 and 10 start once 03's deliverable is integrated on it.

**Status:** done

**Spec (ticket 03):** `.scratch/roles-and-access/spec.md`

## Why together

- `03` sets the action step order (authenticate → load the target → `can` → parse → mutation) that `04` completes, so they're one pass over every action.
- `08` and `03` both change `src/auth`.
- `10` changes the same mutations and adds a migration; one red-team review covers both schema changes.

If the 03 spec comes out large, move `10` to the start of Epic C and record the change here.

## Order

1. `03` (schema, `can`, every action on the new order)
2. `04` (error boundaries, parser shape checks, `loading.tsx`) and `08`, in parallel
3. `10` (races, indexes, check constraints, one migration)

## Acceptance criteria

Each ticket's own acceptance criteria (03's as expanded by its spec), plus:

- [x] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] One migration set applies cleanly to the seeded database; smoke passes in CI. (Local: PASS. CI: checked on the PR head.)
- [x] `pnpm gate` passes locally.

## Comments

- 2026-09-26: 03's spec written at `.scratch/roles-and-access/spec.md`. It came out large, but ticket 10 stays in this epic by decision (one migration set, one red-team review).
- 2026-09-26: First red-team review blocked (migration copy untested). The spec was revised: expand/contract migration, copy test, lock on last-Organizer removal, order-of-checks smoke, production prerequisite. Dropping `organizer_emails` moved to ticket 18. Branch renamed to `feat/03-roles-and-access` (`feat/NN-<slug>` rule).
- 2026-09-26: Second red-team passed (5 warnings, 10 minors, resolved in the spec and ticket 10). Epic and ticket 03 set to `ready-for-agent`.
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
  - **Tickets 03, 04, 08 and 10 are `done`;** each records its own verdicts.
  - **Open human gates:**
    - Ticket 08 AC2: sign-in on the preview alias.
    - The production prerequisite in ticket 03, before `staging` → `main`.
  - **Follow-ups:**
    - Ticket 18: drop `organizer_emails` once rolling back past Epic B is no longer an option.
    - Ticket 11: fold `/admin` page visibility into `can`, and delete the old `scripts/*-evidence.ts` files.
    - Ticket 12: convert the new Organizers and Hosts forms with the rest.

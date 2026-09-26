# Epic B: Access and the action layer

**What to build:** The Organizer and Host roles, the write target taken from the request, actions that never throw, and the consistency fixes in the same mutations, delivered as one work package, one branch and one PR into `staging`.

**Tickets:** `03`, `04`, `08`, `10` (files under `../issues/`)

**Branch:** `feat/03-roles-and-access`

**Blocked by:** Epic A (its PR merged into `staging`, #78). Ticket 03's spec is red-teamed. Inside this epic, the tickets' `Blocked by: 03` lines are ordering, not availability: the epic is one branch, so 04, 08 and 10 start once 03's deliverable is integrated on it.

**Status:** in-progress

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

- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] One migration set applies cleanly to the seeded database; smoke passes in CI.
- [ ] `pnpm gate` passes locally.

## Comments

- 2026-09-26: 03's spec written at `.scratch/roles-and-access/spec.md`. It came out large, but ticket 10 stays in this epic by decision (one migration set, one red-team review).
- 2026-09-26: First red-team review blocked (migration copy untested). The spec was revised: expand/contract migration, copy test, lock on last-Organizer removal, order-of-checks smoke, production prerequisite. Dropping `organizer_emails` moved to ticket 18. Branch renamed to `feat/03-roles-and-access` (`feat/NN-<slug>` rule).
- 2026-09-26: Second red-team passed (5 warnings, 10 minors, resolved in the spec and ticket 10). Epic and ticket 03 set to `ready-for-agent`.
- 2026-09-26 [EXECUTION PLAN]: claimed by Atlas (`/atlas-implement`, Epic B); branch `feat/03-roles-and-access`; plan and verification map in `.scratch/roles-and-access/execution.md`.

# Epic B: Access and the action layer

**What to build:** The Organizer and Host roles, the write target taken from the request, actions that never throw, and the consistency fixes in the same mutations, delivered as one work package, one branch and one PR into `staging`.

**Tickets:** `03`, `04`, `08`, `10` (files under `../issues/`)

**Branch:** `feat/hardening-b-access`

**Blocked by:** Epic A (its PR merged into `staging`); ticket 03's spec and red-team review

**Status:** needs-triage (next step: `/to-spec` from ticket 03 and ADRs 0002–0003, then `/atlas-red-team` on the spec plus ticket 10)

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

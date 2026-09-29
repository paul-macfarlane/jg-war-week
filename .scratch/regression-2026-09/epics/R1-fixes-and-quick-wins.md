# Epic R1: Fixes and quick wins

**What to build:** Every small bug and UX ticket from the regression feedback that needs no new concept, as one work package, one branch and one PR into `staging`.

**Tickets:** `01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `16` (files under `../issues/`)

**Branch:** `feat/regression-r1-quick-wins`

**Blocked by:** Paul decides 02 (repro), 04 (which showcase), 05 (does an Organizer override survive?) and 06 (remove or explain) and sets those tickets `ready-for-agent`

**Status:** needs-triage

## Order and parallelism

1. `03` before `04` (both edit /about).
2. The rest touch separate areas and can run in parallel.
3. If 06 removes `max_points`, the plan is red-teamed (schema change).

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and e2e, and passes.
- [ ] `pnpm gate` passes locally.

## Comments

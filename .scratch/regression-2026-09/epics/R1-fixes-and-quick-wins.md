# Epic R1: Fixes and quick wins

**What to build:** Every small bug and UX ticket from the regression feedback that needs no new concept, as one work package, one branch and one PR into `staging`.

**Tickets:** `01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `16` (files under `../issues/`)

**Branch:** `feat/regression-r1-quick-wins`

**Blocked by:** none — Paul decided 02 (fix defensively, no repro), 04 (Standings moving after a Points Entry), 05 (read-only, no override) and 06 (keep, add help text) on 2026-09-28; recorded in each ticket.

**Status:** done (PR https://github.com/paul-macfarlane/jg-war-week/pull/91; `/atlas-implement` work package `regression-r1`)

## Order and parallelism

1. `03` before `04` (both edit /about).
2. The rest touch separate areas and can run in parallel.
3. If 06 removes `max_points`, the plan is red-teamed (schema change).

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [x] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and e2e, and passes.
- [x] `pnpm gate` passes locally.

## Comments

- 2026-09-28: decisions on 02, 04, 05 and 06 taken by Paul; 01–10 triaged `ready-for-agent`; `needs-triage → in-progress` — `/atlas-implement`, work package `regression-r1`, branch `feat/regression-r1-quick-wins`. Execution record: `R1-execution.md`.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. PR https://github.com/paul-macfarlane/jg-war-week/pull/91. Closeout and AI Code Review in `R1-execution.md`. CI on the PR was pending at closeout.

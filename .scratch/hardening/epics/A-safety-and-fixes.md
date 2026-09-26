# Epic A: Safety net and independent fixes

**What to build:** Every phase 1 ticket that doesn't wait on the roles work, delivered as one work package, one branch and one PR into `staging`.

**Tickets:** `02`, `06`, `05`, `07`, `09`, `15` (files under `../issues/`)

**Branch:** `fix/hardening-a-safety`

**Blocked by:** none (06's dependency on 02 is inside this epic: build 02 first)

**Status:** ready-for-agent

## Order and parallelism

1. `02` first. `06` needs its local-database guard before smoke runs in CI.
2. `05`, `07`, `09` and `15` touch separate areas (Competition mutation, bracket engine, UI, MCP access and docs), so they can run in parallel with `02` → `06`.
3. `15` and `02` both edit `scripts/smoke.ts`; merge them carefully.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and the drift check, and passes.
- [ ] `pnpm gate` passes locally.

## Comments

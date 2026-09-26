# Epic C: Test net, then refactor

**What to build:** The domain and Playwright test net, then the ADR 0001 cleanup done behind it, as one work package, one branch and one PR into `staging`.

**Tickets:** `13`, then `11` (files under `../issues/`)

**Branch:** `chore/hardening-c-tests-and-layering`

**Blocked by:** Epic B (its PR merged into `staging`)

**Status:** ready-for-agent

## Order

1. `13`: Vitest gaps, the five Playwright flows, Playwright in CI and `pnpm gate`.
2. `11`: behavior-preserving cleanup. The test net from step 1 must stay green after every refactor step.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI runs smoke and Playwright on the PR, and passes.
- [ ] `pnpm gate` passes locally.

## Comments

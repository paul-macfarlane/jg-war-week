# Epic R3: The `games` Format and self-enrollment

**What to build:** Tickets 17 and 15 and ADR 0006: Competitions decided by logged Games, and Participants entering Competitions themselves.

**Tickets:** `17`, `15` (files under `../issues/`)

**Branch:** `feat/regression-r3-games`

**Blocked by:** none — R1 merged into `staging` (PR #91, `5067e46`); the plan is written and red-teamed ([`R3-execution.md`](./R3-execution.md)). Inside this epic, ticket 15's `Blocked by: 17` is ordering, not availability: the epic is one branch, so 15 starts once 17's access facets are integrated on it.

**Status:** done (PR https://github.com/paul-macfarlane/jg-war-week/pull/92; `/atlas-implement` work package `regression-r3`)

## Order and parallelism

1. `17` first: schema, Game Types, leaderboards, access, Close/Reopen, then the page and home shortcut.
2. `15` after 17's access facets exist.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [x] ADR 0006 set to accepted.
- [x] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and e2e, and passes. (pending at closeout; PR #92)
- [x] `pnpm gate` passes locally.

## Comments

- 2026-09-29: `/atlas-implement` stopped at the content gate without claiming or creating state: no technical plan or red-team record existed (schema + access change, `docs/agents/planning.md`).
- 2026-09-29: `/atlas-plan` — technical plan, verification map and red-team record in [`R3-execution.md`](./R3-execution.md). Red-team pass 1: 4 blocking findings (enum value in the one-transaction migration, Format change to/from `games`, logger edit bound, 15-2 fixture), all resolved; pass 2 PASS with packet-level notes applied. Approved by Paul; epic set `ready-for-agent` (ready to implement: plan written under `.scratch/regression-2026-09/`).
- 2026-09-29 [EXECUTION PLAN]: `/atlas-implement` (work package `regression-r3`) — `ready-for-agent → in-progress`. Branch `feat/regression-r3-games` from `staging` at `5067e46`; tickets 17 and 15 claimed beside it. Execution structure, worker slices and the verification map: [`R3-execution.md`](./R3-execution.md) `[EXECUTION PLAN]`; progress under its `[PROGRESS]`.
- 2026-09-29: `in-progress → ai-review`: every deliverable integrated on `feat/regression-r3-games`; `pnpm gate` exit 0 at `0e90972a7b0eecb1920e0046a79db37d5be79366`; aggregate AI code review started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. PR https://github.com/paul-macfarlane/jg-war-week/pull/92. Closeout and AI Code Review in `R3-execution.md`. CI on the PR was pending at closeout.

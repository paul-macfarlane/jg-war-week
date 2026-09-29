# Epic R3: The `games` Format and self-enrollment

**What to build:** Tickets 17 and 15 and ADR 0006: Competitions decided by logged Games, and Participants entering Competitions themselves.

**Tickets:** `17`, `15` (files under `../issues/`)

**Branch:** `feat/regression-r3-games`

**Blocked by:** R1 merged (09's create form); plan red-teamed (schema and access change)

**Status:** needs-triage

## Order and parallelism

1. `17` first: schema, Game Types, leaderboards, access, Close/Reopen, then the page and home shortcut.
2. `15` after 17's access facets exist.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] ADR 0006 set to accepted.
- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and e2e, and passes.
- [ ] `pnpm gate` passes locally.

## Comments

# Epic R6: Follow-ups from R5

**What to build:** The three follow-ups Epic R5's review and CI work left open: a refusal toast that clears the sticky Save on a phone (39), free-for-all Award copy without the Team Label (40), and a Squad Bracket e2e test that cleans up after itself (41).

**Tickets:** `39`, `40`, `41` (files under `../issues/`)

**Branch:** `feat/regression-r6-follow-ups`

**Blocked by:** none (R5 merged, PR #107)

**Status:** in-progress

**Red-team:** not required (no schema, auth or access change).

## Order

Independent files: 39 `admin-shell.tsx` + `sticky-form-actions.tsx`, 40 `award-form.tsx`, 41 `e2e/bracket-squads.spec.ts`. One branch, done in order 40, 41, 39 (smallest first); the e2e suite shares port 3200 and the seeded DB, so checks run one at a time.

## Acceptance criteria

Each ticket's own, plus:

- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-30 (Paul): batch the R5 follow-ups (39–41) and implement them directly.

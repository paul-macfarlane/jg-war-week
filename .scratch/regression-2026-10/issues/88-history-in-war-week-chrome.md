# 88: War Week history in the War Week chrome

**What to build:** `/history` and `/history/awards/...` show the current War Week's top nav, phone tab bar and Appearance Theme, like every other Participant page, instead of a bare page with a "Back to War Week" link. Today `src/app/history` has no layout; the chrome lives in `src/app/[edition]/layout.tsx`.

**Blocked by:** none

**Status:** in-progress

**Source:** Paul's regression feedback 2026-10-03 (Participant: history missing navbar); grilling Q11

## Decisions

- Keep the `/history` URLs. Resolve the current War Week (as `/` does) and render the same chrome; extract it from `[edition]/layout.tsx` into a shared component rather than duplicating.
- History stays linked from More (phone) and wherever it is today on desktop; no nav item is highlighted.
- The page's own "Back to War Week" link goes.

## Acceptance criteria

- [ ] e2e: `/history` and a Category page show the top nav (desktop) and tab bar (390px) in the current War Week's theme.
- [ ] Smoke still checks `/history` (200).
- [ ] `pnpm gate` passes.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r15`): claimed with Epic R15; `ready-for-agent` → `in-progress`. Execution record: [`R15-execution.md`](../epics/R15-execution.md).

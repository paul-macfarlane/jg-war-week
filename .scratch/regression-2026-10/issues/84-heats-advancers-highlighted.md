# 84: Heats advancers highlighted everywhere

**What to build:** After a Heat is recorded, every entrant who advances is highlighted, in admin as on the Participant tree. Today admin's results (`HeatRows`, `src/components/bracket-view.tsx:119`) bold only 1st, so in a Heat of 4 with 2 advancing the 2nd-place advancer looks eliminated. The tree (`src/components/bracket-tree.tsx:95`) already uses `slot.advances`.

**Blocked by:** none

**Status:** in-progress

**Source:** Paul's regression feedback 2026-10-03 (Admin: heat recording highlight); `../grilling-2026-10-03.md` facts

## Decisions

- One rule everywhere: highlight `place <= advancingPlaces` (the tree's rule, `src/lib/bracket/tree.ts`); in the final, 1st.
- `FinishingOrderForm` on reopen: placed rows look picked, advancers marked, as in the view.
- R17 (`100`) later replaces the admin round cards with the tree; fix the shared rule now so nothing regresses.

## Acceptance criteria

- [ ] Unit test: a 4-entrant Heat with 2 advancing highlights places 1 and 2 in `HeatRows`; the final highlights only 1st.
- [ ] Screenshot of the admin Bracket after recording such a Heat, `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r15`): claimed with Epic R15; `ready-for-agent` → `in-progress`. Execution record: [`R15-execution.md`](../epics/R15-execution.md).

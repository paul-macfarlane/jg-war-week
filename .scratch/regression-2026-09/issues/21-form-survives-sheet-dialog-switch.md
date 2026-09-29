# 21: Forms keep their input across the Sheet/Dialog switch

**What to build:** Keep what a person typed when a `ResponsiveSheetDialog` form crosses the phone/desktop breakpoint.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Participant:** Every form in a `ResponsiveSheetDialog` (`src/components/responsive-sheet-dialog.tsx`) clears its inputs when the viewport crosses the Sheet/Dialog breakpoint while it's open: the wrapper swaps components and remounts its children. Found in Epic R3: the Game form (`src/components/game-form.tsx`) loses Player B and the winner, so `e2e/games.spec.ts` takes its 375px screenshot before filling the form in. Also affects `heat-result-form.tsx`. A Participant rotating a tablet mid-form hits it.

## Acceptance criteria

- [ ] The wrapper keeps its children mounted (or their state) across the switch.
- [ ] Playwright: fill the Game form at 375px, resize to 1280px, the values stay. Screenshots under `test-results/e2e/<test>/`.
- [ ] The screenshot-order workaround in `e2e/games.spec.ts` is removed.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-29 (Paul): triaged `ready-for-agent`; delivered in Epic R4 (`../epics/R4-follow-ups-from-r3.md`).

# 21: Forms keep their input across the Sheet/Dialog switch

**What to build:** Keep what a person typed when a `ResponsiveSheetDialog` form crosses the phone/desktop breakpoint.

**Blocked by:** none

**Status:** done

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
- 2026-09-29: claimed by `/atlas-implement` (work package `regression-r4`), `ready-for-agent` → `in-progress`; branch `feat/regression-r4-follow-ups` from `staging` `8c57be6` (R3 merged, PR #92). Execution record: `../epics/R4-execution.md`.
- 2026-09-29 [AI CODE REVIEW]: no finding against 21 open. T7 parity: no finding. D21's attribute change is recorded as a deviation. Full tables: `../epics/R4-execution.md` [AI CODE REVIEW].
- 2026-09-29 [CLOSEOUT]: criteria 21-1..21-4 PASS; `pnpm format:check && pnpm gate` exit 0 at `ba3b657` (`test-results/r4-gate/gate.txt`). PR https://github.com/paul-macfarlane/jg-war-week/pull/93. `ai-review` → `done`. Details: `../epics/R4-execution.md` [CLOSEOUT].

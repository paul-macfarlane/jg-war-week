# 23: Result choices use shadcn toggle-group

**What to build:** Replace the hand-rolled `aria-pressed` button groups with shadcn's `toggle-group`.

**Blocked by:** none

**Status:** done

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Host, Participant:** The Game form's "Who won?" (`src/components/game-form.tsx`) and the Heat result form's choice (`src/components/heat-result-form.tsx`) are single-choice groups built from `Button` + `aria-pressed` inside `role="group"`. CLAUDE.md says not to hand-roll a control shadcn has. Accepted as a deviation in Epic R3's code review (S10) because R3 followed the existing Heat form.

## Acceptance criteria

- [ ] `pnpm dlx shadcn@latest add toggle-group`; both forms use it.
- [ ] Keyboard and screen-reader behaviour at least as good as today; e2e selectors updated.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-29 (Paul): triaged `ready-for-agent`; delivered in Epic R4 (`../epics/R4-follow-ups-from-r3.md`).
- 2026-09-29: claimed by `/atlas-implement` (work package `regression-r4`), `ready-for-agent` → `in-progress`; branch `feat/regression-r4-follow-ups` from `staging` `8c57be6` (R3 merged, PR #92). Execution record: `../epics/R4-execution.md`.
- 2026-09-29 [AI CODE REVIEW]: T1 blocking (`w-fit` shrank the Winner group) resolved with `w-full`. T6, S3, S4 resolved. T2 (phone Up/Down), T3 (Tab lands on the first item), T8 and S2 approved as deviations. Full tables: `../epics/R4-execution.md` [AI CODE REVIEW].
- 2026-09-29 [CLOSEOUT]: criteria 23-1..23-3 PASS; `pnpm format:check && pnpm gate` exit 0 at `ba3b657` (`test-results/r4-gate/gate.txt`). PR https://github.com/paul-macfarlane/jg-war-week/pull/93. `ai-review` → `done`. Details: `../epics/R4-execution.md` [CLOSEOUT].

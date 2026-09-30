# 22: A disabled Enroll button looks disabled

**What to build:** Make an unavailable Enroll / Join button read as unavailable at a glance.

**Blocked by:** none

**Status:** done

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Participant:** When enrollment is closed, the Enrollment card's Enroll button (`src/components/enroll-button.tsx`) is disabled with its reason below, but it renders as a slightly dimmer green that reads as nearly active (see `test-results/e2e/enrollment-closed-refused/375.png`, Epic R3).

## Acceptance criteria

- [x] A disabled Enroll, Withdraw, Join or Leave button is visibly disabled in light and dark Appearance Themes, and passes contrast for its text.
- [x] Screenshot evidence under `test-results/e2e/<test>/`.
- [x] `pnpm gate` passes.

## Comments
- 2026-09-29 (Paul): folded into Epic R2 (`../epics/R2-light-and-dark-themes.md`): R2 reworks colors and contrast in both modes and regenerates the /about media, so this is done there rather than twice.
- 2026-09-29 [EXECUTION PLAN]: written by `/atlas-plan` and red-teamed (schema change), one revision cycle plus a re-review; approved by Paul. Plan: `../epics/R2-execution.md`.
- 2026-09-29 (Paul): triaged `needs-triage` → `ready-for-agent` with the R2 plan approval.
- 2026-09-30: claimed by `/atlas-implement` (work package `regression-r2`), `ready-for-agent` → `in-progress`; branch `feat/regression-r2-light-dark` from `staging` `a74d4df` (R3 merged, PR #92; R4 merged, PR #93). Execution record: `../epics/R2-execution.md`.
- 2026-09-30 [AI CODE REVIEW]: two axes, 2 blocking findings (F1 privacy/terms theme, F2 Setup override flip) resolved, 0 open; 2 non-blocking deviations approved. Full tables: `../epics/R2-execution.md` [AI CODE REVIEW].
- 2026-09-30 [CLOSEOUT]: all criteria PASS except E-3 (CI) pending at closeout; `pnpm format:check && pnpm gate` exit 0 at `f7c85d5` (`test-results/r2-gate/gate.txt`). PR https://github.com/paul-macfarlane/jg-war-week/pull/94. `ai-review` → `done`. Details: `../epics/R2-execution.md` [CLOSEOUT].

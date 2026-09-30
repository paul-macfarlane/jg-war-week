# 22: A disabled Enroll button looks disabled

**What to build:** Make an unavailable Enroll / Join button read as unavailable at a glance.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Participant:** When enrollment is closed, the Enrollment card's Enroll button (`src/components/enroll-button.tsx`) is disabled with its reason below, but it renders as a slightly dimmer green that reads as nearly active (see `test-results/e2e/enrollment-closed-refused/375.png`, Epic R3).

## Acceptance criteria

- [ ] A disabled Enroll, Withdraw, Join or Leave button is visibly disabled in light and dark Appearance Themes, and passes contrast for its text.
- [ ] Screenshot evidence under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-29 (Paul): folded into Epic R2 (`../epics/R2-light-and-dark-themes.md`): R2 reworks colors and contrast in both modes and regenerates the /about media, so this is done there rather than twice.
- 2026-09-29 [EXECUTION PLAN]: written by `/atlas-plan` and red-teamed (schema change), one revision cycle plus a re-review; approved by Paul. Plan: `../epics/R2-execution.md`.
- 2026-09-29 (Paul): triaged `needs-triage` → `ready-for-agent` with the R2 plan approval.

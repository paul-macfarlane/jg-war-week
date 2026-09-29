# 22: A disabled Enroll button looks disabled

**What to build:** Make an unavailable Enroll / Join button read as unavailable at a glance.

**Blocked by:** none

**Status:** needs-triage

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Participant:** When enrollment is closed, the Enrollment card's Enroll button (`src/components/enroll-button.tsx`) is disabled with its reason below, but it renders as a slightly dimmer green that reads as nearly active (see `test-results/e2e/enrollment-closed-refused/375.png`, Epic R3).

## Acceptance criteria

- [ ] A disabled Enroll, Withdraw, Join or Leave button is visibly disabled in light and dark Appearance Themes, and passes contrast for its text.
- [ ] Screenshot evidence under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments

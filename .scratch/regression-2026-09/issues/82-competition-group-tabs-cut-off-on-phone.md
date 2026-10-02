# 82: Competitions' Group tabs run off a phone screen

**What to build:** On `/<edition>/competitions`, a War Week with Competition Groups shows one tab per Group in a single row that scrolls sideways (`overflow-x: auto`). At 390 px the XI demo's three tabs need 544 px: "Team Night Events" is cut mid-word at the right edge and "Other Competitions" is off screen, with nothing saying there's more. Let every Group be seen on a phone without a sideways swipe (wrap the tabs, or another control that shows them all).

**Blocked by:** none

**Status:** needs-triage

**Source:** regression checklist run, ticket 53 (teams pass, `pnpm seed:demo`, 2026-10-02)

## Need

- **Participant:** find any Competition from the phone they carry during War Week.

## Finding

- **Checklist line:** User Pages → "Competitions." (with the implied page basics: no visible text element past the viewport's edge).
- **Viewport:** 390×844 (at 1440 the tabs fit).
- **Roles:** linked Participant and the unlinked account.
- **Screenshots:** `test-results/r8-quick-fixes/checklist/xi-competitions-teams-390/page.png`, `.../xi-competitions-teams-unlinked-390/page.png`, `.../xi-competitions-teams-390/other-tab.png`.
- **Expected:** no text element extends past the viewport's left or right edge; every Group's tab is visible on the first screen.
- **Observed:** the clipping check flags `BUTTON: Team Night Events` and `BUTTON: Other Competitions` (tablist `scrollWidth` 544 vs `clientWidth` 358). The tabs work once scrolled to, but nothing shows the third tab exists. The free-for-all XII demo has no Groups, so its pass didn't show this.

## Acceptance criteria

- [ ] At 390×844 with the XI demo, `/xi/competitions` passes the clipping check and shows all three Group tabs without scrolling sideways.

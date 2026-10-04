# 112: Admin bottom bar clips "More" with a wide theme font

**What to build:** Keep all five admin bottom-bar tabs inside 390 px when the War Week's font is wide (XI's monospace preset).

**Blocked by:** none

**Status:** needs-triage

**Source:** Ticket 106 scale pass (2026-10-04)

## Finding

- On XI's admin pages at 390 the bar's labels (Competitions, Discretionary points, Schedule, Announcements, More) are wider than the screen in the monospace font: "More" is cut to "Mor" at the right edge. XII's sans font fits.
- Not a 100-Participant problem; seen while walking XI's roster. Screenshot: `test-results/e2e/regression-r19-scale-r19-1-a7175-…/xi-roster-390.png`.

## Repro

1. Global setup's XI demo, sign in as an Organizer, open `/admin/roster` at 390 wide.

## Open questions

- Smaller labels, shorter labels ("Points" for Discretionary points), icons only below a width, or fewer tabs?

## Acceptance criteria

- [ ] Every tab is fully visible at 390 in each font preset; screenshot.
- [ ] `pnpm gate` passes.

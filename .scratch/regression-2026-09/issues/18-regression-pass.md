# 18: Full regression pass on Competition setup and the day

**What to build:** Walk the app end to end, especially creating and running Competitions, and list what is missing or broken.

**Blocked by:** none

**Status:** needs-triage

**Source:** regression feedback item 17

## Notes

Output feeds new tickets in this folder.

## Acceptance criteria

- [ ] Findings recorded as new tickets or comments here.

## Comments
- 2026-09-30: mobile pass (375x812, staging). The participant side is fine on a phone; `/admin` isn't. Findings filed as Epic R5 (`../epics/R5-admin-on-a-phone.md`), all `ready-for-agent`:
  - `30` Admin header and section nav on a phone
  - `31` Setup rows open in a Sheet
  - `32` Admin lists fit a phone; free-for-all drops Team
  - `33` Save stays in reach on long admin forms
  - `34` Admin controls are 44px on a phone
  - `35` Selects and the color picker behave on a phone
  - `36` Seed warning only on the Setup page
  - `37` Pinned Announcement card fits its content
  - `38` Bracket fixes found while building test fixtures
  Not covered: save/delete/confirm flows end to end on a phone; Games screens. Brackets were tested on `[Test]` fixtures in War Week XI on staging: `[Test] Pool` (8, single elimination, finalized), `[Test] Settlers of Catan` (20, Heats of 4, top 2 advance, left in Round 2) and `[Test] Beyblades` (16, Heats of 4, top 1 advances, complete but not finalized). No Placement Points, so XI's Standings are unchanged; results are made up, not real War Week XI results.

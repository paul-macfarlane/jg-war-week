# 58: One Edit and Delete pattern for every admin list

**What to build:** Every admin list row (Competitions, Days, Schedule Items, Teams, Participants, FAQ, Awards, Announcements, Organizers) shows a visible **Edit** button and a **Delete** button (or a ⋯ menu holding both on a phone if space requires). Edit opens the form in `ResponsiveSheetDialog`; Delete confirms with `ConfirmDialog` and toasts the result. Schedule, FAQ and Awards lose their `/new` and `/[id]` pages (redirect to the list); Days stop being edited inline. Announcements keep a full-page editor (Edit links there).

**Blocked by:** 57

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A7; grilling Q11

## Decisions

- `SetupListRow` becomes the one row component (or is replaced by one); the whole-row invisible button goes.
- Touch targets stay ≥ 44px (ticket 34).

## Acceptance criteria

- [ ] Each list at 390×844 and 1440×900 shows Edit and Delete per row; screenshots of the roster and Schedule.
- [ ] e2e: edit and delete a Participant and a Schedule Item through the new buttons.
- [ ] No `/admin/**/new` or `/[id]` page remains except Announcements; old paths redirect.
- [ ] `pnpm gate` passes.

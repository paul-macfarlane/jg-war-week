# 58: One Edit and Delete pattern for every admin list

**What to build:** Every admin list row (Competitions, Days, Schedule Items, Teams, Participants, FAQ, Awards, Announcements, Organizers) shows a visible **Edit** button and a **Delete** button (or a ⋯ menu holding both on a phone if space requires). Edit opens the form in `ResponsiveSheetDialog`; Delete confirms with `ConfirmDialog` and toasts the result. Schedule, FAQ and Awards lose their `/new` and `/[id]` pages (redirect to the list); Days stop being edited inline. Announcements keep a full-page editor (Edit links there).

**Blocked by:** 57

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A7; grilling Q11

## Decisions

- `SetupListRow` becomes the one row component (or is replaced by one); the whole-row invisible button goes.
- Touch targets stay ≥ 44px (ticket 34).

## Acceptance criteria

- [ ] Each list at 390×844 and 1440×900 shows Edit and Delete per row; screenshots of the roster and Schedule.
- [ ] e2e: edit and delete a Participant and a Schedule Item through the new buttons.
- [ ] No `/admin/**/new` or `/[id]` page remains except Announcements; old paths redirect.
- [ ] `pnpm gate` passes.

## Comments

- 2026-10-02 [AI CODE REVIEW] (atlas-implement): Two fresh Opus reviewers read `0e19fa6..d7c4096`, one per axis. The orchestrator adjudicated each finding against the cited hunks; the full record is in `../epics/R9-execution.md` [AI CODE REVIEW]. One blocking finding: F2, settings autosave wrote the whole row and could revert a newer Winner. It was fixed in `aae6856`/`6360357` with partial saves merged over the locked row. Every non-blocking finding was fixed or approved as a deviation.
- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/114. Branch `feat/regression-r9-navigation`; worker D58 (Opus), commit `690a8dd`; orchestrator e2e fix `d7c4096`; review fixes `aae6856`.
  - AC1 PASS: `SetupListRow` is the one row component with a visible Edit (sheet/dialog; Announcements link to their page) and Delete (`ConfirmDialog` + toast), 44px on phones. `e2e/regression-r9-lists.spec.ts` checks all nine lists at both widths; screenshots `admin-roster-*`, `admin-list-schedule-*`.
  - AC2 PASS: e2e edits and deletes a Participant and a Schedule Item through the row buttons.
  - AC3 PASS with approved deviation: Schedule, FAQ and Awards `/new` and `/[id]` pages are gone and redirect (unit + smoke). Remaining dynamic pages are Announcements plus `points/[id]`, `brackets/[id]` and `competitions/[id]/bracket|games`, which aren't list editors.
  - AC4 PASS: gate at `6360357`.

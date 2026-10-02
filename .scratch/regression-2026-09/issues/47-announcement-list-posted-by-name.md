# 47: Admin Announcements show who posted by name, without a video count

**What to build:** On `/admin/announcements`, "Posted by" shows the author's display name (the same `authorName` the participant card uses: linked Participant's name, else the part of the email before the @), never the email. Remove the video count (mobile card "N videos" and the desktop "Videos" column) and `announcementVideoCount` if nothing else uses it.

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A10

## Acceptance criteria

- [x] `/admin/announcements` at 1440×900 and 390×844 shows "Posted by <name>" and no email, no video count; screenshots under `test-results/r8-quick-fixes/admin-announcements-<width>/`.
- [x] Once ticket 60 ships, the name follows the Profile name (no extra work here; it reads the shared resolver).
- [x] `pnpm gate` passes.

## Comments

- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/113.

  Worker D47 (Sonnet), commit ea748a4, plus review fix b74876b.
  - AC1 PASS: `/admin/announcements` shows the author's name and no email, and has no video count or Videos column: test-results/r8-quick-fixes/admin-announcements-1440/, test-results/r8-quick-fixes/admin-announcements-390/. The edit page also shows "Posted by <name>" (review fix): test-results/r8-quick-fixes/admin-announcement-edit-1440/.
  - AC2 PASS (static): the list uses the shared `announcementAuthorName` resolver via `getAdminAnnouncementRows` / `getAnnouncementAuthorName`.
  - AC3 PASS: `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).
  - `announcementVideoCount` and its tests are removed; nothing else used them.

# 47: Admin Announcements show who posted by name, without a video count

**What to build:** On `/admin/announcements`, "Posted by" shows the author's display name (the same `authorName` the participant card uses: linked Participant's name, else the part of the email before the @), never the email. Remove the video count (mobile card "N videos" and the desktop "Videos" column) and `announcementVideoCount` if nothing else uses it.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A10

## Acceptance criteria

- [ ] `/admin/announcements` at 1440×900 and 390×844 shows "Posted by <name>" and no email, no video count; screenshots under `test-results/r8-quick-fixes/admin-announcements-<width>/`.
- [ ] Once ticket 60 ships, the name follows the Profile name (no extra work here; it reads the shared resolver).
- [ ] `pnpm gate` passes.

# 61: Delete my account

**What to build:** On the Profile page, **Delete my account** (behind `ConfirmDialog`, typing the email to confirm) removes the person's login (better-auth `user`, `account`, `session` rows), their Profile name and uploaded picture (Blob object deleted), and their entry on the global Organizer list (refused if they're the last Organizer). Roster records, results, Awards, Announcements and history are untouched and show the roster name again. Signing in again later creates a fresh account that re-links by email.

**Blocked by:** 60

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, P4; grilling Q4

## Decisions

- Host assignments (`competition_host` by email) are left as they are; record that in Privacy.
- Privacy's data-request copy says what deletion does and doesn't remove.

## Acceptance criteria

- [ ] e2e: a stub Participant with a Profile deletes their account, is signed out, and their Participant row now shows the roster name; their Blob object is gone (checked in a unit/integration test with a fake store, and once on staging).
- [ ] The last Organizer is refused with a clear message.
- [ ] `pnpm gate` passes.

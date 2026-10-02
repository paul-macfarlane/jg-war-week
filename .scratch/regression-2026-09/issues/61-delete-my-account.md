# 61: Delete my account

**What to build:** On the Profile page, **Delete my account** (behind `ConfirmDialog`, typing the email to confirm) removes the person's login (better-auth `user`, `account`, `session` rows), their Profile name and uploaded picture (Blob object deleted), and their entry on the global Organizer list (refused if they're the last Organizer). Roster records, results, Awards, Announcements and history are untouched and show the roster name again. Signing in again later creates a fresh account that re-links by email.

**Blocked by:** 60

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P4; grilling Q4

## Decisions

- Host assignments (`competition_host` by email) are left as they are; record that in Privacy.
- Privacy's data-request copy says what deletion does and doesn't remove.

## Acceptance criteria

- [ ] e2e: a stub Participant with a Profile deletes their account, is signed out, and their Participant row now shows the roster name; their Blob object is gone (checked in a unit/integration test with a fake store, and once on staging).
- [ ] The last Organizer is refused with a clear message.
- [ ] `pnpm gate` passes.

## Comments

- 2026-10-02 [SCOPE CHANGE] (Paul, during /atlas-plan): "pictures should just be urls, we don't want or need blob storage at this time" and "Users should be able to set the url for their image as well … just no need to upload yet." The picture is a URL the person sets on their Profile, else the Google photo URL, else initials; no upload, no Vercel Blob. Uploads move to Blob later, with AI-edited portraits. See `../epics/R10-execution.md` D12. For this ticket: there is no Blob object to delete, so the Blob checks in AC1 are N/A; the picture URL goes with the `profile` row.

## [AI CODE REVIEW]

See `../epics/R10-execution.md` [AI CODE REVIEW] (one review for the epic, both axes; no open blocking findings).

## [CLOSEOUT]

2026-10-02, branch `feat/regression-r10-accounts`. AC1 PASS (`e2e/delete-account.spec.ts`, `src/mutations/account.test.ts`; the Blob part SKIPPED by the approved scope change); AC2 PASS (last Organizer refused); AC3 PASS (`gate-final.txt`). Commits `046db75`, `9214232`, `0df77f7`. Full record: `../epics/R10-execution.md` [CLOSEOUT]. PR: https://github.com/paul-macfarlane/jg-war-week/pull/115

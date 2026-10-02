# 60: A Profile: your own name and picture

**What to build:** A **Profile** page (from the account menu, ticket 55) where a signed-in person sets their **Profile name** and **picture**. Both belong to the account (keyed by email) and show app-wide wherever that email is linked: their Participant name and Avatar on every roster, Standings, Bracket, Game log, Award and Announcement "Posted by", in every War Week (past ones too), plus Host names and the account menu.

**Blocked by:** R9 (ticket 55's account menu)

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P3; grilling Q3, Q20–Q22

## Need

- **Participant:** "I'd like to edit my profile picture and name." Today the roster name is whatever the Organizer typed, and nobody has a picture.

## Decisions

- **Name:** starts empty, never copied from Google. Until set, the Organizer's roster name shows. Once set, it replaces the roster name everywhere the email is linked. Clashes with another Participant's name are allowed (email is the identifier); the roster's unique-name rule applies only to Organizer-typed names. Limit as roster names.
- **Picture:** defaults to the Google photo (`user.image`), else initials; the person can upload a replacement (JPEG/PNG/WebP, size-capped, resized/cropped square) stored in **Vercel Blob** (provision via the Vercel Marketplace / Blob store; env var name in `.env.example`) or reset to Google/initials. The picture becomes the linked Participant's **Avatar** (groundwork for portraits, ticket 19).
- **Organizers:** on the roster form, a linked Participant's name shows read-only with "Set by the person"; the Organizer's typed name stays as the fallback.
- **Storage:** Profile fields on the account by email (a `profile` table keyed by lowercase email, or columns on `user`; the plan decides), resolved at read time by one shared resolver used by every query that shows a Participant or author name. Never expose emails to the client or MCP; MCP returns the resolved name.
- Privacy and Terms updated (what's stored, the Blob upload, deletion via ticket 61).
- CONTEXT.md: **Profile**, **Profile name**, **Avatar** updated.

## Acceptance criteria

- [ ] Unit tests for the name/picture resolver (profile set, unset, no linked Participant, case-insensitive email).
- [ ] e2e: a Participant sets a Profile name and uploads a picture; Standings, the roster and a Game log show them; the Organizer's roster form shows the name read-only.
- [ ] A real upload to the Blob store in the staging deploy succeeds and renders (smoke against the deployment).
- [ ] Seeds still load twice (idempotence) with the migration; `pnpm gate` passes.

## Comments

- 2026-10-02 [SCOPE CHANGE] (Paul, during /atlas-plan): "pictures should just be urls, we don't want or need blob storage at this time" and "Users should be able to set the url for their image as well … just no need to upload yet." The picture is a URL the person sets on their Profile, else the Google photo URL, else initials; no upload, no Vercel Blob. Uploads move to Blob later, with AI-edited portraits. See `../epics/R10-execution.md` D12. For this ticket: the e2e sets a picture URL instead of uploading, the preview shows Light and Dark, and AC3 becomes a staging screenshot after a real Google sign-in.

## [AI CODE REVIEW]

See `../epics/R10-execution.md` [AI CODE REVIEW] (one review for the epic, both axes; no open blocking findings).

## [CLOSEOUT]

2026-10-02, branch `feat/regression-r10-accounts`. AC1 PASS (`src/lib/profile.test.ts`); AC2 PASS (`e2e/profile.spec.ts`, `e2e/profile-core.spec.ts`; picture set by URL per the scope change); AC3 BLOCKED on the human gate (Google photo on staging); AC4 PASS (smoke, seeds twice; gate). Commits `e1e3248`, `934e72b`, `0df77f7`. Full record: `../epics/R10-execution.md` [CLOSEOUT].

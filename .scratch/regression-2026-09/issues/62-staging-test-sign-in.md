# 62: Test sign-in on local and staging

**What to build:** A **Test sign-in** that lets a maintainer sign in as any `@jahnelgroup.com` address (including `+` aliases like `paul+host@jahnelgroup.com`) without Google, so they can test Participant, Host, Organizer and email linking on their own. Never available in production.

**Blocked by:** none

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A2, A2a, A2b; grilling Q8, Q23

## Decisions

- Three gates, all required: off unless `TEST_SIGN_IN_SECRET` is set; refused whenever `VERCEL_ENV=production` (checked server-side on every request, not just at render); the secret is typed alongside the email on a `/sign-in/test` form (constant-time compare).
- Only `@jahnelgroup.com` addresses; the existing domain rule is unchanged.
- A "Test sign-in" banner shows on every page for such a session.
- Organizer "invites" need no new flow: add `paul+org@jahnelgroup.com` at `/admin/organizers`, then Test sign-in as it.
- Document in `.env.example` and the maintainer's guide; set the secret on staging (human step: Paul sets `TEST_SIGN_IN_SECRET` in Vercel's Preview/staging env).
- Red-team (auth change).

## Acceptance criteria

- [ ] Unit tests: refused when the secret is unset, wrong, or `VERCEL_ENV=production`; refused for a non-JG email.
- [ ] e2e: Test sign-in as `e2e+linked@jahnelgroup.com` on a roster with that email; the Participant is highlighted as You; the banner shows.
- [ ] Human-gated: on staging, after Paul sets the secret, signing in as `paul+participant@jahnelgroup.com` works; on production `/sign-in/test` returns 404.
- [ ] `pnpm gate` passes.

# 62: Test sign-in on local and staging

**What to build:** A **Test sign-in** that lets a maintainer sign in as any `@jahnelgroup.com` address (including `+` aliases like `paul+host@jahnelgroup.com`) without Google, so they can test Participant, Host, Organizer and email linking on their own. Never available in production.

**Blocked by:** none

**Status:** done

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

## [AI CODE REVIEW]

See `../epics/R10-execution.md` [AI CODE REVIEW] (one review for the epic, both axes; no open blocking findings).

## [CLOSEOUT]

2026-10-02, branch `feat/regression-r10-accounts`. AC1 PASS (unit, smoke 404); AC2 PASS (`e2e/test-sign-in.spec.ts`, screenshots `test-results/r10-accounts/test-sign-in-*`); AC3 BLOCKED on the human gates (staging sign-in after Paul sets the secret; production 404 after promotion); AC4 PASS (`gate-final.txt`). Commits `e4d36b1`, `0df77f7`. Full record: `../epics/R10-execution.md` [CLOSEOUT].

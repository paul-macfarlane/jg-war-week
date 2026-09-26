# 08: Sign-in works on Vercel preview aliases

**What to build:** Signing in on a preview deployment's branch alias works instead of failing with 403 `INVALID_ORIGIN`. better-auth only trusts the configured base URL (`src/auth/server.ts` has no `trustedOrigins`). From `.scratch/war-weeker/issues/34`.

**Blocked by:** 03 (both touch `src/auth`; avoid conflicts)

**Status:** in-progress

## Scope

- Add `trustedOrigins` built from `VERCEL_URL` and `VERCEL_BRANCH_URL` when present. Never trust a wildcard.
- The Google OAuth client's redirect URIs may also need the preview host. If so, that's a human step: record it here as ready-for-human rather than guessing.
- The README names the current staging URL (`jg-war-week-staging.vercel.app`, after ticket 37's rename).

## Acceptance criteria

- [ ] A unit test on the origin list: production has only its base URL; a preview adds exactly its two Vercel hosts.
- [ ] Human check on a real preview: sign in succeeds (or the ticket records the required OAuth redirect-URI change).
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-26 [EXECUTION PLAN]: claimed by Atlas (`/atlas-implement`, Epic B); branch `feat/03-roles-and-access`; plan and verification map in `.scratch/roles-and-access/execution.md`.

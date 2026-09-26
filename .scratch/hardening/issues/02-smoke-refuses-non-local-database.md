# 02: Smoke and gate refuse a non-local database

**What to build:** `pnpm smoke` (and `pnpm gate`, which runs it) refuse to start unless `DATABASE_URL` points at a local host. Today smoke runs `seed:load --reset` against whatever `DATABASE_URL` names (`scripts/smoke.ts` around line 4068; `scripts/seed-load.ts:7` also loads `.env*`). After someone pulls Vercel env vars locally, the gate would wipe staging or production.

**Blocked by:** none

**Status:** in-progress

## Scope

- Same local-host rule the mutation tests already use (`src/mutations/points-entries.test.ts:8-11`): `localhost`, `127.0.0.1`, `[::1]`. Extract it into one shared helper and use it in both places.
- `seed:load --reset` refuses a non-local database unless an explicit flag is also passed. The Seed GitHub workflow's `confirm_reset` passes that flag, so the workflow keeps working.

## Acceptance criteria

- [ ] `DATABASE_URL=postgres://u:p@example.com/db pnpm smoke` exits non-zero before migrating, with a message naming the rule.
- [ ] `pnpm seed:load --reset` against a non-local URL without the flag exits non-zero and changes nothing.
- [ ] The Seed workflow's reset path still works (the workflow file passes the flag).
- [ ] `pnpm gate` passes locally.

## Comments

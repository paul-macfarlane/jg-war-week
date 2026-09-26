# 02: Smoke and gate refuse a non-local database

**What to build:** `pnpm smoke` (and `pnpm gate`, which runs it) refuse to start unless `DATABASE_URL` points at a local host. Today smoke runs `seed:load --reset` against whatever `DATABASE_URL` names (`scripts/smoke.ts` around line 4068; `scripts/seed-load.ts:7` also loads `.env*`). After someone pulls Vercel env vars locally, the gate would wipe staging or production.

**Blocked by:** none

**Status:** done

## Scope

- Same local-host rule the mutation tests already use (`src/mutations/points-entries.test.ts:8-11`): `localhost`, `127.0.0.1`, `[::1]`. Extract it into one shared helper and use it in both places.
- `seed:load --reset` refuses a non-local database unless an explicit flag is also passed. The Seed GitHub workflow's `confirm_reset` passes that flag, so the workflow keeps working.

## Acceptance criteria

- [x] `DATABASE_URL=postgres://u:p@example.com/db pnpm smoke` exits non-zero before migrating, with a message naming the rule.
- [x] `pnpm seed:load --reset` against a non-local URL without the flag exits non-zero and changes nothing.
- [x] The Seed workflow's reset path still works (the workflow file passes the flag).
- [x] `pnpm gate` passes locally.

## Comments

**2026-09-26, Claude (atlas-implement, epic A) — [CLOSEOUT]** Delivered by D02 (worker: sonnet, `c625d98`) plus review fix `86b1af6`. `isLocalDatabaseUrl` (`src/db/local-url.ts`) allows only `localhost`, `127.0.0.1` or `[::1]`, a driver other than `neon`, and no `host`/`hostaddr` query override (a review finding: pg lets those replace the URL's host). `pnpm smoke` refuses first thing in `main()`. `seed:load --reset` needs `--allow-remote-reset` for a non-local URL, and `seed.yml` passes it after its `confirm_reset` check. All eight DB test suites use the helper.
- AC1 PASS: `test-results/hardening-a-guards/smoke-remote-refused.txt` (exit 1 before migrating, and the host-override case)
- AC2 PASS: `test-results/hardening-a-guards/seed-reset-remote-refused.txt` (exit 1 before any import or connection)
- AC3 PASS: `test-results/hardening-a-guards/seed-workflow-flag.txt`
- AC4 PASS: `pnpm gate` on `86b1af6`, `test-results/hardening-a-gate/gate.txt`
- Note: on this machine, `.env.local` doesn't point at the local database, so run `DATABASE_URL=<.env.example value> pnpm gate`. The maintainer's guide now says so.
- PR: https://github.com/paul-macfarlane/jg-war-week/pull/78

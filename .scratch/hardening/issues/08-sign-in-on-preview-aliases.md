# 08: Sign-in works on Vercel preview aliases

**What to build:** Signing in on a preview deployment's branch alias works instead of failing with 403 `INVALID_ORIGIN`. better-auth only trusts the configured base URL (`src/auth/server.ts` has no `trustedOrigins`). From `.scratch/war-weeker/issues/34`.

**Blocked by:** 03 (both touch `src/auth`; avoid conflicts)

**Status:** done

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

- 2026-09-26 [AI CODE REVIEW] Epic B aggregate review of `git diff 4a41296..611f9b8`. Two independent reviewers read the diff, one per axis; the orchestrator adjudicated each finding against the cited code.
  - **Technical implementation and spec conformity.** The core is clean: every War Week write runs `authorize` → `can` → parse → mutation; a posted Competition grants access only via a DB-loaded (Competition, War Week) pair; no action writes to the `admin_edition` cookie's edition; `src/` no longer reads `organizer_emails`; locks are taken inside transactions; `guarded` rethrows Next control flow.
    - BLOCKING, fixed: a Host could unpin an Organizer-pinned Announcement by leaving `pinned` out of `updateAnnouncement` (the parser defaulted it to `false`).
    - Fixed: `updatePointsEntry` moving an entry to another Competition didn't take that Competition's row lock.
    - Fixed: `scripts/about-media.ts` granted the demo user through `organizer_emails`.
    - Fixed: Host and Organizer emails had no format or length check (one shared JG email schema now).
    - Deviation: the Points Entry race test flips `generated_by_bracket` directly. Finalize never converts a hand-entered row, so the `WHERE` guard is defensive, and the test proves the guard, not a live race.
    - Deviation: the preview OAuth `redirect_uri` comes from `BETTER_AUTH_URL`. It's covered by ticket 08's human gate.
  - **Coding standards.** Banned-term scan clean. Removed helpers have no callers. Migrations: 0008 and 0010 generated, 0009 the one custom data step. DB test guards are in place. UI conventions are followed.
    - Fixed:
      - not-found messages per family;
      - refusal wording ("Organizers and Hosts only.");
      - dead code (a second sign-in check, an unused `actorEmail`, a test-only query) and a double War Week load in the lifecycle actions;
      - a duplicate Competition row-lock helper;
      - `canPin` defaulting to `false`;
      - `guarded` consistency;
      - the smoke constant;
      - stale docs: ADR 0001's step order, `docs/agents/planning.md`, three CONTEXT.md lines, the maintainers-guide command.
    - Deviations:
      - The global Organizer-list mutations take `actorEmail`, not a War Week `MutationContext`; ADR 0001 notes it.
      - The new Organizers and Hosts forms use the existing `useTransition` pattern; ticket 12 converts every form (ADR 0004).
      - `/admin` UI trimming derives visibility from the actor, while `can` enforces every write; folding page visibility into `can` is for ticket 11.
      - Ticket 04's per-family action tests mock `authorize` and the mutation to isolate the catch-all.
      - The old `scripts/*-evidence.ts` files still write `organizer_emails`; ticket 11 deletes them, before ticket 18 drops the column.
  - Remaining risk: the race tests depend on timing (a 100 ms stagger and a 300 ms hold). With the guards in place they assert only the invariant, so slow CI weakens them but shouldn't fail them.

- 2026-09-26 [CLOSEOUT] Epic B delivered on `feat/03-roles-and-access` (base `staging` `4a41296`). The final verified head is `26bc170`; the closeout commit adds only records and evidence.
  - **Deliverables (all Opus workers except D4 on Sonnet; orchestrator Opus):**
    - D1 (data layer): `23c63b0`.
    - D2 (access rule, actions, `/admin`): `1395b21`, `3467069`.
    - D3 (ticket 04): `31f7a6e`.
    - D4 (ticket 08): `51b109d`.
    - D5 (ticket 10): `2e82621`.
    - D6 (smoke checks and docs): `d4b7f33`, `611f9b8`.
    - Review fixes: `235dce2`, `26bc170`.
  - **Verified run command:** `pnpm db:migrate && pnpm gate` with the local Postgres from `docker compose` (`DATABASE_URL` as in `.env.example`, `DATABASE_DRIVER=pg`). Result: typecheck clean; lint 0 errors; vitest 78 files / 1362 tests; build ok; smoke 177 ok / 0 FAIL, exit 0 (`test-results/hardening-b-gate/gate.txt`).
  - **Evidence** (committed under `test-results/`):
    - `hardening-b-gate/gate.txt`
    - `hardening-b-focus/vitest-verbose.txt` (the named focused tests)
    - `hardening-b-docs/grep.txt`
    - `hardening-b-browser/host-admin.md` (a Host's `/admin` in a browser)
    - `hardening-b-d1…d5/`, `hardening-b-smoke/d6-report.md` (per-deliverable evidence)
  - **Isolation re-check:** wave 3 (D3, D4, D5) ran in parallel worktrees. The predicted disjoint ownership held: the cherry-picks applied with no conflicts, and D3 touched no smoke file, so serializing D6 after it was correct.
  - **PR:** see the epic's closeout for the URL.
  - **Ticket 08 verdicts:**
    - AC1 origin list: PASS (`src/auth/trusted-origins.test.ts`, 5 tests).
    - AC3 `pnpm gate`: PASS (on `26bc170`).
    - AC2 human sign-in on a real preview: OPEN, needs Paul (ready-for-human step).
      - Finding: better-auth builds Google's `redirect_uri` from `BETTER_AUTH_URL` (`better-auth/dist/api/routes/sign-in.mjs:228`), not from `trustedOrigins`.
      - For sign-in on a branch alias: set that preview's `BETTER_AUTH_URL` to the alias, and add `https://<alias>/api/auth/callback/google` to the Google OAuth client's authorized redirect URIs.
      - Then sign in on this PR's preview alias and record the result here.

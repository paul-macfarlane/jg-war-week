# 04: Error boundaries; actions never throw

**What to build:** An unexpected database error or bad input shows a friendly error instead of crashing the page.

**Blocked by:** 03 (it sets the action step order)

**Status:** done

## Scope

- Add `src/app/global-error.tsx` and `error.tsx` for the edition pages and `/admin`, inside the themed root, using existing shadcn pieces. Include a "Try again" (reset) link and a home link.
- Every server action wraps unexpected failures (database errors, unique violations such as in `createPointsEntry` or Awards) into its `ActionResult` error. Only redirects and `notFound` propagate.
- Parsers validate the shape before touching fields: `parseWarWeekSettingsInput` (`src/lib/setup.ts:305-307`), `parseCompetitionInput` (`src/lib/setup.ts:358-363`), `createPointsEntry` (`src/actions/points-entries.ts:44`). A malformed call returns an error instead of throwing a TypeError.
- Add `loading.tsx` where it's missing for `competitions/[id]`, `finale` and `more`. Don't add an admin `loading.tsx`: it turns `notFound()` into a 200 (see `.scratch/custom-inputs/execution.md`). Record that constraint in a comment.

## Acceptance criteria

- [ ] A unit test per action family proves a thrown mutation error comes back as `{ ok: false, error }`.
- [ ] Calling each parser with `{}` or wrong types returns an error and doesn't throw.
- [ ] Smoke or Playwright forces an error on a page and sees the error boundary, not Next's default screen.
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
  - **Ticket 04 verdicts** (on `26bc170`):
    - AC1 a thrown mutation error comes back as a result, per family: PASS (8 `src/actions/*.test.ts`).
    - AC2 parsers don't throw on `{}` or wrong types: PASS (`src/lib/*.test.ts`; 11 `parseCompetitionInput` cases were red before).
    - AC3 a forced error shows the error boundary: PASS over HTTP (smoke "GET /xi/faq with its table missing streams the edition error boundary").
      - The page streams, so the response is 200. Smoke asserts the errored-boundary marker, the digest row, the edition nav, no default Next text, and the ErrorScreen copy in the boundary's script.
      - The rendered copy wasn't observed in a browser: the local table rename was blocked by a permission check outside smoke.
    - AC4 `pnpm gate`: PASS.
  - **Deviations:** "Try again" calls `retry` (Next 16.3); a new `competitions/[id]` layout checks existence above `loading.tsx` so a bad id stays a 404 (smoke checks both cases).

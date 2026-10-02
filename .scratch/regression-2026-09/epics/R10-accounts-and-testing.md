# Epic R10: Accounts and testing

**What to build:** A Profile (name and picture, used app-wide), Delete my account, and a Test sign-in for local and staging. (View as, ticket 63, was dropped on 2026-10-02; see Comments.)

**Tickets:** `60`, `61`, `62` (files under `../issues/`)

**Branch:** `feat/regression-r10-accounts`

**Blocked by:** R9 merged into `staging` (the account menu).

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Red-team:** **required** (Drizzle schema change for Profiles; auth change for Test sign-in). Plan with `/atlas-plan`, red-team, then implement.

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

62 first (it makes the rest testable by hand), then 60 → 61.

## Human prerequisites

- A Vercel Blob store provisioned for the project (staging and production) and its env var set.
- `TEST_SIGN_IN_SECRET` set on the staging environment only.

## Acceptance criteria

Each ticket's own, plus:

- [x] ADR for Profiles (name resolution by email across War Weeks) and for Test sign-in.
- [x] Privacy and Terms, `/about`, `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated (the checklist's Accounts setup switches to Test sign-in; add Profile and Delete my account lines).
- [x] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-02 (/atlas-plan): technical plan written to `R10-execution.md`. Red-team round 1 failed (2 blocking, 11 should-fix), round 2 passed after revision. Paul answered: PR previews use no Vercel environment, so `TEST_SIGN_IN_SECRET` goes on the staging environment only. Scope change (Paul): Profile pictures are URLs (set by the person, else the Google photo, else initials), previewed in Light and Dark; no upload and no Blob, so the Blob human prerequisite is dropped. Next: `/atlas-implement`.
- 2026-10-02 [SCOPE CHANGE] (Paul): ticket 63 (View as) dropped from R10 and returned to `needs-triage`. Test sign-in (62) covers testing as a non-admin, a Host or a linked Participant with real behavior; View as was the riskiest access change for marginal benefit. Revisit if Organizers need to debug a real person's view in production. The Blob human prerequisite is also gone (pictures are URLs).
- 2026-10-02 (atlas-implement): delivered on `feat/regression-r10-accounts`; closeout in `R10-execution.md`. Human gates still open: staging Test sign-in, Google photo on staging, production 404 after promotion. PR: https://github.com/paul-macfarlane/jg-war-week/pull/115

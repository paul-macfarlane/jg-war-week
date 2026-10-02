# Epic R10: Accounts and testing

**What to build:** A Profile (name and picture, used app-wide), Delete my account, a Test sign-in for local and staging, and View as for Organizers.

**Tickets:** `60`, `61`, `62`, `63` (files under `../issues/`)

**Branch:** `feat/regression-r10-accounts`

**Blocked by:** R9 merged into `staging` (the account menu).

**Status:** ready-for-agent

**Red-team:** **required** (Drizzle schema change for Profiles; auth change for Test sign-in; access change for View as). Plan with `/atlas-plan`, red-team, then implement.

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

62 first (it makes the rest testable by hand), then 60 → 61; 63 is independent.

## Human prerequisites

- A Vercel Blob store provisioned for the project (staging and production) and its env var set.
- `TEST_SIGN_IN_SECRET` set on the staging environment only.

## Acceptance criteria

Each ticket's own, plus:

- [ ] ADR for Profiles (name resolution by email across War Weeks) and for Test sign-in / View as.
- [ ] Privacy and Terms, `/about` and `docs/maintainers-guide.md` updated.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.

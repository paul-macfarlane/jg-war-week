# Epic R11: Content

**What to build:** The Announcement editor reaches journeys parity with image upload, videos live only in the post body, Days get a short description, the roster imports from a spreadsheet, and a live War Week can be Unstarted.

**Tickets:** `64`, `65`, `66`, `67`, `68` (files under `../issues/`)

**Branch:** `feat/regression-r11-content`

**Blocked by:** R10 merged into `staging` (Blob storage for image upload).

**Status:** ready-for-agent

**Red-team:** **required** (Drizzle schema changes: drop `videoUrls`, add Day description). Plan with `/atlas-plan`, red-team, then implement.

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

64 → 65. 66, 67, 68 independent.

## Acceptance criteria

Each ticket's own, plus:

- [ ] Demo seeds and migrations change together; smoke passes on seeded local Postgres.
- [ ] `/about`, `docs/maintainers-guide.md` and the regression checklist updated.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.

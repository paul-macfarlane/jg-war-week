# Epic R9: Navigation

**What to build:** Competitions in the main nav, one avatar account menu, a Home page that shows recent results, a flat admin nav without Overview or a Setup hub, one Edit/Delete pattern across admin lists, and Settings that save themselves.

**Tickets:** `54`, `55`, `56`, `57`, `58`, `59` (files under `../issues/`)

**Branch:** `feat/regression-r9-navigation`

**Blocked by:** R8 merged into `staging` (shared nav files).

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Red-team:** not required (no Drizzle schema, auth or access change; Host trimming is preserved, not changed).

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

Participant side: 54 → 55, and 56 alone. Admin side: 57 → 58 and 57 → 59.

## Acceptance criteria

Each ticket's own, plus:

- [ ] `docs/regression-checklist.md` User Pages and Admin sections updated for the new nav.
- [ ] `/about` (nav-order cards and stills via `scripts/about-media.ts`) and `docs/maintainers-guide.md` updated.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.

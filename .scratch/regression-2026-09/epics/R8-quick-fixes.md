# Epic R8: Quick fixes from the October regression

**What to build:** Small, independent fixes from Paul's 2026-10-01 regression feedback: one word for Announcements, names instead of emails, free-for-all without Team settings, better date pickers, sheets only on phones, no more "Which one is you?", and a regression checklist that covers User Pages and Admin.

**Tickets:** `46`, `47`, `48`, `49`, `50`, `51`, `52`, `53` (files under `../issues/`)

**Branch:** `feat/regression-r8-quick-fixes`

**Blocked by:** none

**Status:** in-progress

**Red-team:** not required (no Drizzle schema, auth or access change).

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

All independent. Run 53 last so its first checklist run sees the other fixes. Can run in parallel with R9, but R9 touches the same nav files as 46: merge R8 first.

## Acceptance criteria

Each ticket's own, plus:

- [ ] `/about`, `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where a change is user-visible (team rules).
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.

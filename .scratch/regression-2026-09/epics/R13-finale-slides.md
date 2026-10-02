# Epic R13: Finale slides ("Wrapped")

**What to build:** The Finale becomes a configurable slideshow for the closing ceremony: Title, By the numbers, Awards, Champions, the Standings countdown and the Winner, plus custom slides, in an order the Organizer sets.

**Tickets:** `72`, `73`, `74` (files under `../issues/`)

**Branch:** `feat/regression-r13-finale-slides`

**Blocked by:** R12 merged into `staging` (Award Categories; R11's editor).

**Status:** ready-for-agent

**Red-team:** required (Drizzle schema change for slides). Finale rule: never reorder or recompute Standings.

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

72 → 73 and 72 → 74.

## Acceptance criteria

Each ticket's own, plus:

- [ ] `/about`'s Finale block and stills (`scripts/about-media.ts`), `docs/maintainers-guide.md` and the regression checklist updated.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.

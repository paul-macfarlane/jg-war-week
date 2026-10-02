# Epic R13: Finale slides ("Wrapped")

**What to build:** The Finale becomes a configurable slideshow for the closing ceremony: Title, By the numbers, Awards, Champions, the Standings countdown and the Winner, plus custom slides, in an order the Organizer sets.

**Tickets:** `72`, `73`, `74` (files under `../issues/`)

**Branch:** `feat/regression-r13-finale-slides`

**Blocked by:** R12 merged into `staging` (Award Categories; R11's editor).

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Red-team:** required (Drizzle schema change for slides). Finale rule: never reorder or recompute Standings.

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

72 → 73 and 72 → 74.

## Acceptance criteria

Each ticket's own, plus:

- [x] `/about`'s Finale block and stills (`scripts/about-media.ts`), `docs/maintainers-guide.md` and the regression checklist updated.
- [x] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes (pending: runs on the PR); `pnpm format:check && pnpm gate` passes (local, at `6096595`).

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.

## [CLOSEOUT]

2026-10-03, atlas-implement (Claude Opus 5.5). Tickets 72, 73, 74 `done`; see each ticket's closeout and [`R13-execution.md`](./R13-execution.md). Migration 0027 with both demo seeds in the same branch; smoke green on seeded local Postgres; `/about` copy and poster (`scripts/about-media.ts` rerun on the XII demo → `test-results/r13/about-media.txt`), maintainer's guide ("Run the Finale", "Rolling out R13"), regression checklist, testing.md, llms.txt and organizer guide updated. The staging CI fix (Award Categories e2e locator) rides along as a recorded scope change. `pnpm format:check && pnpm gate` passed at `6096595`. PR: [paul-macfarlane/jg-war-week#121](https://github.com/paul-macfarlane/jg-war-week/pull/121); CI runs there.

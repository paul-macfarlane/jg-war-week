# Epic R17: Brackets

**What to build:** One Bracket Format (97); a 3rd place game with places from the final up to 4th (98); seeding by Standings, Forfeit and Time & place removed (99); one tree for admin and Participants (100).

**Tickets:** `97`, `98`, `99`, `100` (files under `../issues/`)

**Branch:** `feat/regression-r17-brackets`

**Blocked by:** R16 merged into `staging` (one schema-changing epic at a time).

**Status:** ready-for-agent

**Red-team:** **required** (Drizzle schema change).

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## Order

97 → 98, 99 → 100.

## Acceptance criteria

Each ticket's own, plus:

- [ ] `/about` (copy and media via `scripts/about-media.ts`), `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where user-visible (team rules).
- [ ] `CONTEXT.md` updated per the grilling record's glossary list for what ships here.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.

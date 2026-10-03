# Epic R18: The admin Competition page

**What to build:** One autosaving admin page per Competition with locks and Reset bracket (101); Hosts picked from the roster (102); rich-text description (103); Log a Game from admin (104).

**Tickets:** `101`, `102`, `103`, `104` (files under `../issues/`)

**Branch:** `feat/regression-r18-admin-competition-page`

**Blocked by:** R17 merged into `staging`.

**Status:** ready-for-agent

**Red-team:** **required** (Drizzle schema change for the description; Host access on the new page).

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## Order

101 first; then 102, 103, 104 in any order.

## Acceptance criteria

Each ticket's own, plus:

- [ ] `/about` (copy and media via `scripts/about-media.ts`), `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where user-visible (team rules).
- [ ] `CONTEXT.md` updated per the grilling record's glossary list for what ships here.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.

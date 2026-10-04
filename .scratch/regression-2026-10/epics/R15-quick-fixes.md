# Epic R15: Quick fixes

**What to build:** Six small fixes from the October regression pass: Heats advancers highlighted (84), pointer cursor (85), centred top nav (86), solid primary buttons (87), History in the War Week chrome (88), Games settings show what was saved (89).

**Tickets:** `84`, `85`, `86`, `87`, `88`, `89` (files under `../issues/`)

**Branch:** `fix/regression-r15-quick-fixes`

**Blocked by:** none

**Status:** done

**Red-team:** not required (no Drizzle schema, auth or access change).

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## Order

All independent; one PR.

## Acceptance criteria

Each ticket's own, plus:

- [x] `/about` (copy and media via `scripts/about-media.ts`), `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where user-visible (team rules).
- [x] `CONTEXT.md` updated per the grilling record's glossary list for what ships here.
- [x] Each ticket file records its closeout and is `done` in this branch.
- [x] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r15`): claimed with tickets 84–89; `ready-for-agent` → `in-progress`. Execution record: [`R15-execution.md`](./R15-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement): all six tickets are done; `pnpm format:check && pnpm gate` passes. See [`R15-execution.md`](./R15-execution.md).
- 2026-10-03: PR https://github.com/paul-macfarlane/jg-war-week/pull/124 into `staging`.

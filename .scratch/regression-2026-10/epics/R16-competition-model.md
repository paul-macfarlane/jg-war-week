# Epic R16: The Competition model

**What to build:** Points come from results. `points` becomes Placement (90); Discretionary points replace the Points page (91); Max Points goes (92); Head-to-head and Best score become Formats and ranked Games and Finish Points go (93); Participation follows scoring (94); Placement Points without a limit (95); the migration and seeds (96).

**Tickets:** `90`, `91`, `92`, `93`, `94`, `95`, `96` (files under `../issues/`)

**Branch:** `feat/regression-r16-competition-model`

**Blocked by:** none (independent of R15)

**Status:** ready-for-agent

**Red-team:** **required** (Drizzle schema change; Hosts record Placements; Discretionary points are Organizer-only).

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## Order

92, 95 and 94 first (small, independent); 90 → 93; 91; 96 last (needs all). ADR for the Placement write and Discretionary points.

## Acceptance criteria

Each ticket's own, plus:

- [ ] `/about` (copy and media via `scripts/about-media.ts`), `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where user-visible (team rules).
- [ ] `CONTEXT.md` updated per the grilling record's glossary list for what ships here.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.

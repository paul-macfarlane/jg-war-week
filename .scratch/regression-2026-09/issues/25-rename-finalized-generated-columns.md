# 25: Rename finalized_at and generated_by_bracket (backlog)

**What to build:** Give the two columns names that fit both Brackets and `games` Competitions.

**Blocked by:** none

**Status:** done

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Maintainer:** `competition.finalized_at` now also means a closed `games` Competition, and `points_entry.generated_by_bracket` also marks Points Entries from closing one (Epic R3, plan decision 1). The schema comments say so, but the names under-describe them. Deferred because `drizzle-kit generate` asks interactively whether a column was renamed.

## Acceptance criteria

- [ ] Columns renamed (e.g. `closed_at`, `generated`) with a hand-checked migration that renames, never drops and re-adds; no data lost (prove with a before/after row count on the seeded DB).
- [ ] Code, seeds and CONTEXT.md updated.
- [ ] Schema change and demo seed updated together; plan red-teamed (`docs/agents/planning.md`).
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-29 (Paul): backlog. Internal naming only, no user-facing effect; a schema change that needs a red-team. Do it alongside a future schema change that is red-teamed anyway.

- 2026-10-04: folded into Epic R21 (`../../competition-setup/spec.md`); closes when that epic ships.
- 2026-10-04: done. Folded into R21, .scratch/competition-setup/ (migration `0031` renamed `finalized_at` to `closed_at` and `generated_by_bracket` to `generated`, row-preserving; code, seeds and CONTEXT.md updated).

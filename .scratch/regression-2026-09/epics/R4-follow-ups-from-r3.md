# Epic R4: Follow-ups from R3

**What to build:** Tickets 21, 23 and 24, the follow-ups Epic R3 found: forms keep their input across the Sheet/Dialog switch, the result choices use shadcn `toggle-group`, and End War Week warns about open Games Competitions.

**Tickets:** `21`, `23`, `24` (files under `../issues/`)

**Branch:** `feat/regression-r4-follow-ups`

**Blocked by:** R3 merged (PR https://github.com/paul-macfarlane/jg-war-week/pull/92): 21 and 23 change the Game form and 24 the Games Competitions R3 adds. Branch from `staging` after it merges.

**Status:** done

**Red-team:** not required (no schema, auth or access change; `docs/agents/planning.md`).

## Order and parallelism

1. `21` (`src/components/responsive-sheet-dialog.tsx`) and `23` (`src/components/game-form.tsx`, `src/components/heat-result-form.tsx`) both touch the forms inside the dialog. Run them one after the other, 21 first, or run them in parallel only if 23 leaves the wrapper alone.
2. `24` (the End War Week dialog and its query) is independent, so it can run in parallel with either.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] `/about` and `docs/maintainers-guide.md` updated where the change is user-visible (the team's showcase rule; at least 24's warning in the guide).
- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and e2e, and passes.
- [ ] `pnpm gate` passes locally.

## Comments

- 2026-09-29: created from Epic R3's follow-ups (`R3-execution.md` [CLOSEOUT]). 22 and 26 went to R2; 25 is backlog.
- 2026-09-29: claimed by `/atlas-implement` (work package `regression-r4`), `ready-for-agent` → `in-progress`; branch `feat/regression-r4-follow-ups` from `staging` `8c57be6` (R3 merged, PR #92). Execution record: `../epics/R4-execution.md`.
- 2026-09-29 [AI CODE REVIEW]: Both axes: 1 blocking finding (T1) resolved, 0 open. Full tables: `../epics/R4-execution.md` [AI CODE REVIEW].
- 2026-09-29 [CLOSEOUT]: E-1, E-2, E-4 PASS; E-3 (CI) pending at closeout; `pnpm format:check && pnpm gate` exit 0 at `ba3b657` (`test-results/r4-gate/gate.txt`). PR https://github.com/paul-macfarlane/jg-war-week/pull/93. `ai-review` → `done`. Details: `../epics/R4-execution.md` [CLOSEOUT].

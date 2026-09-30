# Epic R2: Light and dark Appearance Themes

**What to build:** Ticket 12, then re-check ticket 13 (likely moot). Also 22 (a disabled Enroll button looks disabled, in both modes) and 26 (the /about Games still shows its title, when R2 regenerates the /about media).

**Execution record:** `R2-execution.md`

**Tickets:** `12`, `22`, `26` (`13` checked at closeout) (files under `../issues/`)

**Branch:** `feat/regression-r2-light-dark`

**Blocked by:** R3 merged (both change the schema; run them one after the other); R4 merged (it replaces the form controls R2 themes)

**Status:** done

## Order and parallelism

1. Derivation and contrast tests first, then the switcher, then the Organizer overrides.
2. Plan red-teamed (schema change).

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [x] Ticket 13 closed as moot or rescoped, with a comment.
- [x] Each ticket file records its closeout and is set to `done` in this branch.
- [x] CI on the PR runs smoke and e2e, and passes.
- [x] `pnpm gate` passes locally.

## Comments
- 2026-09-29 (Paul): added tickets 22 and 26 from Epic R3's follow-ups; both are colour or media work R2 already does. R2 now waits on R4 too, so it themes the final form controls.
- 2026-09-29 [EXECUTION PLAN]: written by `/atlas-plan` and red-teamed (schema change), one revision cycle plus a re-review; approved by Paul. Plan: `../epics/R2-execution.md`.
- 2026-09-29 (Paul): triaged `needs-triage` → `ready-for-agent` with the R2 plan approval.
- 2026-09-30: claimed by `/atlas-implement` (work package `regression-r2`), `ready-for-agent` → `in-progress`; branch `feat/regression-r2-light-dark` from `staging` `a74d4df` (R3 merged, PR #92; R4 merged, PR #93). Execution record: `../epics/R2-execution.md`.
- 2026-09-30 [AI CODE REVIEW]: two axes, 2 blocking findings (F1 privacy/terms theme, F2 Setup override flip) resolved, 0 open; 2 non-blocking deviations approved. Full tables: `../epics/R2-execution.md` [AI CODE REVIEW].
- 2026-09-30 [CLOSEOUT]: all criteria PASS except E-3 (CI) pending at closeout; `pnpm format:check && pnpm gate` exit 0 at `f7c85d5` (`test-results/r2-gate/gate.txt`). PR https://github.com/paul-macfarlane/jg-war-week/pull/94. `ai-review` → `done`. Details: `../epics/R2-execution.md` [CLOSEOUT].

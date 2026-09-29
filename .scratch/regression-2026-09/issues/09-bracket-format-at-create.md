# 09: Choose "Run as Bracket" when creating a Competition

**What to build:** It isn't clear how to create a tournament: the Bracket Format option only appears after the Competition exists.

**Blocked by:** none

**Status:** done

**Source:** regression feedback item 10

## Notes

Show Format on the create form, with a short explanation of each option.

## Acceptance criteria

- [x] The create-Competition form offers the Format, including Bracket formats.
- [x] A Competition created as a Bracket links straight to its Bracket setup.
- [x] `pnpm gate` passes.

## Comments

**2026-09-28, Claude (grill-with-docs):** The create form's Format choice includes `games` once ticket 17 lands (Epic R3 adds it; Epic R1 ships the existing Formats). One-off contests are `games` Competitions, not Brackets (grilling Q17).

- 2026-09-28 (Paul, via `/atlas-implement` of Epic R1): `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. Verified at `968c733` (`pnpm gate`, exit 0; `test-results/r1-gate/gate.txt`). Evidence per criterion, the AI Code Review, and deviations: `../epics/R1-execution.md` ([AI CODE REVIEW], [CLOSEOUT]). PR: https://github.com/paul-macfarlane/jg-war-week/pull/91

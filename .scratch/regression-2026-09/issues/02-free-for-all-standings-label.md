# 02: Free-for-all shows "Team standings"

**What to build:** In a free-for-all War Week, the home page shows a "Team standings" heading although there are no Teams. It should just say "Standings".

**Blocked by:** none

**Status:** done

**Source:** regression feedback item 16

## Notes

The home heading already switches on `warWeek.mode` (`src/app/[edition]/(home)/page.tsx:92`), so the label likely comes from `StandingsList` (`src/components/standings.tsx:163`) or the edition's mode is set to `teams`. **Needs info:** which War Week and which URL showed it.

## Acceptance criteria

- [x] In free-for-all mode no page shows a Team standings heading; the heading reads "Standings".
- [x] A unit or component test covers the free-for-all heading.
- [x] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul): no repro to hand. Fix defensively: every standings heading switches on `mode` (free-for-all reads "Standings"), covered by a component test; note in closeout that the sighting was most likely a War Week set to `teams` mode. `needs-info → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. Verified at `968c733` (`pnpm gate`, exit 0; `test-results/r1-gate/gate.txt`). Evidence per criterion, the AI Code Review, and deviations: `../epics/R1-execution.md` ([AI CODE REVIEW], [CLOSEOUT]). PR: https://github.com/paul-macfarlane/jg-war-week/pull/91

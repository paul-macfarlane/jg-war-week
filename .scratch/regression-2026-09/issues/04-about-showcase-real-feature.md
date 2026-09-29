# 04: /about shows a real part of the app

**What to build:** The Finale demo on /about is fun but doesn't show something Participants actually use most. Replace or supplement it with a realistic showcase (e.g. live Standings moving after Points Entry, or a Bracket being decided).

**Blocked by:** 03

**Status:** done

**Source:** regression feedback item 1

## Notes

Pick the showcase during triage. Keep /about static (stills or recording) unless there is a reason otherwise.

## Acceptance criteria

- [x] /about's hero demo shows a feature Participants use day to day.
- [x] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul): the hero shows **Standings moving after a Points Entry** (an Organizer records Placement Points, the home Standings reorder), as static stills captured by `scripts/about-media.ts`. The Finale demo leaves the hero and stays as a still lower down. `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. Verified at `968c733` (`pnpm gate`, exit 0; `test-results/r1-gate/gate.txt`). Evidence per criterion, the AI Code Review, and deviations: `../epics/R1-execution.md` ([AI CODE REVIEW], [CLOSEOUT]). PR: https://github.com/paul-macfarlane/jg-war-week/pull/91

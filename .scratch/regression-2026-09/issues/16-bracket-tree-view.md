# 16: Show a Bracket as a tree

**What to build:** A tree view of a Bracket on the Competition page, the default Bracket view with a List toggle. Decisions: `../grilling-2026-09-28.md` (Q27–Q28).

**Blocked by:** none

**Status:** done

**Source:** regression feedback item 14

## Scope

- Both Bracket Formats. Rounds as columns left to right; connector lines for `single-elimination`; for `heats`, each Heat a box listing its Entrants with those advancing highlighted.
- Phones: one Round at a time with Round tabs (or swipe).
- Results fill in as Heats are decided; Squads show their Squad name.
- Past War Weeks get it on the same page. `/admin` keeps its list.

## Acceptance criteria

- [x] View-model unit tests: rounds, slots and connectors for 2, 5 and 8 Entrants single-elimination (with byes) and a two-Round Heats Bracket.
- [x] Screenshots at desktop and phone width for a seeded single-elimination and Heats Bracket, mid-way and finalized, under `test-results/e2e/<test>/`; no horizontal page scroll at 375px.
- [x] The List toggle shows the current list.
- [x] `/about` and `docs/maintainers-guide.md` updated.
- [x] `pnpm gate` passes.

## Comments

- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.
- 2026-09-29: [CLOSEOUT] `ai-review → done`. Verified at `968c733` (`pnpm gate`, exit 0; `test-results/r1-gate/gate.txt`). Evidence per criterion, the AI Code Review, and deviations: `../epics/R1-execution.md` ([AI CODE REVIEW], [CLOSEOUT]). PR: https://github.com/paul-macfarlane/jg-war-week/pull/91

# 105: Competitions list shows status, Winner and description

**What to build:** Each row on the Participant Competitions list shows the name, a two-line **description preview**, a **status** and the Format and scoring badges; no max badge (`92`).

**Blocked by:** R18 merged into `staging` (`103` makes the description rich text; the preview is its plain text via `toPlainText`)

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Participant: description preview, status, bracket round, winner, "No max"); grilling Q9

## Decisions

- **Status:** *Not started* (no result yet); *Underway*, with a Bracket's round ("Round 2 of 4", "Final"); *Closed* (Games or Participation closed); *Done · Winner: X* (Finalized or Closed with a 1st place; ties list both).
- One status function shared with Home's Recent results where it fits.

## Acceptance criteria

- [x] Unit tests for the status function per Format and state.
- [x] e2e screenshot of the list at 1440 and 390 with each status present (seeded).
- [x] `pnpm gate` passes.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r19`): claimed with Epic R19; `ready-for-agent` → `in-progress`. Execution record: [`R19-execution.md`](../epics/R19-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r19`): D105 `541d63eb` (Opus), review fixes `ec45a799`. `src/lib/competition-status.ts` holds the one status rule (29 unit cases, every Format and state, a Bracket's "Round N of M" and "Final", a tie, byes in both engines). `getCompetitions` loads the facts in one batch per War Week, and the winner comes from `finalWinners`, the rule Recent results and the Finale already share. Each row shows the name, the status, a `line-clamp-2` preview of `toPlainText`, and the Format and scoring badges. Accepted readings: a Finalized Placement or Bracket with no Placement Points reads "Done" with no winner; a tie reads "Winners: A, B", sorted by name. Every AC PASS; evidence in [`R19-execution.md`](../epics/R19-execution.md). `ai-review` → `done`.

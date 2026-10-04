# 105: Competitions list shows status, Winner and description

**What to build:** Each row on the Participant Competitions list shows the name, a two-line **description preview**, a **status** and the Format and scoring badges; no max badge (`92`).

**Blocked by:** R18 merged into `staging` (`103` makes the description rich text; the preview is its plain text via `toPlainText`)

**Status:** in-progress

**Source:** Paul's regression feedback 2026-10-03 (Participant: description preview, status, bracket round, winner, "No max"); grilling Q9

## Decisions

- **Status:** *Not started* (no result yet); *Underway*, with a Bracket's round ("Round 2 of 4", "Final"); *Closed* (Games or Participation closed); *Done · Winner: X* (Finalized or Closed with a 1st place; ties list both).
- One status function shared with Home's Recent results where it fits.

## Acceptance criteria

- [ ] Unit tests for the status function per Format and state.
- [ ] e2e screenshot of the list at 1440 and 390 with each status present (seeded).
- [ ] `pnpm gate` passes.

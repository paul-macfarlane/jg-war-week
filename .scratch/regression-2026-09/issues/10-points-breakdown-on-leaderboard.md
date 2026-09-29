# 10: See where points came from

**What to build:** On the individual leaderboard and the Team Standings, expanding a row should show the Points Entries behind the total, newest first.

**Blocked by:** none

**Status:** in-progress

**Source:** regression feedback item 4

## Notes

Participants want to know why they have the points they have. Data already exists as Points Entries.

## Acceptance criteria

- [ ] Expanding a Participant or Team shows each contributing Points Entry (Competition, points, when), newest first.
- [ ] Totals in the breakdown match the row.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul, via `/atlas-implement` of Epic R1): `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).

# 05: End War Week shows the Winner from points

**What to build:** Ending a War Week asks the Organizer to type the Winner. The Winner should come from the Standings: the rank-1 Team (or Participant in free-for-all), or a tie declared when rank 1 is shared.

**Blocked by:** none

**Status:** needs-triage

**Source:** regression feedback item 7

## Notes

`defaultWinner()` (`src/lib/war-week-lifecycle.ts:167`) already computes this and joins ties with " & ", but the dialog shows it as editable text. Decide in triage whether an Organizer override survives.

## Acceptance criteria

- [ ] The End War Week dialog shows the computed Winner read-only.
- [ ] A shared rank 1 shows as a tie (e.g. "Tie: A & B") and is recorded as such in the Archive.
- [ ] Unit tests cover single winner and tie.
- [ ] `pnpm gate` passes.

## Comments

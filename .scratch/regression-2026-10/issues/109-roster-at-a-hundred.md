# 109: Roster admin at 100 Participants

**What to build:** Make the admin Roster workable at 100 Participants: today it is one 100-row list with no search or filter, and Add Participant and Import sit below the last row.

**Blocked by:** none

**Status:** ready-for-agent (absorbed by Epic R24, [`../../scale/spec.md`](../../scale/spec.md); decisions there)

**Source:** Ticket 106 scale pass (2026-10-03)

## Finding

- `/admin/roster` with the XII scale demo is about 5,400 px tall at 1440 and 6,600 px at 390 (XI's 101 in Teams: 7,900 and 9,600 px, each row also carrying "No email: won't be linked when they sign in"). Finding one person means scrolling or the browser's find.
- The page's actions (Add Participant, Import) are only reachable after scrolling past every row.
- Screenshots: `test-results/e2e/regression-r19-scale-100-P-90238-…/roster-{1440,390}.png` and `…a7175…/xi-roster-{1440,390}.png`.

## Repro

1. `pnpm seed:demo:scale`, sign in as an Organizer, open `/admin/roster`.

## Open questions

- A search box (name and email: it is Organizer-only), actions at the top, or both? Group by Team in a teams War Week?

## Acceptance criteria

- [ ] The decision is recorded and built; screenshots at 1440 and 390 with 100 Participants.
- [ ] `pnpm gate` passes.

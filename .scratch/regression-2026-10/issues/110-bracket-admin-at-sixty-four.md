# 110: Bracket admin page at 64 Entrants

**What to build:** Shorten a 64-Entrant Bracket's admin page: it lists every Entrant three times (the Entrants chips, the 64 Seed Positions, the 32 Round 1 pairings) before the tree.

**Blocked by:** none

**Status:** in-progress (absorbed by Epic R24, [`../../scale/spec.md`](../../scale/spec.md); decisions there)

**Source:** Ticket 106 scale pass (2026-10-03)

## Finding

- `/admin/competitions/<Ping Pong Bracket>` is about 12,000 px tall at 1440 and 13,300 px at 390. Once Round 1 has results the Entrants and Seed Positions are locked, yet both lists stay fully expanded above the Bracket a Host is there to record.
- Screenshots: `test-results/e2e/regression-r19-scale-100-P-a53ec-…/entrants-{1440,390}.png`.

## Repro

1. `pnpm seed:demo:scale`, sign in as an Organizer, open Ping Pong Bracket's admin page.

## Open questions

- Collapse Seed Positions and the pairings once generated (or once locked)? Drop the Round 1 pairings list, since the tree shows them?

## Acceptance criteria

- [ ] The decision is recorded and built; screenshots at 1440 and 390 with 64 Entrants.
- [ ] `pnpm gate` passes.

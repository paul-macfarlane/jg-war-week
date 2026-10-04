# 111: Bracket tree at 64 Entrants

**What to build:** Make a 64-Entrant Bracket tree easy to follow, above all for a Participant looking for their own Heat.

**Blocked by:** none

**Status:** needs-triage

**Source:** Ticket 106 scale pass (2026-10-03)

## Finding

- On `/xii/competitions/<Ping Pong Bracket>` the tree is about 4,700 px tall at 1440 and 4,900 px at 390. At 1440 it sits in the page's narrow column, so only Rounds 1–3 of 7 show and the rest scroll sideways inside the Rounds region; the page itself never scrolls sideways (asserted).
- There is no way to jump to Your Heat or to a Round; long names truncate inside Heats ("Maximiliana Feat…").
- Screenshots: `test-results/e2e/regression-r19-scale-100-P-fcc91-…/bracket-tree-{1440,390}.png`.

## Repro

1. `pnpm seed:demo:scale`, sign in as any Participant, open Ping Pong Bracket.

## Open questions

- Let the tree use the full width on desktop? "Jump to you" or Round chips? Show later Rounds first once Round 1 is done?

## Acceptance criteria

- [ ] The decision is recorded and built; screenshots at 1440 and 390 with 64 Entrants.
- [ ] `pnpm gate` passes.

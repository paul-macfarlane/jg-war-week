# 113: Finale Standings slide with many scorers

**What to build:** Make the Finale's Standings countdown work when far more than a dozen Participants have points: today the rows below the screen are never shown and the countdown takes about a second per row.

**Blocked by:** none

**Status:** needs-triage

**Source:** Ticket 106 scale pass (2026-10-04)

## Finding

- With the XII scale demo only 17 Participants have points yet. On `/xii/finale`'s Standings slide, 12 rows fit at 1440×900 and 13 at 390×844; the rest sit below the slide, which doesn't scroll, so the bottom of the Standings never appears on the projector.
- The countdown took about 17 s to reveal 17 rows (the e2e waits for Replay). With all 100 scoring, as War Week XII will by the end, it would take well over a minute and show only the top dozen.
- Screenshots: `test-results/e2e/regression-r19-scale-100-P-72cb9-…/finale-standings-{1440,390}.png`.

## Repro

1. `pnpm seed:demo:scale`, sign in as an Organizer, open `/xii/finale` and press → to the Standings slide.

## Open questions

- Count down only the top N (and say how many more)? Several columns on a wide screen? A faster pace past the top ten?

## Acceptance criteria

- [ ] The decision is recorded and built; screenshots at 1440 and 390 with 100 scorers.
- [ ] `pnpm gate` passes.

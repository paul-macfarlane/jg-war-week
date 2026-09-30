# 01: What Stairs records, and does it need an event log?

**Type:** research

**Status:** open

**Blocked by:** none

## Question

What exactly does Stairs store today, and is it enough to score every past rule (see the map's Notes)? Stairs upserts pre-aggregated per-period totals (`Climbs` rows keyed `user.entity.period.startDate`), so there is no per-climb or per-entry timestamp. Establish:

- Which past rules the current data can score, and which need per-entry events with timestamps (e.g. "11th climb logged 11th latest"; "people over 111", per day or per week?).
- The smallest change to Stairs that would add an append-only entry log (and whether history can be backfilled; it can't be for timing).
- How guests, negative counts (corrections, -200..200) and the New York vs browser timezone split affect a mirror.
- Where the Stairs backend is hosted today and who owns it (code gives no deploy config; Paul to ask the owner).

Resolve with a recommendation to take to the Stairs owner.

## Comments

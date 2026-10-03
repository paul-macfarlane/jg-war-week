# 98: 3rd place game; places from the final, up to 4th

**What to build:** An optional **3rd place game** between the two semifinal losers, offered when the final is head-to-head. Bracket places come only from the final (and the 3rd place game); Placement Points stop at **4th**. Today both semifinal losers tie for 3rd and places reach 5th.

**Blocked by:** `97`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: 3rd place games; cap at 4th); grilling Q4, Q17

## Decisions

- **With** a 3rd place game: final → 1st, 2nd; 3rd place game → 3rd, 4th.
- **Without:** final → 1st, 2nd; both semifinal losers tie 3rd (each gets 3rd's points); no 4th.
- **Heats final** (more than 2): its finishing order gives places 1–4; nobody outside the final is placed.
- The 3rd place game is a Heat in the tree beside the final; self-report applies as to any Heat; Finalize needs it recorded when it's on.
- The cap of 4 is a per-Format rule (`95`), not a storage limit.

## Acceptance criteria

- [ ] Unit tests: 8 entrants with and without the 3rd place game; a Heats final of 4; points per place with the [10, 7, 5, 3] example.
- [ ] e2e: a head-to-head Bracket with a 3rd place game run to Finalize; Standings show 4 places.
- [ ] `pnpm gate` passes.

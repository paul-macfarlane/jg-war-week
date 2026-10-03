# 98: 3rd place game; places from the final, up to 4th

**What to build:** An optional **3rd place game** between the two semifinal losers of a head-to-head (2 / 1) Bracket. Bracket places come only from the final (and the 3rd place game); Placement Points for a Bracket stop at **4th**. Today both semifinal losers tie for 3rd and places reach 5th.

**Part of:** epic R17 (`../epics/R17-brackets.md`), one work package.

**Blocked by:** `97`, `99` (order inside R17)

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: 3rd place games; cap at 4th); grilling Q4, Q17; red-team pass 1 W2, W3

## Decisions

- **Only for a 2 / 1 Bracket** with at least 4 Entrants (two real semifinals). The builder's **3rd place game** switch is off by default, shown only at 2 / 1, and disabled with a reason under 4 Entrants; the server refuses `thirdPlaceGame: true` otherwise.
- **Stored as** `bracket_config.thirdPlaceGame`, plus at Generate one extra Heat with `third_place = true`, in the final's round at position 1 (the final is position 0), fed by `loser_to_heat_id` / `loser_to_slot` on each semifinal (mirroring `winner_to_*`).
- **Locked once the Bracket starts:** it is saved with the other Bracket settings and follows their rule; once any Heat Result exists, the server refuses a change. A change before then rebuilds the Heats as a heat-size change does today.
- **Places:**
  - **With** a 3rd place game: final → 1st, 2nd; 3rd place game → 3rd, 4th.
  - **Without:** final → 1st, 2nd; both semifinal losers tie 3rd (each gets 3rd's points); no 4th.
  - **Heats final** (more than 2 per Heat): its finishing order gives places 1–4; nobody outside the final is placed.
- **Which Heat is which (W3):** the final is the Heat in the last round with `third_place = false`. Every reader of "the final" or "the last round" uses that, never `max(round)` alone or "the only Heat in the last round": `champion` / `finalHeat` (`engine.ts`, `heats.ts`), `isComplete`, `src/queries/schedule.ts`, `src/lib/bracket/finale.ts`, `src/lib/bracket/points.ts` and MCP's champion. The tree labels them **Final** and **3rd place game**; the 3rd place game sits beside the final, visually secondary.
- Self-report applies to the 3rd place game as to any Heat; Finalize needs it recorded when it's on.
- The cap of 4 is a per-Format rule (`BRACKET_PLACEMENTS = 4` in `src/lib/competitions.ts`), not a storage limit.

## Acceptance criteria

- [x] Unit tests: 8 Entrants with and without the 3rd place game (places and points with Placement Points [10, 7, 5, 3]: with it, the four placed Entrants get 10, 7, 5, 3; without, both semifinal losers get 5 and nobody gets 3); a Heats final of 4 placing 1–4; 4 Entrants with the game; refusal at 3 Entrants and at a non-2/1 config.
- [x] Unit tests with a 3rd place game present: `champion` is the final's winner even when the 3rd place game is recorded last; `isComplete` is false until both are recorded; the Finale's Bracket data shows the final as the final; MCP's champion is the final's winner.
- [x] Postgres test: toggling the 3rd place game is refused once a Heat Result exists.
- [x] Placement Points over 4 are refused for a Bracket, with the message from `placementLimitRefusal`.
- [x] e2e: a head-to-head Bracket of 8 with a 3rd place game run to Finalize; the generated Points Entries give the four placed Entrants 10, 7, 5, 3 and nobody else any; screenshot at 1440.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r17`): claimed; `ready-for-agent` → `in-progress`. Execution record: [`R17-execution.md`](../epics/R17-execution.md).

- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r17`): D98 `1281384` (Opus), hardened in `f9710cf` (a hard lock, even with force). The final is identified in `src/lib/bracket/final.ts`; 3rd place game at position 2 (positions are 1-based); new `third-place.test.ts`, `e2e/bracket-third-place.spec.ts` (10/7/5/3, 1440 shot); rewritten the 5th-place tests. Every AC PASS; evidence and the AI Code Review in [`R17-execution.md`](../epics/R17-execution.md). `ai-review` → `done`.
- 2026-10-03 [PR] https://github.com/paul-macfarlane/jg-war-week/pull/128

# 69: The Participation Format

**What to build:** A new Format, **`participation`**, for things where taking part earns points (Black Midnight, workouts, Spirit submissions, HQ attendance). The Host (or an Organizer) ticks who took part; optionally Participants **check in** themselves. Points land when the Host presses **Close** and are withdrawn by **Reopen**, like `games`.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A17; grilling Q17, Q25; wiki survey in `../grilling-2026-10-01.md`

## Decisions

- **Individual scoring:** N points per Participant who took part (Counts Toward Team as today).
- **Team scoring**, the Host picks one:
  - **Ranked by headcount:** Teams ranked by how many of their Participants took part; Placement Points by place (ties share the higher place, the Bracket/Games tie rule).
  - **Per person:** N points to the Team per Participant who took part.
- **Self check-in:** a per-Competition switch, off by default; optional check-in close time. A Participant checks in or out until it closes (account linking only); the Host/Organizer can add or remove anyone until Close.
- The Competition page shows who took part (and the team counts in team scoring); Home's Recent results (ticket 56) shows a Close.
- Access: check-in is a new Participant write: extend ADR 0006 (or a new ADR) and `can`. Red-team (schema and access).
- CONTEXT.md: **Participation** Format, **Check in**.

## Acceptance criteria

- [ ] Unit tests for scoring: individual N each; team ranked by headcount with ties; team per person; Close/Reopen idempotence.
- [ ] e2e: a Host creates a team Participation Competition (ranked by headcount, 5/3/1), two Participants check in, the Host ticks a third, Close moves the Standings, Reopen withdraws.
- [ ] A seeded `participation` Competition in the demo; seeds load twice; smoke covers its page.
- [ ] `pnpm gate` passes.

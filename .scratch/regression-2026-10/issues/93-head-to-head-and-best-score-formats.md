# 93: Head-to-head and Best score as Formats; ranked Games and Finish Points go

**What to build:** The `games` Format and its Game Types flatten into two top-level Formats, **Head-to-head** and **Best score**, with today's behaviour (Entrants, self-enroll, Entrant limit, logging close time, leaderboard, **Close** awards Placement Points by leaderboard place, **Reopen** withdraws). The `ranked` Game Type and per-Game **Finish Points** go; a one-off ranking is a Placement (`90`).

**Blocked by:** `90`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: ranked game type; where to enter scores); grilling Q23, Q32–Q34, Q36

## Decisions

- "Game" stays the word for one logged play ("Log a Game"); "Games" is no longer a Format name.
- Participants log their own Games (ADR 0006 unchanged); Organizers and Hosts log and edit from admin in R18 (`104`).
- Per-Format settings (Best score's direction and attempts, Head-to-head's tie rule) keep their meaning; R18 (`101`) moves them onto the Competition page.
- Electric City Matrix (demo XI, ranked, no Games logged) becomes a Placement in `96`.
- CONTEXT.md: Format list; retire Game Type, ranked, Finish Points.

## Acceptance criteria

- [ ] Unit tests for both leaderboards and Close/Reopen still pass under the new Formats; no `ranked` or `finishPoints` left outside the migration.
- [ ] The existing e2e (a Participant logs a head-to-head Game from Home, the Host closes it, Standings move) passes under the new Format.
- [ ] MCP `get_games` (or its successor) reports the new Formats.
- [ ] `pnpm gate` passes.

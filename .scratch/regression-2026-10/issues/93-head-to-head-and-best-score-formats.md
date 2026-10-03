# 93: Head-to-head and Best score as Formats; ranked Games and Finish Points go

**What to build:** The `games` Format and its Game Types flatten into two top-level Formats, **Head-to-head** and **Best score**, with today's behaviour (Entrants, self-enroll, Entrant limit, logging close time, leaderboard, **Close** awards Placement Points by leaderboard place, **Reopen** withdraws). The `ranked` Game Type and per-Game **Finish Points** go; a one-off ranking is a Placement (`90`).

**Part of:** Epic R16's one work package (`../epics/R16-competition-model.md`): no gate, order or migration of its own. Schema changes go into `src/db/schema.ts`; the epic generates and hand-edits the one migration and converts the seeds.

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: ranked game type; where to enter scores); grilling Q23, Q32–Q34, Q36; red-team 2026-10-03 (W7, W10, M4)

## Decisions

- "Game" stays the word for one logged play ("Log a Game"); "Games" is no longer a Format name.
- Participants log their own Games (ADR 0006 unchanged); Organizers and Hosts log and edit from admin in R18 (`104`).
- Per-Format settings (Best score's direction and attempts, Head-to-head's tie rule) keep their meaning; R18 (`101`) moves them onto the Competition page.
- **Schema:** `competition_format` gains `head-to-head` and `best-score` and loses `games`; `game_type` and its enum go; Finish Points leave `game_config`; the `competition_game_type_iff_games` CHECK becomes one tying `game_config` to the two new Formats. The epic's migration maps old rows (a ranked Competition becomes an empty Placement).
- **Seeds:** the epic converts the JSON (Electric City Matrix, Bouncy Pong, Tuesday Stairs); the seed schema drops `gameType` and takes the new Formats.
- **Tests:** rewrite `e2e/games.spec.ts` and the smoke's "three seeded `games` Competitions" / `get_games` checks for the new Formats; delete the ranked-Game and Finish Points unit tests.
- CONTEXT.md: Format list; retire Game Type, ranked, Finish Points.

## Acceptance criteria

- [ ] Unit tests for both leaderboards and Close/Reopen still pass under the new Formats.
- [ ] `grep -rn "finishPoints\|finish_points\|\"ranked\"\|'ranked'" src e2e scripts` finds no Game Type or Finish Points use. Prose and other meanings of "ranked" (Bracket view, "ranked by headcount") stay.
- [ ] The existing e2e (a Participant logs a head-to-head Game from Home, the Host closes it, Standings move) is rewritten for the new Format.
- [ ] MCP `get_games` (or its successor) reports the new Formats.

# 93: Head-to-head and Best score as Formats; ranked Games and Finish Points go

**What to build:** The `games` Format and its Game Types flatten into two top-level Formats, **Head-to-head** and **Best score**, with today's behaviour (Entrants, self-enroll, Entrant limit, logging close time, leaderboard, **Close** awards Placement Points by leaderboard place, **Reopen** withdraws). The `ranked` Game Type and per-Game **Finish Points** go; a one-off ranking is a Placement (`90`).

**Blocked by:** `90`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: ranked game type; where to enter scores); grilling Q23, Q32–Q34, Q36; red-team 2026-10-03 (W7, W10, M4)

## Decisions

- "Game" stays the word for one logged play ("Log a Game"); "Games" is no longer a Format name.
- Participants log their own Games (ADR 0006 unchanged); Organizers and Hosts log and edit from admin in R18 (`104`).
- Per-Format settings (Best score's direction and attempts, Head-to-head's tie rule) keep their meaning; R18 (`101`) moves them onto the Competition page.
- **Schema:** `competition_format` gains `head-to-head` and `best-score` and loses `games` (recreate the type, per the epic's enum rule); `game_type` and its enum go, and Finish Points leave `game_config` (they live in the ranked config today); the `competition_game_type_iff_games` CHECK is replaced by one tying `game_config` to the two new Formats. The migration maps `games` + `head-to-head` / `best-score` to the new Formats and a `ranked` Competition to `placement` (its Games, Finish Points and Entrants deleted).
- **Seeds (converted in `96`):** Electric City Matrix (demo XI, ranked, no Games logged) becomes an empty, unfinalized Placement. Bouncy Pong and Tuesday Stairs become Head-to-head and Best score; their three typed Points Entries (`bouncy-pong-nick-brown`, `tuesday-stairs-red`, `tuesday-stairs-blue`) are **removed**, not rewritten: Games aren't seeded (CONTEXT.md) and a typed entry on a Games Competition was never a valid shape. Any smoke or e2e assertion of demo XI totals that included them is updated.
- **Tests:** rewrite `e2e/games.spec.ts` and the smoke's "three seeded `games` Competitions" / `get_games` checks for the new Formats; delete the ranked-Game and Finish Points unit tests.
- CONTEXT.md: Format list; retire Game Type, ranked, Finish Points.

## Acceptance criteria

- [ ] Unit tests for both leaderboards and Close/Reopen still pass under the new Formats.
- [ ] `grep -rn "finishPoints\|finish_points\|\"ranked\"\|'ranked'" src e2e scripts` finds no Game Type or Finish Points use. Prose and other meanings of "ranked" (Bracket view, "ranked by headcount") stay.
- [ ] `src/db/migrations.test.ts`: in a scratch schema with a head-to-head, a best-score and a ranked Competition (with a Game and Entrants), the migration applies, the first two have the new Formats with their config, and the ranked one is an empty `placement`.
- [ ] The existing e2e (a Participant logs a head-to-head Game from Home, the Host closes it, Standings move) is rewritten for the new Format (first run in `96`).
- [ ] MCP `get_games` (or its successor) reports the new Formats.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass (the full gate runs once, in `96`).

# 17: The `games` Format: Competitions decided by logged Games

**What to build:** A fourth Format, `games`, for Competitions decided by one or many Games that players log themselves: a one-off showdown, a best of X, or ping pong all week. Its Game log is the War Week's record of what was played, not just who scored. Decisions: `../grilling-2026-09-28.md` (Q1–Q26); access: ADR 0006.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** regression feedback items 15 and 20

## Needs

- **Host:** runs a Competition that isn't a tournament (a showdown, a best of 5, a week-long ladder of casual games) without typing every result.
- **Participant:** logs a Game in seconds from a phone and sees where they stand.
- **Organizer:** keeps a record of what was played in the Archive.

## Scope

- `games` Format with one **Game Type** per Competition: `head-to-head`, `best-score`, `ranked` (CONTEXT.md).
- Settings: Draws allowed (head-to-head), Best of off/3/5/7 with exactly 2 Entrants (head-to-head); Count best/total, Better is higher/lower, unit label (best-score); Finish Points table, default one per player beaten (ranked); Entrants open to everyone or a fixed list.
- Logging, editing and deleting Games per ADR 0006. Host and Organizer edit or delete any Game.
- Leaderboard and Game log (newest first, "Mine" filter) on the Competition page; columns per `../grilling-2026-09-28.md` Q20.
- Close / Reopen with Placement Points, optional close time; Best of prompts Close when decided.
- Home "Log a Game" shortcut.
- Archive shows past `games` Competitions' leaderboard and log.
- MCP: `games` Competitions readable (leaderboard, Games) without emails.
- Seeds: at least one `games` Competition of each Game Type in the demo seed.
- Out: Squads in `games`, times and places on Games, streaks and records, confirmations.

## Acceptance criteria

- [ ] Leaderboard ranking is unit-tested per Game Type: head-to-head wins with draws, best-score best and total in both directions, ranked Finish Points with ties sharing the higher finish; Best of detects the decided moment.
- [ ] Access is unit-tested per ADR 0006: a linked Participant in the Game can log; the "Which one is you?" pick grants nothing; a non-player is refused; the logger edits or deletes their own Game until close; another player can't; Host and Organizer can; a closed Competition refuses everyone.
- [ ] Close awards Placement Points from the leaderboard as Points Entries and the Standings change; Reopen withdraws them (DB-backed test).
- [ ] Playwright: a Participant logs a head-to-head Game from the home shortcut, the leaderboard updates, the Host edits it, closes the Competition, and the Standings move. Screenshots under `test-results/e2e/<test>/`.
- [ ] Smoke covers the seeded `games` Competitions' pages and one Game logged over HTTP.
- [ ] Schema change and demo seed updated together; plan red-teamed.
- [ ] `/about`, `docs/maintainers-guide.md` and CONTEXT.md's rule sections updated; ADR 0006 set to accepted.
- [ ] `pnpm gate` passes.

## Comments

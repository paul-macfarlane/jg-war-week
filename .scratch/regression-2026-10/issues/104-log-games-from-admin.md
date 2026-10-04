# 104: Log and edit Games from admin

**What to build:** On a Head-to-head or Best score Competition's admin page, Organizers and Hosts see the Games list and a **Log a Game** button, and can edit or delete any Game, with the same form Participants use. Today Games are logged only on the Participant Competition page.

**Part of:** Epic R18 (one work package; see the epic for branch, migration, gate and test data).

**Blocked by:** `101` (order inside R18)

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: where to record games and scores); grilling Q22, Q36; red-team pass 1 M2

## Decisions

- Reuse `GameForm`; any Entrant can be picked as a player (not just the signed-in person). Logging and editing use the existing Game authorization (Organizers, and Hosts of that Competition); no new rule.
- Participants keep logging their own Games from the Competition page and Home.

## Acceptance criteria

- [x] e2e: a Host (of an `E2E R18 …` Best score Competition) logs a Best score attempt for a Participant from admin, edits it, and the Competition's Games leaderboard shows the edited score (M2: the Competition leaderboard, not War Week Standings, which move only at Close).
- [x] e2e: the same Host deletes the Game behind a `ConfirmDialog`, and it leaves the leaderboard.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r18`): claimed with Epic R18; `ready-for-agent` → `in-progress`. Execution record: [`R18-execution.md`](../epics/R18-execution.md).

- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r18`): D104 `303f082` (Sonnet): `AdminGames` in the Head-to-head and Best score run area reuses `GameLog` and `GameForm` with no player preselected; existing Game authorization unchanged. Every AC PASS; evidence in [`R18-execution.md`](../epics/R18-execution.md). `ai-review` → `done`. PR: https://github.com/paul-macfarlane/jg-war-week/pull/130

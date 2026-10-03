# 104: Log and edit Games from admin

**What to build:** On a Head-to-head or Best score Competition's admin page, Organizers and Hosts see the Games list and a **Log a Game** button, and can edit or delete any Game, with the same form Participants use. Today Games are logged only on the Participant Competition page.

**Blocked by:** `101`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: where to record games and scores); grilling Q22, Q36

## Decisions

- Reuse `GameForm`; any Entrant can be picked as a player (not just the signed-in person).
- Participants keep logging their own Games from the Competition page and Home.

## Acceptance criteria

- [ ] e2e: a Host logs a Best score attempt for a Participant from admin, edits it, and the leaderboard updates.
- [ ] `pnpm gate` passes.

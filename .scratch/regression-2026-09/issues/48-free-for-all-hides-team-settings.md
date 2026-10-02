# 48: Free-for-all hides Team Label, Leader Title and Teams

**What to build:** When a War Week's Mode is `free-for-all`, Settings hides Team Label and Leader Title, and the roster admin hides Teams (team column, team field, Leader flag, "Add Team"). Switching back to `teams` shows them again with their saved values.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A11; grilling Q13

## Decisions

- Free-for-all has no Teams. Saved Team Label, Leader Title and any existing Teams are kept, just hidden (no data deleted).
- Participant-facing pages already follow Mode; check the Teams/roster page heading and the More link label (`rosterHeading`) read sensibly with no Teams ("Participants").
- Competition setup in free-for-all: team scoring stays available only if the War Week has Teams; otherwise hide it. Record what you find in the closeout.

## Acceptance criteria

- [ ] In a free-for-all War Week (XII demo), Settings shows no Team Label or Leader Title, and the roster has no Team controls; screenshots at both viewports.
- [ ] Switching Mode to `teams` shows them with prior values (unit or e2e).
- [ ] `pnpm gate` passes.

# 101: One admin page per Competition, autosaving

**What to build:** Each Competition gets one admin page, `/admin/competitions/[id]`, replacing the edit sheet, the Bracket builder, the Games settings and the Participation settings. **Settings** sit on top and **autosave per field** (as War Week Settings, ticket 59): name, description, Format, scoring, counts toward team, Group, Placement Points, Hosts, and the Format's own settings (score direction, heat size and advancing, 3rd place game, Best score direction and attempts, self-enroll, Entrant limit, close times, self-report, check-in). The Format's **run area** sits below: Entrants and the tree (Bracket), Games and Log a Game (Head-to-head, Best score), Record placements (Placement), who took part (Participation), with Finalize / Close / Reopen.

**Blocked by:** R17 merged into `staging`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: autosave, "Run as a bracket"); grilling Q6, Q14, Q30, Q31

## Decisions

- The Competitions list's **Edit** opens this page (an exception to R9's sheet pattern: a Competition is too big for a sheet). **Add** still creates in a sheet with name, Format and scoring, then opens the page.
- "Run as a bracket" goes; Format is a field here.
- **Locks** (disabled with a one-line reason, never a failing save):
  - Format once any result exists (Entrants, Games, Placements, check-ins, Heat Results).
  - Bracket structure (heat size, advancing, 3rd place game, Entrants, seeding) once any Heat Result exists; **Reset bracket** behind a `ConfirmDialog` clears results and unlocks.
  - Name, description, Hosts and Placement Points never lock (changed Placement Points apply on the next Finalize / Close).
  - Everything locks while Finalized or Closed, until Reopen.
- Hosts see the page for their own Competitions; Hosts' existing limits (no create, delete or Host assignment) stay.
- A failed autosave shows at its field; a "Saved" indicator as in Settings.

## Acceptance criteria

- [ ] e2e per Format: change a setting, reload, it's kept; a locked field shows its reason; Reset bracket clears Heat Results and unlocks.
- [ ] e2e: a Host edits their Competition's settings and can't change Hosts.
- [ ] The old routes (`/admin/competitions/[id]/bracket`, `/games`, participation settings) redirect to the page.
- [ ] `pnpm gate` passes.

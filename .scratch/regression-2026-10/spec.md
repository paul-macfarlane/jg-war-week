---
title: Regression feedback, October 2026 (Competitions)
status: ready-for-agent
grilled: 2026-10-03 (see grilling-2026-10-03.md)
created: 2026-10-03
source: Paul's regression pass of admin Competition setup and the Participant pages after R9–R14
---

# Competitions, reshaped

## Summary

Paul ran the app as an Organizer setting up and running Competitions. The
verdict: the `points` Format doesn't match how a Competition works. A
Competition is a contest, so its **result** (who placed where, optionally
with a Score) should decide the points, not points typed one person at a
time. Points with no contest behind them become **Discretionary points**.

Around that, the Formats flatten and simplify: Games split into their own
Formats, ranked Games fold into Placement, Heats and single elimination
become one Bracket, and Max Points, Finish Points, Forfeit, seeding by
Standings and Heat Time & place go. Each Competition gets one admin page
with autosave. Participants get a more informative Competitions list, and
the app is checked at 100 Participants.

The scope rule from `.scratch/hardening/spec.md` still applies: removing
beats adding; correctness, then design, then fun.

## The model after this work

| Format | Recorded by | Result | Points |
|---|---|---|---|
| **Placement** | Organizers, Hosts | One sheet: a Place and optional Score per Participant or Team; a score direction fills Places from Scores | Placement Points by place on **Finalize**; **Reopen** withdraws |
| **Head-to-head** | Participants (own Games), Organizers, Hosts | Games of two, leaderboard by record | Placement Points by leaderboard place on **Close**; **Reopen** withdraws |
| **Best score** | Participants (own Games), Organizers, Hosts | Attempts, best counts | as Head-to-head |
| **Bracket** | Organizers, Hosts (Participants self-report where on) | Heats of N, top M advance; optional 3rd place game | Placement Points for places 1–4 from the final (and 3rd place game) on **Finalize** |
| **Participation** | Organizers, Hosts (self check-in where on) | Who took part | Individual: N each; team: Teams ranked by headcount, Placement Points |

Plus **Discretionary points**: Organizers only, no Competition, a reason, one
Participant or Team.

Ties share a place and its full points (the existing rule). Placement Points
have no length limit except Brackets (4).

## Epics and tickets

Schema-changing epics run one at a time, red-teamed: R16 → R17 → R18. R15 is
independent; R19 follows R17.

### R15, quick fixes (`epics/R15-quick-fixes.md`)

- `84` Heats advancers highlighted everywhere
- `85` Pointer cursor on everything clickable
- `86` Centre the top nav
- `87` Solid buttons for primary actions
- `88` War Week history in the War Week chrome
- `89` Games settings show what was saved

### R16, the Competition model (`epics/R16-competition-model.md`), red-teamed

- `90` The Placement Format
- `91` Discretionary points
- `92` Remove Max Points
- `93` Head-to-head and Best score as Formats; ranked Games and Finish Points go
- `94` Participation scoring follows the Competition's scoring
- `95` Placement Points without a limit
- `96` Migrate Competitions and seeds

### R17, Brackets (`epics/R17-brackets.md`), red-teamed

- `97` One Bracket Format
- `98` 3rd place game; places from the final, up to 4th
- `99` Remove seeding by Standings, Forfeit and Time & place
- `100` One Bracket tree for admin and Participants

### R18, the admin Competition page (`epics/R18-admin-competition-page.md`), red-teamed

- `101` One admin page per Competition, autosaving
- `102` Hosts picked from the roster
- `103` Rich-text Competition description
- `104` Log and edit Games from admin

### R19, Participant list and scale (`epics/R19-participant-list-and-scale.md`)

- `105` Competitions list shows status, Winner and description
- `106` 100 Participants: demo seed and scale pass

### Backlog

- `107` About page: a Finale sizzle video (lower priority)
- Host role testing: comment on `../regression-2026-09/issues/18-regression-pass.md`

## Every epic's Definition of Done

- `/about` (copy and media via `scripts/about-media.ts`),
  `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated
  where user-visible (team rules in `docs/agents/testing.md`).
- `CONTEXT.md` updated per the glossary list in the grilling record, as each
  ticket ships; ADRs for any access change (Hosts recording Placements,
  Discretionary points).
- MCP (`/api/mcp`, read-only) reflects the new Formats; no emails exposed.
- Schema epics: migration and demo seed together; seeds load twice; smoke on
  seeded local Postgres.
- `pnpm format:check && pnpm gate` passes; CI on the PR passes.

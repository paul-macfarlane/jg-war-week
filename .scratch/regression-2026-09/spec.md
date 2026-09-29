---
title: Regression feedback, September 2026
status: needs-triage
created: 2026-09-28
source: Paul's regression pass of JG War Week after hardening Epics A–G
---

# Regression feedback

## Summary

Paul's verdict: the app is solid. The biggest wins now are quality-of-life
additions for Competition and event tracking that go beyond points, so
War Week keeps a record of what happened, not just who scored.

The scope rule from `.scratch/hardening/spec.md` still applies: no new feature
without a named Organizer, Host or Participant need; removing beats adding;
correctness, then design, then fun.

## Tickets

### Bugs and small fixes (candidate epic R1)

- `01` Footer sits at the bottom on short pages
- `02` Free-for-all shows "Team standings" (needs-info: repro)
- `03` /about follows the current War Week
- `05` End War Week shows the Winner from points
- `06` Clarify or remove Competition "Max points"
- `07` Record a Bracket result in a dialog on large screens

### UX (candidate epic R2)

- `04` /about shows a real part of the app (after 03)
- `08` Filter the Schedule by day
- `09` Choose "Run as Bracket" when creating a Competition
- `10` See where points came from

### Needs grilling first

- `17` Competition types and activity history (Competiscore parity)
- `15` Participants enroll themselves (access change: red-team)
- `16` Show a Bracket as a tree
- `12` Appearance Themes support light and dark mode (likely schema change)
- `14` Generate an Appearance Theme with AI (after 12; ticket 17 candidate)
- `13` Decide how /admin is themed (needs-info: may be moot)

### Human and backlog

- `11` Refresh War Week XI and historical seed data (ready-for-human)
- `18` Full regression pass on Competition setup and the day
- `19` Stairs app integration (backlog, needs-info: owner and access)

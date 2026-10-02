---
title: Regression feedback, September 2026
status: needs-triage
grilled: 2026-09-28 (see grilling-2026-09-28.md)
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

- `20` A person across War Weeks (nice-to-have; needs grilling)

### Follow-ups from Epic R3

- `21` Forms keep their input across the Sheet/Dialog switch (bug), epic R4
- `22` A disabled Enroll button looks disabled, epic R2
- `23` Result choices use shadcn toggle-group, epic R4
- `24` End War Week warns about open Games Competitions, epic R4
- `25` Rename `finalized_at` and `generated_by_bracket` (backlog: pair it with a future red-teamed schema change)
- `26` The /about Games still shows its Competition title, epic R2

## Decisions (grilling, 2026-09-28)

Full record: `grilling-2026-09-28.md`. Glossary: `CONTEXT.md`. Access: ADR 0006.

- Tickets 12, 15, 16 and 17 are settled and `ready-for-agent`.
- One-off contests are **not** Brackets: a Bracket is a tournament. A new
  Format, `games`, covers the one-off showdown, a best of X and recurring
  play, with three Game Types (`head-to-head`, `best-score`, `ranked`).
- Participants log their own Games and can enroll themselves (ADR 0006).

## Delivery epics

Each epic is one `/atlas-implement` run, one branch and one PR into
`staging`. Epic files live in `epics/`.

| Epic | Tickets | Waits on |
|---|---|---|
| `R1` Fixes and quick wins | 01–10, 16 | Paul's decisions on 02, 04, 05, 06 |
| `R3` The `games` Format and self-enrollment | 17, 15 | R1 merged; plan red-teamed |
| `R4` Follow-ups from R3 | 21, 23, 24 | R3 merged |
| `R2` Light and dark Appearance Themes | 12, 22, 26 (13 checked) | R3 and R4 merged; plan red-teamed |

Outside the epics: `11` (Paul, with Claude in Chrome), `14` (after R2; ticket
17 of hardening), `18` (a regression pass after R1), `19` (backlog),
`20` (grilling first).

## October regression (grilling, 2026-10-01)

Full record: `grilling-2026-10-01.md`. Source: Paul's regression feedback
(Participant P1–P8, Admin A1–A18, checklist), 2026-10-01.

| Epic | Tickets | Waits on | Red-team |
|---|---|---|---|
| `R8` Quick fixes | 46–53 | none | no |
| `R9` Navigation | 54–59 | R8 merged | no |
| `R10` Accounts and testing | 60–63 | R9 merged; Blob store and staging secret | yes |
| `R11` Content | 64–68 | R10 merged | yes |
| `R12` Participation and Award Categories | 69–71 | R11 merged | yes |
| `R13` Finale slides | 72–74 | R12 merged | yes |

Outside the epics: `75` LTI and InfoLink sign-in (needs-info: domains),
`76` Tense billable hours (needs-info: owner and access), `77` personal
War Week recap (needs-triage, after R13).

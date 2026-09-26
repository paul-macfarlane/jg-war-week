---
title: JG War Week — post-hackathon hardening toward War Week XII
status: ready-for-agent
created: 2026-09-26
milestone: Phases 0–2 on `main` by Thu 2027-01-21, about a month before War Week XII (expected around Feb 21–26, 2027; every War Week from 2023 to 2026 ran in the last week of February)
source: Paul's post-hackathon grilling session, 2026-09-26 (backlog inventory, code audit, old-wikis format and host survey)
---

# Post-hackathon hardening

## Problem

JG War Week shipped for the JG AI Connection Event on 2026-09-25. It works,
but it was built against a deadline. The backlog is spread across four
feature folders with stale statuses, and a code audit found:

- a few real correctness bugs, one of which silently overwrites data
- a tooling hazard that can wipe any database it can reach
- no error boundaries
- authorization tested only by a smoke run that CI doesn't execute
- drift from ADR 0001

The next real use is War Week XII in late February 2027. Jason (COO) will be
the main user after Paul, who maintains the code. Paul wants to be able to
hand it off and still stay involved.

## Goal

A polished, stable app with a clean technical design, and a little fun for
War Week, without bloat. The work runs in order: correctness, then design,
then fun. Fun gets its own grilling round and can't delay the milestone.

## Scope rule

No new feature without a named Organizer, Host or Participant need.
Removing something beats adding something. A user-visible change updates
`/about` and `docs/maintainers-guide.md` in the same PR
(`docs/agents/testing.md`).

## Decisions

1. **Roles** (ADR 0002): a global **Organizer** list, per-Competition
   **Hosts**, and **Participants**. The per-edition `organizerEmails` list is
   removed. Permissions start permissive. Built in phase 1, because it
   deletes code phase 1 would otherwise have to fix (the self-email guard on
   past editions).
2. **Write target** (ADR 0003): every action takes its War Week from the
   request. The `admin_edition` cookie only chooses what `/admin` shows.
3. **Forms** (ADR 0004): `useActionState` plus shared Zod schemas; no React
   Hook Form.
4. **Changing a finalized Bracket's scoring or Placement Points is refused.**
   Reopen, edit, then finalize again. No cascading changes.
5. **Testing bar:** Vitest on domain logic, plus about five Playwright flows:
   - sign-in refusal
   - Points Entry → Standings
   - a Bracket advancing and finalizing
   - the Finale
   - the Archive

   Smoke runs in CI.
6. **Hackathon leftovers:** `MCP_PUBLIC` goes. The hackathon framing goes
   from README, CLAUDE.md, `llms.txt` and the specs. `/about` stays as the
   public showcase and is kept current with the product. The MCP server stays,
   read-only, at low priority.
7. **Deferred bracket work is kept**, ordered by how often past War Weeks
   used each format: Heats → qualifiers to finals → Squads → self-report
   confirmed by the Host → Heat times and places → round robin → double
   elimination (never used so far). Skill divisions are separate
   Competitions; no new concept.
8. **Slack posting** (`.scratch/war-weeker/issues/15`) and **portraits and
   bios** (`.scratch/war-weeker/issues/19`) stay as phase 3 candidates. Slack
   ranks first if IT provides the webhook. Portraits need their own grilling
   first.

## Phases and tickets

### Phase 0: Paul's manual steps

- `01` Production baseline checklist (ready-for-human)

### Phase 1: correctness

- `02` Smoke and gate refuse a non-local database
- `03` Roles and access consolidation: Organizer, Host, and the write target taken from the request (needs `/to-spec` and `/atlas-red-team`)
- `04` Error boundaries; actions never throw
- `05` Refuse scoring changes on a finalized Bracket
- `06` Run smoke in CI
- `07` A score-only Heat edit keeps later Heats
- `08` Sign-in works on Vercel preview aliases
- `09` Small UI and accessibility bugs
- `10` Races, indexes and small audit bugs

### Phase 2: design

- `11` Restore ADR 0001 layering, remove duplication and dead code (absorbs `.scratch/war-weeker/issues/30`)
- `12` Forms on `useActionState` + Zod (supersedes `.scratch/war-weeker/issues/18`)
- `13` Test net: domain gaps and Playwright flows
- `14` Polish leftovers (absorbs the rest of `.scratch/war-weeker/issues/34` and the accepted custom-inputs polish)
- `15` Remove hackathon leftovers

### Phase 3: fun

- `16` Bracket formats, in the order from decision 7
- `17` Grill "a twist of fun" for War Week XII

### Delivery epics

Phases 1 and 2 ship as four work packages. Each epic is one `/atlas-implement`
run with one branch and one PR into `staging`, and each waits for the
previous epic's PR to merge. Epic files live in `epics/`.

| Epic | Tickets | Waits on |
|---|---|---|
| `A` Safety net and independent fixes | 02, 06, 05, 07, 09, 15 | nothing |
| `B` Access and the action layer | 03, 04, 08, 10 | A merged; 03 specced and red-teamed (can run while A is built) |
| `C` Test net, then refactor | 13, 11 | B merged |
| `D` Forms and polish | 12, 14 | C merged |

Phase 3 stays per ticket: `16` gets its own epic (T9 and T10 first), and `17`
is a grilling session.

## Out of scope

Swiss, ladder, per-person history across years, the Stairs integration (no
owner or access), MCP OAuth, bulk CSV roster import.

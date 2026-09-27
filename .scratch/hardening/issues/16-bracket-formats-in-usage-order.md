# 16: Bracket formats, in order of past use (phase 3)

**What to build:** The deferred bracket work from `.scratch/brackets/spec.md`, built in the order past War Weeks used each format (old-wikis survey, 2021–2026). Each item gets its own plan from the brackets spec's matching ticket.

**Blocked by:** 03 (Hosts), 13 (test net)

**Status:** ready-for-agent (T9 and T10 before the 2027-01-21 milestone; the rest as time allows, never delaying it)

## Order

| # | Brackets spec ticket | Past uses | Notes |
|---|---|---|---|
| 1 | T9 Heats (multi-entrant) | ~12 | Catan every year, Mario Kart, poker, the four-way Beyblade arena |
| 2 | T10 qualifiers or groups → knockout | ~14 | The most common shape: Pool, Chess, Beyblade, Bouncy Ping Pong |
| 3 | T11 Squads | ~12 | Squads stay within one Team (Paul, answer B1) |
| 4 | T12 self-report | ~25 honor-system uses | **Redefined:** a Participant reports, the Competition's Host confirms. Replaces the spec's confirm/dispute between opponents. Access change: red-team review. |
| 5 | T13 Heat times and places, plus Now/Next | — | |
| 6 | T7 round robin, Group tables, ties | 2 | |
| 7 | T8 double elimination | 0 | Last; build only on request |

## Also carried from the brackets spec

- T6 extras:
  - the warning when you End a War Week with an unfinalized Bracket (do this first, with item 1)
  - the `per-heat` and `both` points modes, or remove them from the enum if no Competition needs them
  - a Finale for a Bracket
  - the Slack champion post (depends on `.scratch/war-weeker/issues/15`)
- T14: MCP `get_bracket`, live refresh on the bracket page, the Archive bracket view.
- Seeds: the XI demo seed gets a Bracket (also a fixture for ticket 13).
- W2: seeding by Standings and by drag (random only today).
- T3: the phone bracket layout, option (b) as shipped, is accepted. No prototype.

## Comments

- 2026-09-27: items 1 (Heats) and 2 (groups → knockout), the End War Week unfinalized-Bracket warning and the XI demo seed's new Brackets are grouped as `../epics/E-bracket-formats-milestone.md`. The rest stays here. *(Superseded the same day by the [DECISION] below: T10 and the demo seed were dropped.)*

**[DECISION] 2026-09-26 (Paul, during `/atlas-plan` of Epic E):**

- **T10 dropped.** No new Format needed: Pool is plain single elimination, and Bouncy Ping Pong ran as two Competitions (a points qualifier, then a four-Entrant single-elimination Bracket of the top finishers, teams of 2). Two Competitions stay the answer. The "~14 uses" came from wiki mentions of qualifiers and finals nights, not from Group play. Round-robin Groups and tiebreaks stay under T7.
- **`per-heat` and `both` points removed.** No Competition needs points per Heat; past multi-entrant games paid only 1st place, which Placement Points express. Epic E removes the code; a later migration drops `competition.bracket_points` and its type after Epic E is on `main`.
- **No seeded XI Bracket:** there is no history to seed one from.
- Epic E (`../epics/E-bracket-formats-milestone.md`) is the End War Week warning, T9 Heats and the points-mode code removal.

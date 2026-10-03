# 101: One admin page per Competition, autosaving

**What to build:** Each Competition gets one admin page, `/admin/competitions/[id]`, replacing the edit sheet, the Bracket builder, the Games settings, the Participation settings, `/admin/brackets/[id]` and Record placements' own page. **Settings** sit on top and **autosave per field** (as War Week Settings, ticket 59): name, description, Format, scoring, counts toward team, Group, Placement Points, Hosts, and the Format's own settings (score direction, heat size and advancing, 3rd place game, Best score direction and attempts, self-enroll, Entrant limit, close times, self-report, check-in). The Format's **run area** sits below: Entrants and the tree (Bracket), Games and Log a Game (Head-to-head, Best score), Record placements (Placement), who took part (Participation), with Finalize / Close / Reopen.

**Part of:** Epic R18 (one work package; see the epic for branch, migration, gate and test data).

**Blocked by:** none inside R18 (first part)

**Status:** ai-review

**Source:** Paul's regression feedback 2026-10-03 (Admin: autosave, "Run as a bracket"); grilling Q6, Q14, Q30, Q31; red-team pass 1 W1, W2, W3, W5, W8, M1, M4

## Decisions

- The Competitions list's **Edit** opens this page (an exception to R9's sheet pattern: a Competition is too big for a sheet). **Add** still creates in a sheet with name, Format and scoring, then opens the page.
- "Run as a bracket" goes; Format is a field here.
- **Format change** (W1): any Format to any Format while the Competition has no result. The server applies the defaults `createCompetition` applies for the new Format (`bracketConfig`, `gameConfig`, `entrantsOpen`, the Participation columns) and clears the old Format's settings (`score_direction` back to `none` when leaving Placement). Placement Points are kept; moving to a Bracket keeps the first 4. `GAMES_KEEP_FORMAT` and `PARTICIPATION_KEEPS_FORMAT` go.
- **A result** is any Entrant, Game, Placement, check-in, Heat or Heat Result, or a generated Points Entry.
- **Locks** (W2; Paul: what affects how the game runs can't change once it started). A locked field is disabled with a one-line reason, and the server refuses the same change with the same reason:

  | Field | Locks |
  | --- | --- |
  | Name, description, Group, Hosts, Placement Points | Never, not even while Finalized or Closed. A Placement Points change while Finalized or Closed applies at the next Finalize / Close, and the field says so. |
  | Format, scoring, counts toward team | Once any result exists |
  | Score direction, Best score direction and attempts | Once any result exists |
  | Heat size, advancing, 3rd place game, Entrants, building the Bracket | Once any Heat Result exists |
  | Self-enroll, Entrant limit, close times, self-report, check-in | Only while Finalized or Closed (they set who joins and until when, so an Organizer can extend a deadline mid-week) |
  | Everything except the first row | While Finalized or Closed, until Reopen |

- **No Reset bracket** (W8, Paul): once a Bracket has a Heat Result, its structure and Entrants stay as they are. Today's "This Bracket has Heat Results. Confirm to clear them and start over." (`HAS_RESULTS_ERROR`) and the `force` option on `setCompetitionFormat`, `replaceEntrants` and `generateBracket` go; a Bracket set up wrong is deleted and added again.
- **Hosts** see the page for their own Competitions. Hosts' existing limits stay: no create, delete or Host assignment. A Host sees the Hosts field read-only, as names only (W3).
- **Autosave** (M1): extend `src/lib/autosave.ts` (or add a sibling helper) so a field may hold a boolean, a number, a list, rich-text content or a set of emails, not only a string. A failed autosave shows at its field; a "Saved" indicator as in Settings. Forms seeded from server data follow it after a save (`docs/maintainers-guide.md`, UI).
- **Redirects** (W5, M4): `/admin/competitions/[id]/bracket`, `/games`, `/participation`, `/admin/brackets/[id]` and `/admin/placements/[competitionId]` permanently redirect (`permanentRedirect`) to `/admin/competitions/[id]`. Every caller is updated to the new page: `setupHref` (`src/lib/competitions.ts`), the links in `bracket-builder.tsx`, `games-view.tsx`, `placement-sheet.tsx` and `war-week-lifecycle-controls.tsx`, `scripts/smoke/admin.ts`, `scripts/smoke/brackets.ts`, and the e2e specs.

## Acceptance criteria

- [ ] e2e per Format (Placement, Head-to-head, Best score, Bracket, Participation; each on its own `E2E R18 …` Competition): change a setting, reload, it's kept; leave and return, it's kept; add a result, and a locked field shows its reason.
- [ ] e2e: change Format on a new Competition with no result (Placement → Bracket → Head-to-head), and each Format's settings and run area appear.
- [ ] e2e: a Host edits their Competition's settings, sees Hosts read-only, and the page holds no email but their own.
- [ ] Postgres tests on the per-field save, each row of the lock table: the change is refused with the reason once its lock applies, and accepted before. Name, description, Group, Hosts and Placement Points are accepted while Finalized.
- [ ] Postgres tests: a Host is refused changing Hosts; a Host of another Competition is refused any field; a Participant is refused any field; a Format change applies the new Format's defaults and keeps 4 Placement Points for a Bracket.
- [ ] Test: each old route answers 308 to the new page (smoke over HTTP).
- [ ] No test or code refers to `HAS_RESULTS_ERROR` or a `force` option on the Bracket mutations.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r18`): claimed with Epic R18; `ready-for-agent` → `in-progress`. Execution record: [`R18-execution.md`](../epics/R18-execution.md).

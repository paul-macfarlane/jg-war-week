# Execution record — Epic R3: The `games` Format and self-enrollment

Contract: [`R3-games-and-self-enrollment.md`](./R3-games-and-self-enrollment.md)
and its tickets [`17`](../issues/17-competition-types-and-activity-records.md)
and [`15`](../issues/15-participant-self-enrollment.md); the decisions in
[`../grilling-2026-09-28.md`](../grilling-2026-09-28.md) (Q1–Q26, Q32–Q38)
and [ADR 0006](../../../docs/adr/0006-participants-write-their-own-play.md).
Branch `feat/regression-r3-games` from `staging` at `5067e46` (R1 merged,
PR #91). `/atlas-implement` work package `regression-r3`.

## Plan

Written by `/atlas-plan` on 2026-09-29 and red-teamed (a schema and access
change; `docs/agents/planning.md`), one revision cycle; the record is at the
end. The contract above is unchanged. This section resolves it into
technical decisions, ordered steps and a criterion-level verification map.
Anything here a ticket doesn't say is a planning decision, not a scope
change.

### Intent

Add a fourth Format, `games`, whose Competitions are decided by Games the
players log themselves (ticket 17), and a per-Competition switch that lets
Participants enroll in fixed-list Competitions (ticket 15). Both are
Participant writes bounded as Self-report is (ADR 0005 → ADR 0006): account
linking by email, never the pick; every check in `can` and again in the
mutation under the Competition's row lock.

### Technical decisions

The choices the tickets leave open, each checked against the grilling
record. None changes the contract.

1. **Close reuses `competition.finalized_at`; generated Points Entries
   reuse `points_entry.generated_by_bracket`.** Closing a `games`
   Competition is the same act as finalizing a Bracket: its placings become
   Placement Points Entries the ledger refuses to edit, and Reopen deletes
   them (`deleteGenerated`, exported from `src/mutations/brackets.ts`).
   Reusing the columns keeps every existing rule: the settings form refuses
   scoring and Placement Points changes while finalized, the ledger marks
   and protects generated rows, a reload never touches them. The names now
   under-describe their meaning; the schema comments say so. Copy becomes
   Format-aware: a Bracket's rows keep the note `From bracket` and the
   refusal "This Points Entry comes from a bracket. Change it there."
   (`scripts/smoke/brackets.ts`, `src/mutations/brackets.test.ts`,
   `src/mutations/races.test.ts` assert them); a `games` row gets `From
   games` and "This Points Entry comes from a Games Competition. Change it
   there." — the refusal picks its wording from the Competition's Format.
   `competitionGuardError` (`src/lib/setup.ts`) likewise says "Reopen the
   Competition first." for a closed `games` Competition. Renaming the
   columns is deferred: `drizzle-kit generate` asks interactively whether a
   column was renamed, which a worker can't answer safely.
2. **Game players reference Teams and Participants directly, never Entrant
   rows.** An open-to-everyone Competition has no Entrant rows. A fixed-list
   `games` Competition still uses `entrant` rows (`seed_position` = order
   added) so ticket 15's enrollment, the Entrants picker and the existing
   uniqueness constraints are shared with Brackets; the log rule checks a
   player against them.
3. **A best-score Game records one player and one score.** Q12 says "each
   Game records a score"; one row per attempt is the simplest log ("Ashley ·
   42 trips"). Head-to-head Games have exactly two players; ranked Games two
   or more, each with a finishing place (ties share the higher place; the
   parser normalizes places to standard competition ranking 1, 1, 3).
4. **Ranking, exactly as the contract says, ties shared.** Head-to-head
   ranks by most wins (Q10); best-score by the counted value (best or
   total) in the configured direction (Q12; an Entrant with no Game is
   listed unranked at the bottom with "—"); ranked by Finish Points total
   (Q13). No further tie-breaks: equal values share the higher rank
   (standard competition ranking), and Close feeds those places to the
   existing `pointsFor` (`src/lib/bracket/points.ts`), so tied places each
   get that place's Placement Points — "the same tie rule as finalizing a
   Bracket" (Q15). Columns per Q20: head-to-head played, W, L, D;
   best-score best or total, played; ranked Finish Points, played, wins.
5. **Two settings screens, one Game form.** Host/Organizer settings for a
   `games` Competition live on a new admin page
   `/admin/setup/competitions/<id>/games` (the twin of `/bracket`): Game
   Type and its settings, Entrants open or fixed (the Entrants picker
   extracted from the Bracket builder), the "Participants can enroll"
   switch with its limit and close time, the logging close time, and
   Close/Reopen behind `ConfirmDialog`. Logging, editing and deleting Games
   happen on the Competition page for everyone who may (the logger, a Host,
   an Organizer) through one `GameForm` in a `ResponsiveSheetDialog`;
   results and refusals toast. No `/admin/games/<id>` results page: the
   Competition page is the results page. The Competitions setup list and
   `/admin/points` link a `games` Competition to its `games` page, never to
   `/admin/brackets/<id>`.
6. **A Competition's Format is `games` from creation, and stays so.**
   `games` is offered on the create form (with a Game Type select that
   appears when it's chosen) and nowhere else: the Bracket builder's Format
   select and `src/lib/bracket/input.ts` exclude it, and
   `setCompetitionFormat` refuses a change to or from `games` ("A Games
   Competition keeps its Format; add a new Competition to run it another
   way."). The existing "no Format change while Entrants exist" rule stands
   and is extended with "or Games". This removes the undefined `games` ↔
   Bracket path (Entrants of the wrong kind, orphaned Heats, a `game_type`
   the CHECK rejects) rather than defining it. Removing beats adding
   (`.scratch/hardening/spec.md`).
7. **Home shortcut (Q22).** A "Log a Game" card on the edition home page
   lists the open `games` Competitions the linked Participant may log in
   right now, each linking to the Competition page with `?log=1`, which
   opens the form. Shown only when non-empty; never for a pick-only You.
8. **What "open" means, and who it binds.** A `games` Competition refuses
   every Game write from everyone, Organizers included, while it is closed
   (`finalized_at` set): reopen, edit, close again (ADR 0006, hardening
   decision 4). While open, a **Host or Organizer** may log, edit or delete
   any Game at any time, including after the logging close time and after
   a Best of is decided: they are the correction path, as with Bracket
   results. A **Participant** may log only while logging is open for them:
   not closed, before `logging_closes_at` (Q5), and, in a Best of, while
   no side has a majority (Q10/Q24: "logging stops"); a Participant may
   edit or delete only a Game they logged, under the same "open for them"
   rule. A logged-at time is never editable.
9. **Access.** `WarWeekAction` gains `games.settings`, `games.entrants`,
   `games.close`, `games.reopen` and `competition.self-enroll`
   (Host/Organizer through `can`'s default branch: the Host of the row's
   current Competition), and the facet-bound writes `games.log`,
   `games.edit`, `games.delete`, `competition.enroll`,
   `competition.withdraw`. Like `bracket.heat-report`, the facet-bound
   writes are checked **before the Organizer shortcut**, and a missing facet
   refuses (`ADMIN_REFUSAL`). The facet carries `runs` (the actor is an
   Organizer or a Host of *this* Competition, `hosts(actor, warWeekId,
   competitionId)`, never `hostsIn`), `closed`, `loggingOpen` (close time
   and Best of), `linked` (the account-linked Participant with their
   `teamId`), the Competition's `scoring`, `entrantsOpen`, its Entrants
   (Team or Participant ids) and, for edit/delete, the Game's
   `loggedByParticipantId` and its current players. `gameLogError` allows
   `runs`, else a linked Participant who is a player in the posted player
   set (or on a Team in it) while logging is open for them; `gameChangeError`
   (edit and delete) allows `runs`, else the Game's logger by
   `loggedByParticipantId === linked.participantId` while logging is open
   for them **and, for an edit, still a player of the edited player set**
   — so a logger can't move a Game onto players they aren't among (red-team
   finding 3). `enrollError` and `withdrawError` bind everyone (a Host adds
   Entrants through the picker). Pure rules live in
   `src/lib/games/log-rule.ts` and `src/lib/games/enroll-rule.ts`, zod- and
   engine-free because `access.ts` reaches the client bundle
   (`heat-report-rule.ts` pattern).
10. **Facts are loaded by ids scoped to the Competition, and re-checked
    under the lock.** `getGameLogFacts(competitionId, gameId | null,
    email, tx)` loads the Game by `(id, competition_id)` (a Game of another
    Competition or War Week is "That Game no longer exists."), the linked
    Participant by the Competition's War Week, and `runs` from the
    `organizer` and `competition_host` tables in the same transaction, so
    the mutation's in-lock re-check (`lockedCompetition` → reload facts →
    rule again) knows the role without trusting the request
    (`MutationContext` carries only `warWeekId` and `actorEmail`). The
    mutation also validates every posted player: a Team or Participant of
    `ctx.warWeekId`, of the scoring's kind (Teams for team scoring,
    Participants for individual), distinct, exactly two for head-to-head,
    one for best-score, two or more for ranked, and, on a fixed list, an
    Entrant. Foreign keys alone would accept another War Week's Participant.
11. **Entrants of a `games` Competition.** `replaceEntrants` is generalized
    (step 0, `src/mutations/brackets.ts`) to accept a `games` Competition:
    no Heats to clear (the `games` branch skips both
    `hasResults(await bracketOf(tx, found))` calls behind `isBracketRun`,
    `src/mutations/brackets.ts:351-353, 395-397`), the same kind and War
    Week checks, an explicit refusal of `kind: "squad"` (Q14; don't rely on
    `createSquad` refusing non-Brackets), exactly two Entrants while Best of
    is on (so the Host can't save a third after `setGamesSettings`), and a
    refusal when a removed Entrant has Games ("<name> has logged Games.
    Delete them first."), found by comparing the removed Team or
    Participant ids against `game_player` (Games never reference
    `entrant.id`). The `games` page uses it through `games.entrants`. Settings
    rules (`setGamesSettings`): Best of requires a fixed list and exactly
    two Entrants, and refuses the enroll switch; the UI default is open for
    a new Competition and fixed once Best of is chosen (Q25). Deleting a
    Team or Participant with Games is refused with the count
    (`inUseError`, like Entrants); changing scoring while Games exist is
    refused (`competitionRefusal` counts Games too); the FK cascades are
    only the safety net behind `--reset`.
12. **Enrollment closes at the first of** (Q33): the Bracket has Heats
    ("built"), `entrant_limit` reached, `enroll_closes_at` passed, the
    Competition finalized/closed, or (for `games`) any Game exists. The
    switch (`competition.self-enroll`) is refused on a Best of and on an
    open-to-everyone `games` Competition (nothing to enroll in). Enroll
    adds an `entrant` row for the Participant (individual) or their Team
    (team scoring; any Participant on the Team, a Leader is only a label,
    Q34); Withdraw removes it. In a team Competition that has at least one
    Squad (a "Squads Bracket"), Participants join or leave a Squad the Host
    created instead: join runs `squadError` (their own Team's Squad, at
    most 16, one Squad per Competition) and inserts a `squad_participant`
    row; leave deletes it, and the last member of a Squad can't leave
    ("Ask the Host to remove the Squad."). Join and leave refuse on a
    finalized Competition, as `lockedForSquads` does (the "closed" close
    condition). Team enrollment is refused once
    a Squad exists, so an enrolled Team can never block the Host's Squads.
    `enroll` counts Entrants and checks the limit under the same
    Competition row lock `replaceEntrants` and `generateBracket` take, so
    a limit can't be exceeded by two enrollments at once. After enrollment
    closes, only the Host or an Organizer removes an Entrant (Q35).
13. **Migrations.** Two, generated in order: `0015` adds `games` to
    `competition_format` and creates the `game_type` enum; `0016` adds the
    columns, tables and checks. drizzle's migrator runs every pending
    migration in **one transaction**
    (`drizzle-orm/pg-core/dialect.js`, `session.transaction`), so nothing in
    `0016` may use the literal `'games'` as an enum value (default, cast or
    CHECK): the CHECK is written on the text form,
    `(game_type is not null) = (format::text = 'games')`, which the
    red-team reviewer verified succeeds in the same transaction on Postgres
    17 while the enum-literal form fails with "unsafe use of new value".
    Step 0's checkpoint runs `pnpm db:migrate` from a database at `0014`
    before `pnpm test`. CI's drift check proves `pnpm db:generate` adds
    nothing afterwards.
14. **Demo seed.** Three XI Competitions become `games`, one per Game Type,
    chosen because no test depends on their Format: **Bouncy Pong**
    (`head-to-head`, individual, counts toward Team, open to everyone,
    draws off, Placement Points 3/2/1), **Tuesday Stairs** (`best-score`,
    team, count total, higher is better, unit "trips", open) and **Electric
    City Matrix** (`ranked`, team, open, default Finish Points). Their
    seeded Points Entries stay (hand-entered rows coexist with generated
    ones). The smoke Host fixture (`scripts/smoke/hosts.ts`,
    `HOST_COMPETITION`) moves from Tuesday Stairs to **AI Survey
    Completion**, which stays `points` (team scoring; the points-entries
    smoke also uses it and cleans up). Games aren't seeded (like Squads and
    reporters); the e2e and smoke flows log them. `competitionSeedSchema`
    (`src/lib/setup.ts`, shared with the create form) refines: `gameType`
    exactly when `format` is `games`, and `gameConfig`/`entrantsOpen` only
    then, so a bad seed is a zod error, never the database CHECK.
15. **Archive.** A complete War Week's Competition page already renders
    (`/[edition]/competitions/[id]` isn't gated by `isArchived`), so a past
    `games` Competition shows its leaderboard and log with no new page. The
    Log button follows `can` alone (a closed Competition has none); a War
    Week's lifecycle is not a rule, exactly as for Self-report, so UI and
    `can` never disagree. Consequence, stated in CONTEXT.md's "Games rules":
    a `games` Competition left open when its War Week ends still takes
    Games until the Host closes it. `ArchiveDetailView` gains a "Competitions" link so
    the log is reachable from the Archive card. Smoke proves the rendering
    on an ended XI (17-5).
16. **MCP.** One new read-only tool, `get_games` (`src/mcp/games.ts`),
    modeled on `get_bracket`: a Competition by name → Game Type, settings
    summary, leaderboard rows and Games newest first, all by name; never an
    email, who logged, the Organizer list or Hosts. The route branches on
    the found Competition's Format before calling `getBracket`, so
    `get_bracket` on a `games` Competition answers `bracket: null` with
    "run as Games; call get_games" (and `get_games` on a Bracket answers
    `games: null` symmetrically). Listed in `MCP_TOOLS` (so `/llms.txt`
    picks it up), the README tool list and the guide.
17. **No email reaches a page.** `getGamesView` selects explicit columns
    (never `game.logged_by_email`), and computes `canEdit`/`canDelete` per
    Game on the server; `games-view.tsx` is a client component and gets
    names, ids and those booleans only. The smoke asserts no `@` in the
    Competition page HTML and in `get_games`' JSON.
18. **Ending a War Week with an open `games` Competition** is not warned
    about (the unfinalized-Bracket warning stays Bracket-only). Out of
    scope; recorded under Exclusions as a follow-up candidate.

### Schema

`src/db/schema.ts`, with `src/lib/enums.ts` gaining
`COMPETITION_FORMATS = [..., "games"]` and
`GAME_TYPES = ["head-to-head", "best-score", "ranked"]`.

`competition` gains:

| Column | Type | Rule |
|---|---|---|
| `game_type` | `game_type` enum, null | non-null iff `format = 'games'`: CHECK `competition_game_type_iff_games` as `(game_type is not null) = (format::text = 'games')` (decision 13) |
| `game_config` | jsonb, null | `GamesConfig` for the Game Type (`src/lib/games/config.ts`); null = the type's default |
| `entrants_open` | boolean not null default false | `games` only: true = open to everyone eligible; false = fixed Entrant list. Best of forces false (zod + mutation) |
| `logging_closes_at` | timestamptz, null | `games` only: Participants' logging refused after it; awards nothing (Q5) |
| `self_enroll` | boolean not null default false | ticket 15's switch |
| `entrant_limit` | integer, null | CHECK `entrant_limit is null or entrant_limit > 1` |
| `enroll_closes_at` | timestamptz, null | enrollment closes after it |

`finalized_at` and `points_entry.generated_by_bracket` keep their names
(decision 1) with updated comments. `lockedCompetition` selects the new
columns (step 0) so every `games` and enrollment mutation reads them under
the lock; `getBracket`'s `BracketCompetition` returns `selfEnroll`,
`entrantLimit` and `enrollClosesAt` for the builder and the Enroll button.

New tables:

- `game`: `id` uuid pk, `competition_id` → competition (cascade),
  `logged_at` timestamptz not null default now() (log order; Games have no
  scheduled time, Q26), `logged_by_email` varchar(254) not null (audit,
  never read back to a page or MCP), `logged_by_participant_id` →
  participant (set null; null for a Host/Organizer log), `created_at`,
  `updated_at`. Index on `competition_id`.
- `game_player`: `id` uuid pk, `game_id` → game (cascade), `team_id` → team
  (cascade) | `participant_id` → participant (cascade), exactly one
  (CHECK `num_nonnulls(team_id, participant_id) = 1`), `place` integer null
  (CHECK `place is null or place >= 1`; head-to-head 1/2, or 1/1 for a
  draw; ranked 1-based with ties; null for best-score), `score`
  numeric(10, 2) null (best-score only). Unique `(game_id, team_id)`,
  `(game_id, participant_id)`; indexes on `team_id`, `participant_id`.

### Repository areas, interfaces, domain concepts

| Area | Files (new or changed) |
|---|---|
| Enums, schema, migrations | `src/lib/enums.ts`, `src/db/schema.ts`, `drizzle/0015_*.sql`, `drizzle/0016_*.sql`, `drizzle/meta/*` |
| Format sweep (a fourth Format must never be treated as a Bracket) | `src/lib/bracket/types.ts` (`BracketFormat = Exclude<Format, "points" \| "games">`), `src/lib/bracket/view.ts` (`isBracketFormat` false for `games`; `formatLabel` "Games"), `src/lib/bracket/input.ts` (Format select excludes `games`), `src/mutations/brackets.ts` (`bracketRefusal`/`isBracketRun` via `isBracketFormat`; `setCompetitionFormat` refuses `games` either way and any change while Games exist; `replaceEntrants` accepts `games` per decision 11; `lockedCompetition` new columns; export `deleteGenerated`), `src/queries/brackets.ts` (`getBracket` undefined for `games`; `getBracketCompetitions` Bracket Formats only; new fields), `src/queries/schedule.ts` (`getTimedHeats`: Bracket Formats only; harmless today, kept exact), `src/queries/unfinalized-brackets.ts`, `src/mcp/bracket.ts`, `src/app/api/mcp/route.ts` (branch on Format), `src/app/[edition]/finale/[competition]/bracket-finale.ts`, `src/app/admin/brackets/[id]/page.tsx` ("run as Games" + link), `src/app/admin/points/page.tsx` (`games` Competitions listed under "Games", linked to their `games` page), `src/app/admin/standings/page.tsx` (Bracket Finales only), `src/components/bracket-builder.tsx` (Format select), `src/components/competitions-editor.tsx` (Format select with "Games" + Game Type select on create, description, post-create redirect, per-Format setup link), `src/lib/setup.ts` (`competitionSeedSchema` refines; create form accepts `games` + Game Type; `competitionGuardError` wording), `src/mutations/setup.ts` (`createCompetition` sets `gameType`/default config; delete and scoring refusals count Games), `scripts/smoke/hosts.ts` (fixture Competition) |
| Pure `games` domain | new `src/lib/games/config.ts` (types, zod, defaults, labels), `leaderboard.ts` (ranking per Game Type, `placingsOf`, `bestOfWinner`), `input.ts` (`parseGameInput` per Game Type, `parseGamesSettingsInput`), `log-rule.ts` (`GameLogFacet`, `gameLogError`, `gameChangeError`), `enroll-rule.ts` (`EnrollFacet`, `enrollError`, `withdrawError`), `view.ts` (column labels, "W–L–D", "Mine" filter), each with a `.test.ts` |
| Access | `src/lib/access.ts` (actions + facets on `AccessTarget`), `src/auth/authorize.ts` (`authorizeGameWrite`, `authorizeEnroll`), `src/lib/access.test.ts` |
| Data | new `src/queries/games.ts` (`getGamesView`, `getGameLogFacts`, `getLoggableCompetitions`), `src/queries/enrollment.ts` (`getEnrollFacts`), `src/mutations/games.ts` (`setGamesSettings`, `logGame`, `updateGame`, `deleteGame`, `closeGames`, `reopenGames`), `src/mutations/enrollment.ts` (`setSelfEnroll`, `enroll`, `withdraw`, `joinSquad`, `leaveSquad`), `src/actions/games.ts`, `src/actions/enrollment.ts`, tests beside each; `src/mutations/points-entries.ts` + `src/lib/points-entry.ts` + `src/app/admin/points/page.tsx` (Format-aware generated copy) |
| Seed | `src/seed/load.ts` (`gameType`, `gameConfig`, `entrantsOpen` insert-only like `format`), `seeds/xi.json`, `src/seed/load.test.ts`, `src/seed/seeds.test.ts` |
| UI: setup | new `src/app/admin/setup/competitions/[id]/games/page.tsx`, new `src/components/games-builder.tsx`, new `src/components/entrants-picker.tsx` (extracted from `bracket-builder.tsx`, which then uses it), `src/components/bracket-builder.tsx` ("Participants can enroll" switch, limit, close time; Squad help text), `src/app/admin/setup/competitions/page.tsx` (per-Format link) |
| UI: Competition page and home | new `src/components/games-view.tsx` (leaderboard, log with Mine filter, Log/Edit/Delete, "Best of decided — Close it" prompt for `runs`), new `src/components/game-form.tsx`, new `src/components/enroll-button.tsx` (Enroll/Withdraw; Squad join/leave), `src/app/[edition]/competitions/[id]/page.tsx`, `src/components/competitions.tsx` (`CompetitionFacts` badge "Games · Head-to-head"), `src/app/[edition]/(home)/page.tsx` + new `src/components/log-a-game.tsx`, `src/components/archive.tsx` |
| MCP | new `src/mcp/games.ts` + test, `src/mcp/tools.ts`, `src/app/api/mcp/route.ts`, `README.md`, `src/mcp/llms-txt.ts` (`/admin` line) |
| Proof | new `e2e/games.spec.ts`, new `e2e/enrollment.spec.ts`, `e2e/bracket-squads.spec.ts` (help-text assertion), new `scripts/smoke/games.ts` (+ `scripts/smoke/index.ts`), `scripts/smoke/mcp.ts` |
| Docs and showcase | `CONTEXT.md` (glossary: Entrant, Self-enrollment, Log a Game, Close; new "Games rules" and "Enrollment rules" sections; Access rules list the ADR 0006 writes; Seed rules: Games aren't seeded), `docs/adr/0006-*.md` (Status: accepted), `docs/adr/0002-*.md` (role table), `docs/maintainers-guide.md` (recipe "Run a Competition as Games", enrollment paragraph, MCP tool list, "Format is fixed at create for Games"), `src/lib/about.ts` + `src/app/about/page.tsx` (a "Games" feature card; enrollment sentence on the Brackets card), `scripts/about-media.ts` (a `games` still from a logged Bouncy Pong), `public/about/games.png` |

Domain vocabulary (CONTEXT.md already defines **Format**, **Game**, **Game
Type**, **Finish Points**). This plan adds, for CONTEXT.md's glossary and
the UI copy: **Log a Game** (the Participant write), **Close** / **Reopen**
(a `games` Competition's Finalize / Un-finalize; the tickets' words),
**Entrants open** vs a **fixed Entrant list**, **Enroll** / **Withdraw**
(ticket 15's Participant writes; "enter" in prose), and the **Squad** help
line "a pair or group from one Team, playing as one entrant" (Q38).
**Entrant**'s definition widens to "entered in a Bracket or a fixed-list
`games` Competition". No banned term is introduced: "Match" stays banned (a
Game is a Game) and "Member" never appears (say "a player of the Game", "on
the Entrant list"; `src/app/about/page.test.tsx` rejects `/member/`).

### Ordered implementation steps

Dependencies flow downward; steps at the same level are independent and
own disjoint files (collisions are named). `/atlas-implement` chooses the
delegation; this is the order it must respect.

**Step 0 — Foundation (serial, one worker or the orchestrator).**
Enums, schema, the two migrations (decision 13), seed loader
(insert-only columns), `competitionSeedSchema` refines and the create form's
Game Type, `src/lib/games/config.ts`, the Format sweep (every site in the
table above), `createCompetition` with a Game Type, `replaceEntrants` for
`games`, `lockedCompetition`/`getBracket` new fields, exported
`deleteGenerated`, delete/scoring refusals that count Games, the smoke Host
fixture move. Checkpoint, in order: `pnpm db:migrate` on the local database
at `0014` (proves the one-transaction migration), `pnpm db:generate` adds
nothing, `pnpm typecheck && pnpm lint && pnpm test` green with the three
seed conversions. Owns `src/db/schema.ts`, `src/lib/enums.ts`,
`src/lib/setup.ts`, `src/seed/*`, `seeds/xi.json`, `src/mutations/setup.ts`,
`src/mutations/brackets.ts`, `src/queries/brackets.ts`,
`src/queries/schedule.ts`, `src/lib/bracket/*`, `src/mcp/bracket.ts`, the
admin points/standings/brackets pages' Format branches.

**Step 1 — Pure rules (parallel, after 0).**
- 1a `src/lib/games/leaderboard.ts`, `input.ts`, `view.ts` + tests (AC
  17-1).
- 1b `src/lib/games/log-rule.ts`, `enroll-rule.ts` + tests; `access.ts`
  actions and facets + `access.test.ts` (AC 17-2 pure half, 15-1 pure
  half). Owns `src/lib/access.ts`.

**Step 2 — Data and actions (after 1; 2b after 2a, or parallel with
`src/auth/authorize.ts` merged mechanically).**
- 2a Games: `queries/games.ts`, `mutations/games.ts`, `actions/games.ts`,
  `auth/authorize.ts` (`authorizeGameWrite`), DB tests for log/edit/delete
  under the lock including the in-lock re-check (log after Close; edit that
  moves a Game off its logger refused; a Game id of another Competition;
  a player of another War Week; a Participant after the close time; a Host
  after the close time allowed), Close/Reopen → Points Entries → Standings
  (AC 17-3), Format-aware generated copy in the ledger.
- 2b Enrollment: `queries/enrollment.ts`, `mutations/enrollment.ts`,
  `actions/enrollment.ts`, `auth/authorize.ts` (`authorizeEnroll`), DB tests
  per close condition, limit under the lock, Team and Squad cases.

**Step 3 — UI (parallel, after 2).**
- 3a Setup: `entrants-picker.tsx` extraction, `games-builder.tsx`, the
  `games` setup page, `competitions-editor.tsx`, `bracket-builder.tsx`
  (enroll switch, Squad help text), the Competitions setup list link. Owns
  both builders and the editor.
- 3b Participant surfaces: `games-view.tsx`, `game-form.tsx`,
  `enroll-button.tsx`, the Competition page, `competitions.tsx` badge, home
  "Log a Game", `archive.tsx` link. Owns `src/app/[edition]/**`.
- 3c MCP `get_games`, `tools.ts`, route, README, `llms-txt.ts`.

**Step 4 — Proof and showcase (after 3, serial on the integrated branch).**
`e2e/games.spec.ts`, `e2e/enrollment.spec.ts`, the Squad help-text
assertion, `scripts/smoke/games.ts`, `scripts/smoke/mcp.ts` (get_games),
CONTEXT.md, ADRs 0006 (accepted) and 0002, the guide, `/about` copy and the
`games` still, `pnpm gate`, ticket closeouts, PR.

### Declared scope

In scope: everything in the two tickets' Scope sections and the areas
above. Explicit exclusions (the tickets' "Out" lists, plus decisions here):

- Squads in `games` Competitions; times and places on Games; streaks and
  records; opponent confirmations (ticket 17).
- Participants creating Squads (Q34); self-enrollment in Best of X (Q33).
- Changing an existing Competition's Format to or from `games`
  (decision 6).
- An End-War-Week warning for open `games` Competitions (decision 18;
  follow-up candidate).
- Renaming `finalized_at` / `generated_by_bracket` (decision 1; follow-up
  candidate).
- Seeding Games or Entrants in seed files (decision 14).
- A `games` Finale (`/finale/<competitionId>` stays Bracket-only).
- Editing a Game's logged-at time; Games in Now/Next or the schedule.

### Acceptance criteria and DoD coverage

Every ticket and epic criterion maps to a row in the verification map
below (ids `17-n`, `15-n`, `E-n`). The team rule (showcase current:
`/about` + `docs/maintainers-guide.md` in the same PR) is `17-7` and `15-5`.

### Verification map

Run surface: **local + deployed** per `docs/agents/testing.md`, but this
epic has no deploy step; deployed coverage is CI on the PR (`E-3`). Real
dependency for every DB-backed check: local Postgres via
`docker compose up -d` (`localhost:2345`), up on this machine on
2026-09-29 (`pg_isready`). Evidence root `test-results/`, committed on the
branch; R3's evidence lives in `test-results/e2e/games-*/`,
`test-results/e2e/enrollment-*/`, `test-results/e2e/bracket-squads-*/`,
`test-results/e2e/regression-r3-about/` and `test-results/r3-gate/gate.txt`.
Clear the root before capturing (R1's note: the local permission guard
refused deleting earlier epics' committed evidence; if it refuses again,
keep R3's directories R3-named and say so). Every `PASS` cites a committed
path or a command's exit code; `BLOCKED`, `SKIPPED` and worker self-report
are never `PASS`.

| Id | Criterion | Run surface / command | Real dependency | Expected | Evidence | Earliest checkpoint | Invalidated by |
|---|---|---|---|---|---|---|---|
| 17-1 | Leaderboard ranking unit-tested per Game Type: head-to-head wins with draws; best-score best and total, both directions; ranked Finish Points with ties sharing the higher finish; Best of detects the decided moment | `pnpm test src/lib/games` | none (pure) | tests for each named case pass; equal values share a rank | vitest output in `gate.txt`; `src/lib/games/leaderboard.test.ts` | after step 1a | any change under `src/lib/games/` |
| 17-2 | Access per ADR 0006: linked player in the Game can log; the pick grants nothing; a non-player is refused; the logger edits/deletes their own Game until close; another player can't; Host and Organizer can; a closed Competition refuses everyone | pure: `pnpm test src/lib/games/log-rule.test.ts src/lib/access.test.ts`; DB: `pnpm test src/mutations/games.test.ts` (`inRolledBackTransaction`) | local Postgres for the mutation half | one pure test per clause, including an Organizer refused on a closed Competition, a caller with no facet refused, and an edit that moves a Game off its logger refused; mutation tests for the in-lock re-check, a Game id of another Competition, a player of another War Week, and the close-time rule for a Participant vs a Host | vitest output; the three test files | after steps 1b, 2a | `access.ts`, `log-rule.ts`, `mutations/games.ts`, `queries/games.ts` |
| 17-3 | Close awards Placement Points from the leaderboard as Points Entries and the Standings change; Reopen withdraws them | `pnpm test src/mutations/games.test.ts` | local Postgres | after `closeGames`: generated rows equal `pointsFor(placingsOf(leaderboard))` (a tie proves shared points) and `getStandings` totals move; after `reopenGames`: generated rows gone, hand-entered rows untouched, totals back | vitest output; `src/mutations/games.test.ts` | after step 2a | `mutations/games.ts`, `leaderboard.ts`, `bracket/points.ts`, schema |
| 17-4 | Playwright: a Participant logs a head-to-head Game from the home shortcut; the leaderboard updates; the Host edits it; closes the Competition; the Standings move | `pnpm e2e e2e/games.spec.ts` (needs `pnpm build`) | local Postgres, production build on :3200 | Bouncy Pong: Participant (linked by `setParticipantEmail`, restored after) sees "Log a Game" on `/xi`, logs a win; `/xi/competitions/<id>` leaderboard shows 1–0; Host (given a `competition_host` row) edits the winner on the Competition page; closes from the `games` setup page; `/xi/leaderboard` individual and Team totals include the Placement Points; screenshots at 375 and 1280 | `test-results/e2e/games-*/` | after step 4 | any `games` UI, mutation or seed change |
| 17-5 | Smoke covers the seeded `games` Competitions' pages and one Game logged over HTTP | `pnpm smoke` (`scripts/smoke/games.ts`) | local Postgres, build | GET each of the three Competition pages answers 200 with its Game Type label, an empty log and no `@` in the HTML; `logGame` via `callAction` as the smoke Participant (`smoke-participant@jahnelgroup.com`, its email set on a seeded Participant and restored in `finally`) succeeds and the page shows it; the same call before the email is set is refused with "Your sign-in doesn't match a Participant of this War Week." (the ADR refusal, not the sign-in one); XI ended by SQL in its own sequential step (never alongside `assertWarWeekLifecycle`; precedent `scripts/smoke/lifecycle.ts:29-33`) and restored in `finally` to `status = 'live', winner = null`: the page still renders the leaderboard and log (17-A); the smoke deletes its Game in `finally` | smoke output in `gate.txt` | after step 4 | any `games` page, action or seed change |
| 17-6 | Schema change and demo seed updated together; plan red-teamed | `pnpm db:migrate` from `0014`, `pnpm db:generate` (drift), `pnpm seed:load --reset seeds/*.json` twice via `pnpm smoke`; CI drift check | local Postgres | migrations apply in one transaction; generate adds nothing; seeds load twice; this plan's red-team record | `gate.txt`; PR checks; this file | after step 0 | schema, migrations, seeds |
| 17-7 | `/about`, `docs/maintainers-guide.md` and CONTEXT.md rule sections updated; ADR 0006 accepted | `pnpm test src/lib/about.test.ts src/app/about`; Playwright screenshot of `/about` scrolled to the Games card (added to `e2e/games.spec.ts`); orchestrator diff review of the guide and CONTEXT.md | none | a Games card with `public/about/games.png`; a Games recipe; "Games rules" and "Enrollment rules"; ADR 0006 `Status: accepted` | `test-results/e2e/regression-r3-about/about-games.png`; vitest output; the diff | after step 4 | docs/about edits |
| 17-8 | `pnpm gate` passes | `pnpm gate` on the integrated branch | local Postgres, Chromium | exit 0 | `test-results/r3-gate/gate.txt` | after step 4 | any change |
| 17-M | MCP: `games` Competitions readable without emails | `pnpm test src/mcp/games.test.ts`; smoke `get_games` and `get_bracket` on Bouncy Pong (`scripts/smoke/mcp.ts`) with `MCP_TOKEN` | local Postgres, build | `get_games` has leaderboard and Games by name and no `@` anywhere in its JSON; `get_bracket` answers `bracket: null`, "run as Games" | vitest + smoke output | after step 3c | `mcp/games.ts`, route |
| 17-A | Archive shows a past `games` Competition's leaderboard and log | 17-5's ended-XI fetch; `e2e/archive.spec.ts` unchanged | as 17-5 | page renders, no Log button once closed | smoke output | after step 4 | Competition page |
| 15-1 | Access per ADR 0006: switch off refuses; linking required (pick grants nothing); each close condition refuses (built, limit, close time, closed, first Game); team and Squad cases; withdraw before and after close | `pnpm test src/lib/games/enroll-rule.test.ts src/lib/access.test.ts src/mutations/enrollment.test.ts` | pure + local Postgres | one test per clause; the limit test enrolls two under the lock; the Squad tests cover join (own Team only, `squadError`), leave, and the last member refused | vitest output; the test files | after steps 1b, 2b | `enroll-rule.ts`, `access.ts`, `mutations/enrollment.ts` |
| 15-2 | Playwright: a Participant enrolls in a Bracket, withdraws, re-enrolls; the Host builds the Bracket; enrollment is refused afterwards | `pnpm e2e e2e/enrollment.spec.ts` | local Postgres, build | **Pool** (individual, counts toward Team, no e2e or smoke flow touches it; `bracket.spec.ts` finalizes Beyblades earlier in the run, so Beyblades is unusable) set to single elimination by SQL, switch on: Enroll → row in `entrant`; Withdraw → gone; Enroll → back; a second Entrant added by SQL (Generate needs two; never through the Host's picker, which would replace the enrolled one); Host generates; page shows "Enrollment closed" and the action is refused; screenshots at 375 and 1280; Pool's Format, Entrants and Heats restored in `finally` | `test-results/e2e/enrollment-*/` | after step 4 | enrollment UI/mutations, Bracket builder |
| 15-3 | Squad help text shows in setup and on the Competition page | `pnpm e2e e2e/bracket-squads.spec.ts` (assertion + screenshot added) | as 15-2 | "a pair or group from one Team, playing as one entrant" visible in the builder's Squads section and beside the Competition page's Squad Entrants | `test-results/e2e/bracket-squads-*/` | after step 3 | builder, Competition page |
| 15-4 | Schema change and demo seed updated together; plan red-teamed | as 17-6 (the same migration) | as 17-6 | as 17-6 | as 17-6 | after step 0 | as 17-6 |
| 15-5 | `/about` and `docs/maintainers-guide.md` updated | as 17-7 (the Brackets card's enrollment sentence is in the same screenshot run) | none | enrollment sentence on the Brackets card; guide paragraph | `test-results/e2e/regression-r3-about/`; the diff | after step 4 | docs edits |
| 15-6 | `pnpm gate` passes | as 17-8 | | | | | |
| E-1 | ADR 0006 set to accepted | diff review | none | `- Status: accepted (built in …R3…)` | the diff (part of 17-7) | after step 4 | — |
| E-2 | Each ticket file records its closeout and is `done` in this branch | tracker files | none | `[CLOSEOUT]` in 17 and 15, `Status: done`, in the branch's final commit | `.scratch/regression-2026-09/issues/17-*.md`, `15-*.md` | closeout | — |
| E-3 | CI on the PR runs smoke and e2e and passes | `gh pr checks <pr>` | GitHub Actions, Postgres service | all checks green (lint, format, typecheck, migrate on a fresh DB, drift, test, build, smoke, e2e) | PR checks URL in the closeout | after PR | any push |
| E-4 | `pnpm gate` passes locally | as 17-8 | | | | | |

Real integration seams and their real-dependency criterion: Postgres
(17-2, 17-3, 15-1 mutation tests; 17-5 smoke; 17-6 migrations), the
production build over HTTP (17-4, 17-5, 15-2), MCP over HTTP (17-M),
GitHub Actions (E-3). No Slack, no Vercel, no Google in this epic.

Fixtures: XI's Participants have no emails except Paul's; flows link a
stub JG session by `setParticipantEmail` (e2e) or the same SQL (smoke) and
restore it. e2e users are `e2e-%` and cleaned by `global-teardown`; smoke
users and Hosts by the harness's `finally`. Every Game, Entrant and Format
change the flows make lives in XI, which every run reloads with `--reset`;
each flow also undoes its own rows in `finally` so a partial run can't
leave a logged Game or a re-Formatted Competition behind.

Human gates: none. E-3 is an automated post-PR check the orchestrator reads
back; the human review is the PR itself.

Candidate evidence recorded during planning: the red-team reviewer ran, in
the local `war-weeker-postgres` container's `postgres` database with
throwaway enum types (rolled back, types dropped): (a) `ALTER TYPE … ADD
VALUE 'games'` followed in the same transaction by a CHECK using the enum
literal → "unsafe use of new value"; (b) the same with
`(format::text = 'games')` → succeeds. Environment: Postgres 17,
2026-09-29. Reusable for decision 13's CHECK form only; invalidated by a
change to the CHECK expression or a drizzle-orm upgrade that changes the
migrator's transaction handling. No other check was exercised.

### Considerations required by `planning.md`

- **Drizzle schema change** (confirmed team policy): red-teamed below; the
  demo seed and both migrations ship in step 0 together; smoke on the
  seeded local Postgres is 17-5/17-6.
- **Auth or access-control change** (confirmed team policy): red-teamed;
  Google-only sign-in and the `@jahnelgroup.com` rejection are untouched
  (`isJahnelGroupEmail`, better-auth hooks, `src/proxy.ts` unchanged);
  every new Participant write re-checks the JG email as
  `bracket.heat-report` does.
- **Finale**: untouched.
- **Vertical-slice gate**: typecheck, lint, vitest, build, smoke, e2e
  (`pnpm gate`) per step; on failure stop and report.
- **MCP tool change**: `/api/mcp` stays read-only; `get_games` returns no
  email, no logger, no Host, no Organizer; the smoke asserts no `@` in its
  JSON (17-M).
- **Stairs app** (unresolved): nothing here depends on it; Tuesday Stairs
  becomes a best-score demo only.
- **Tooling**: `context7` is recommended for Drizzle (enum value
  migration, jsonb `$type`), Base UI `Switch`/`Tabs` and Next 16 route
  handlers; workers consult it or the primary docs and record the version.

### Red-team review

Reviewer: a fresh `atlas-red-team-reviewer` (2026-09-29), given only the
fixed contract, the draft plan and repository paths; read-only. One
revision cycle. Blocking findings and their dispositions:

| # | Finding | Disposition |
|---|---|---|
| 1 | drizzle's migrator runs all pending migrations in one transaction, so a CHECK with the enum literal `'games'` fails ("unsafe use of new value"); reproduced on Postgres 17 | resolved: decision 13 writes the CHECK on `format::text`; step 0's checkpoint migrates from `0014` first |
| 2 | Changing a Competition's Format to or from `games` was undefined: the builder offers every `COMPETITION_FORMATS` value, `setCompetitionFormat` has no Game Type, and the CHECK would throw a 500 | resolved: decision 6 — Format is `games` from creation only; the builder and `input.ts` exclude it; `setCompetitionFormat` refuses both ways; recorded as an exclusion |
| 3 | A logger's edit could move a Game onto players they aren't among, breaking ADR 0006's bound; "open" was undefined | resolved: decision 8 defines open (closed refuses everyone; close time and Best of stop Participants only), decision 9 makes an edit re-run the player rule on the edited set and identifies the logger by `loggedByParticipantId`; tests in 17-2 |
| 4 | 15-2's fixture (Beyblades) is already finalized by `e2e/bracket.spec.ts`, which runs earlier in the single-worker run | resolved: 15-2 uses Pool, set up by SQL and restored in `finally` |

Non-blocking findings, all resolved in the plan: facts loaded by
`(id, competition_id)` and `runs` scoped to the Competition, re-checked
under the lock with the role loaded in-transaction, players validated
against the War Week, kind, count and Entrant list (decision 10);
`getBracketCompetitions` consumers (`/admin/points`, `/admin/standings`)
and the MCP route's Format branch added to the sweep, `getTimedHeats`'
file corrected, `competitionGuardError` wording (areas table, decision 1);
scoring change refused while Games exist (decision 11); Best of stops
Participants' logging and needs a fixed list of exactly two, `games`
Entrants saved through a generalized `replaceEntrants` with a refusal for
an Entrant who has Games, Q25 UI default, the "Squads Bracket" definition
and join/leave rules, the enroll switch refused when open to everyone
(decisions 11, 12); the invented tie-breaks dropped (decision 4); lifecycle
never a rule, so UI and `can` agree (decision 15); 17-2 gains mutation
tests, 17-5's refusal uses the unlinked JG Participant, no-`@` assertions
on the page and MCP, explicit columns and server-computed booleans
(decision 17, map); collisions in `src/mutations/brackets.ts` and
`src/queries/brackets.ts` moved into step 0, `From bracket` copy kept for
Brackets, step 0 migrates before testing; "member" avoided,
`competitionSeedSchema`'s location and refine corrected, 17-7/15-5 cite
committed evidence. No human decision was needed.

Re-review of the revised plan (same reviewer, 2026-09-29):
**pass** — all four blocking findings resolved as written; the revisions
introduce no new blocking problem. Its packet-level notes are applied
above: `replaceEntrants`' `games` branch skips the Bracket result checks,
refuses Squads explicitly, holds Best of to two Entrants and finds Games
by Team/Participant id (decision 11); Squad join/leave refuse on a
finalized Competition (decision 12); the open-after-War-Week consequence
goes into CONTEXT.md (decision 15); 17-5's ended-XI step runs alone and
restores `live`/`winner = null`; 15-2 adds its second Entrant by SQL.

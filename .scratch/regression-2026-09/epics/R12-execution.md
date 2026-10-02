# Execution record: Epic R12, Participation and Award Categories

Contract: [`R12-competitions-and-awards.md`](./R12-competitions-and-awards.md) and its tickets
[`69`](../issues/69-participation-format.md), [`70`](../issues/70-award-categories.md),
[`71`](../issues/71-award-category-history.md); decisions from [`../grilling-2026-10-01.md`](../grilling-2026-10-01.md) (Q17, Q18, Q25, Q26).
No `/atlas-plan` ran; `/atlas-implement` derived this plan on 2026-10-02 against `staging` at `d3c3b3e` (R11 merged, PR #118).
Red-team is **required** (`docs/agents/planning.md`): new Drizzle tables, columns and an enum value, and a new Participant write (Check in).
Branch: `feat/regression-r12-participation-awards`.

## [EXECUTION PLAN]

2026-10-02. Revised after red-team round 1 (FAIL: 2 blockers, 1 contract reading, 6 should-fix, 8 nits; all folded in below under **Red-team round 1**, which overrides the decisions it names).

### Run record

- Work package `regression-r12`; branch `feat/regression-r12-participation-awards` from `staging` at `d3c3b3e`.
- Deliverables: **D69** Participation Format (worktree `.claude/worktrees/regression-r12/war-weeker/d69`); **D70** Award Categories then **D71** a Category through the years (worktree `.claude/worktrees/regression-r12/war-weeker/d70`, D71 after D70 in the same worktree); **DX** docs (feature branch, after both land).
- Structure: wave. Wave 1: D69 ‖ (D70 → D71). Wave 2: DX. Edges: D70 → D71; D69, D71 → DX.
- Why parallel despite two schema changes: the deliverables touch different tables and screens. Predicted collisions, merged by the orchestrator at integration: `src/db/schema.ts` (different tables), `drizzle/` (both generate migrations: D70/D71's migrations are **regenerated** after D69 lands, by deleting D70's generated SQL and snapshot files and journal entries and rerunning the same `pnpm db:generate` commands; the custom data migration's SQL is copied across unchanged), `src/lib/access.ts` and its test (different actions), `src/seed/schema.ts`, `src/seed/load.ts`, `seeds/demo/*.json` (different keys), `scripts/smoke/index.ts`, `src/mcp/tools.ts`, `src/app/api/mcp/route.ts`, `src/app/llms.txt` or `src/mcp/llms-txt.ts`. `CONTEXT.md`, `docs/*`, `/about` and the organizer guide are DX-only, except ADR 0009, which D69 writes.
- Each worktree uses its **own local database** on the shared Postgres (`postgres://postgres:postgres@localhost:2345/war_weeker_r12_d69` and `…_d70`, `?sslmode=disable`, `DATABASE_DRIVER=pg`; values from `.env.example`), created and migrated by the worker, so the two schemas never meet. Workers run format, typecheck, lint and unit (`pnpm test`). The orchestrator runs build, smoke and e2e on the integrated branch in the main checkout (the shared `war_weeker` database, e2e on port 3200).
- Clear `test-results/` at the start (evidence policy); R12 evidence lives under `test-results/r12/` and the e2e test directories `test-results/e2e/<test>/`.

### Intent

Two things the wikis show War Week has always had and the app can't hold: taking part as a way to score (Black Midnight, workouts, Spirit submissions, HQ attendance), and the Awards that recur every year (War Week MVP, Billable Hours Champ, Black Midnight, the Core Values) with a view of each across the years.

### Resolved decisions: Participation (69)

**P1. Format.** `participation` joins `COMPETITION_FORMATS` (`src/lib/enums.ts`) and the `competition_format` pgEnum (Drizzle generates `ALTER TYPE … ADD VALUE`; every CHECK compares `format::text`, as R3 decision 13 does). Chosen only at create, like `games`: `setCompetitionFormat` refuses changing to or from it (same message shape as `games`). A `participation` Competition is never a Bracket: `BracketFormat` excludes it, `isBracketFormat` returns false for it, the Bracket builder's Format list omits it, `getBracket`/`get_bracket` treat it like `games` (point to its own view), and `/admin/brackets/[id]` points to its setup page as it does for `games`. Every `format === "games"` / `!== "games"` switch in `src/` is reviewed for `participation` (list in the survey: points page, enrollment, setup, brackets mutations and queries, bracket builder, competitions editor, competitions facts, points-entry note, recent results, enroll rule, MCP route).

**P2. Columns on `competition`** (all null/false unless `participation`; one CHECK `competition_participation_columns` on the text form):
- `participation_points numeric(8,2)`: N, the points per Participant who took part (individual, and team "per person"). Default at create: 1.
- `participation_team_scoring` (new pgEnum `participation_team_scoring`: `ranked`, `per-person`): team scoring only, null for individual. Default at create for team scoring: `ranked`.
- `self_check_in boolean not null default false`: the per-Competition switch.
- `check_in_closes_at timestamptz`: optional; after it, Participants can't check in or out.
- Ranked uses the existing `placement_points`; closed is the existing `finalized_at` (as `games`). `max_points` stays as it is.
- Validation (zod in `src/lib/participation/…`, used by the settings form and the seed schema): N > 0 and ≤ the existing points bound; ranked with no Placement Points is allowed but Close then writes no entries (the settings form warns, as Games does with `hasPlacementPoints`).

**P3. Who took part: table `participation`** (`id`, `competition_id` → competition cascade, `participant_id` → participant cascade, `marked_by_email varchar(254) not null` (audit, never read back to a page or MCP, like `game.logged_by_email`), `checked_in boolean not null` (true when the Participant checked themselves in), `created_at`; unique (`competition_id`, `participant_id`); index on `participant_id`). The Participant must belong to the Competition's War Week (checked in the mutation). In team scoring only Participants on a Team can take part ("Only Participants on a {teamLabel} can take part in a team Competition."); in individual scoring anyone on the roster.

**P4. Scoring (pure, `src/lib/participation/score.ts`)**, from the took-part list (each with participant id and team id) and the Competition:
- Individual: one Points Entry of N per Participant (to the Participant; Counts Toward Team as the Competition sets it, unchanged).
- Team, ranked: Teams ranked by headcount, Teams with nobody absent from the ranking; ties share the higher place (standard competition ranking: 3, 3, 1 → places 1, 1, 3), then `pointsFor` (`src/lib/bracket/points.ts`), so ties each get that place's points and places without Placement Points get nothing.
- Team, per person: one Points Entry per Team of N × headcount.
- Notes: `generatedNote("participation")` gives "From participation"; rows are `generated_by_bracket = true` (the column's meaning already covers "generated by the Competition").

**P5. Close and Reopen** mirror `closeGames`/`reopenGames` (`src/mutations/games.ts`): under the Competition row lock, Close refuses when already closed, deletes generated entries, inserts the scored ones and sets `finalized_at`; Reopen deletes generated entries and clears it. Close with nobody marked is allowed (no entries). Close → Reopen → Close yields the same entries (idempotence test). While closed, settings, marks and check-ins are refused for everyone.

**P6. Access.** New War Week actions in `src/lib/access.ts`: `participation.settings`, `participation.mark` (add or remove anyone), `participation.close`, `participation.reopen` → the Host of this Competition (and every Organizer), beside `games.*`. New Participant writes `participation.check-in` and `participation.check-out`, decided **before the Organizer shortcut** by a facet (`target.checkIn`, like `gameLog`/`enroll`; a caller that forgets it is refused): signed in with a JG email; the Competition is `participation`, not closed, `self_check_in` on, `check_in_closes_at` null or in the future; the actor's session email links to a Participant of this War Week (account linking only; ticket 52); in team scoring that Participant has a Team; check-in refused when already in, check-out refused when not in or when the row was marked by someone else (`checked_in = false`: "The Host marked you; ask them to remove it."). Every check runs in `can` and again in the mutation under the row lock. A Host or Organizer checking themselves in uses the same facet (they're Participants too); they mark through `participation.mark`.

**P7. ADR 0009, "Participants check themselves in"**, written by D69: extends ADR 0006 with the fourth Participant write, its bounds (P6), why a Participant can remove only their own check-in, and the considered options (Host-only, as today: rejected for the reason of the ticket; any Participant marks anyone: rejected). ADR 0006 gets a "Later notes" pointer; ADR 0002's role table and CONTEXT.md's Participant sentence are DX's.

**P8. Screens.**
- Create form (`competitions-editor.tsx`): Participation in the Format list with a one-line description; on save it routes to its setup page.
- Admin setup `/admin/competitions/[id]/participation` (Host of it or Organizer; linked from the Competitions list and from `/admin/points` like Games): settings (N; team scoring Ranked by headcount / Per person, using the existing toggle-group choice pattern; Placement Points edit link or field as the Competition form has; Self check-in switch; check-in close time with the existing `DatePicker` + `TimeCombobox`); the roster as a checklist to tick who took part (search by name; team names shown in team scoring), each tick a mark/unmark; team counts in team scoring; Close / Reopen behind `ConfirmDialog`; results as sonner toasts.
- Participant page `/[edition]/competitions/[id]`: "Took part" list (Avatar + Profile name, `YouTag`), team counts in team scoring (Team shows in team events, per the R10 rule), "Check in" / "Check out" for the linked Participant when P6 allows, the close time when set, and "Closed" once closed. The `AutoRefresh` it already has keeps it current.
- Home Recent results (`src/lib/recent-results.ts`): a closed `participation` Competition gives a `participation-closed` row at `finalizedAt` ("N took part" or the top Team).
- `/admin/brackets/[id]` and `/admin/competitions/[id]/bracket` for a `participation` id point to its setup.
- End War Week's open-Competition warning (`src/queries/open-games-competitions.ts`) also names open `participation` Competitions: their points land only on Close.

**P9. Seeds.** Seed Competition schema accepts `format: "participation"` with optional `participationPoints`, `participationTeamScoring`, `selfCheckIn`, `checkInClosesAt` (each refused on another Format, as `gameType` is). Took-part rows aren't seeded (like Games). `seeds/demo/xii.json` gains one team `participation` Competition ("Black Midnight", ranked by headcount, Placement Points 5/3/1, self check-in on). Seeds load twice idempotently.

**P10. MCP.** New read-only tool `get_participation` (`src/mcp/participation.ts`, registered in `src/mcp/tools.ts` and the route, listed in `llms.txt`): a `participation` Competition's settings, closed state, who took part (names only, never emails) and team counts. `get_bracket`/`get_games` on a `participation` id point to it, as `get_bracket` does for `games`.

**P11. Not changed.** Unstart's "nothing scored" rule (marks aren't scores; entries land only on Close). Create next War Week keeps copying Competitions without their Format (unchanged behaviour). `Finale` untouched.

### Resolved decisions: Award Categories (70) and through the years (71)

**A1. Table `award_category`**: `id uuid`, `name varchar(80) not null`, `key varchar(80)` (unique; set only on seeded Categories), `archived_at timestamptz` (null when active), `created_at`, `updated_at`; unique index on `lower(name)` (a rename to an existing name is refused: "There's already a Category named …"). Global: no War Week.

**A2. `award.category_id uuid` → `award_category.id`, `on delete restrict`**, nullable, indexed. Categories are archived, never deleted (no delete action).

**A3. The seven Categories** come from a custom data migration (`pnpm db:generate --custom --name seed-award-categories`): `INSERT … ON CONFLICT DO NOTHING` of War Week MVP (`war-week-mvp`), Billable Hours Champ (`billable-hours-champ`), Black Midnight (`black-midnight`), Grow (`grow`), Grind (`grind`), Serve (`serve`), Inspire (`inspire`). They exist in every environment without a seed load, and a `--reset` seed load (which wipes War Weeks) leaves them.

**A4. Seed format.** An Award seed gains optional `category`, a Category **key** (so an Organizer's rename never breaks a seed). Unknown key → the loader fails naming it. Insert stays insert-if-absent; one addition: an already-loaded seeded Award (same War Week and seed key) with **no** Category gets the seed's Category ("fill if empty"; never overwrites an Organizer's choice). That is how already-loaded history in staging and production gets tagged: rerun the Seed workflow without reset after the migration (DX writes this in the maintainer's guide).

**A5. Name matching** (`src/lib/award-categories.ts`, `categoryKeyForAwardName(name)`, pure, unit-tested): War Week MVP ← "War Week MVP", "MVP", "MVP 1st Place"; Billable Hours Champ ← "Billable Hours Champ", "Billing Hours Champ"; Black Midnight ← "Black Midnight", "Midnight Club …"; Grow/Grind/Serve/Inspire ← exact (case-insensitive, trimmed). Everything else → none ("MVP 2nd Place", "Hours Champ", "Top Billers" stay untagged). The seed files are tagged with it once (`category` keys written into `seeds/*.json`, `seeds/demo/xi.json`), and `src/seed/seeds.test.ts` asserts every seed Award's `category` equals the matcher's answer, so the two can't drift.

**A6. Access.** Global Organizer-only actions `award-category.create`, `award-category.rename`, `award-category.archive` (no target, like `organizers.*`; refusal "Only an Organizer can … Award Categories"). Choosing a Category on an Award stays under `award.create`/`award.edit` (Organizer-only already).

**A7. Admin.** `/admin/awards` gets a Categories section (Organizer-only; Hosts don't see Awards admin today): list with Rename (sheet/dialog via `ResponsiveSheetDialog`, the one admin list pattern) and Archive (behind `ConfirmDialog`), and Add. Archived Categories are listed separately as "Archived". The Award form gains an optional Category select (`OptionSelect`/shadcn select; "None" first) of active Categories, plus the Award's current Category when archived, marked "(archived)". The server refuses picking an archived Category that isn't already the Award's.

**A8. Participant Awards page** (`/[edition]/awards`) groups by Category, Category order by name, uncategorized last under "Other Awards" (no heading when every Award is uncategorized, so past War Weeks without Categories look as today). Each Category heading links to its through-the-years page (71).

**A9. MCP `get_awards`** gains each Award's `category` (name or null). `get_history` unchanged.

**A10. Through the years (71): `/history/awards/[id]`** (the Category's uuid; a name slug would break on rename): heading the Category's name (and "Archived" when it is), then each War Week that has Awards in it, **newest first** (by edition number), the edition label linking to that War Week, each Award's name when it differs from the Category's, and its recipients: Participants with their Profile name where linked (the existing profile join, ADR 0007) else roster name, and the Team for a Team Award. War Weeks of every status are listed (an `upcoming` War Week with an Award in the Category included); nothing about Points. Unknown or malformed id → 404. Reachable from `/history` (a new "Awards through the years" list of every Category with at least one Award) and from each Category heading on any Awards page. Same sign-in rule as `/history` (not public). Screenshots at 390 and 1280 widths under `test-results/e2e/<test>/`.

### Deliverables

| ID | Ticket(s) | Owns | Worker model |
|---|---|---|---|
| D69 | 69 | P1–P11, ADR 0009, unit tests, `e2e/regression-r12-participation.spec.ts`, smoke for the seeded Competition and a check-in over HTTP | opus (schema + access + UI; judgment-dense) |
| D70 | 70 | A1–A9, unit tests, `e2e/regression-r12-award-categories.spec.ts`, smoke for categories | sonnet |
| D71 | 71 | A10, `e2e/regression-r12-award-history.spec.ts` (screenshots), smoke for the route | sonnet |
| DX | epic | CONTEXT.md (**Participation** Format, **Check in**, **Award Category**; Participant sentence; Access rules), ADR 0002 role table and ADR 0006 note, `docs/maintainers-guide.md` (incl. Seed workflow rerun for tagging), `docs/regression-checklist.md` lines, `/about` copy (`src/lib/about.ts`/`about.md`), organizer guide (`src/components/organizer-guide.tsx`) | orchestrator or sonnet |

### Verification map

Run surface: **local** (no deploy in the contract; staging gets it by `migrate.yml` on merge, outside this package). Real dependency: local Postgres (`war-weeker-postgres`, port 2345). No external fixtures. No human gates. Evidence: `test-results/r12/*.txt` (captured output) and `test-results/e2e/<test>/` (screenshots), committed.

| Criterion | Command / action | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|
| 69-AC1 scoring unit tests | `pnpm test src/lib/participation src/mutations/participation` | individual N each; ranked with ties; per person; Close/Reopen/Close same entries; all pass | `test-results/r12/unit-participation.txt` | D69 integrated | D69 code |
| 69-AC2 e2e | `pnpm e2e e2e/regression-r12-participation.spec.ts` | Host creates team Participation (ranked, 5/3/1), two Participants check in, Host ticks a third, Close moves Standings, Reopen withdraws | `test-results/e2e/regression-r12-participation-*/` | D69 integrated (main checkout) | D69 code, seeds |
| 69-AC3 seed + smoke | `pnpm smoke` | demo `participation` Competition loaded; seeds load twice; its page 200 with "Took part"; check-in over HTTP accepted for a linked Participant and refused for an unlinked one | `test-results/r12/smoke.txt` | wave 1 integrated | any code, seeds, migrations |
| 70-AC1 migration, tagging, matcher | `pnpm test src/lib/award-categories src/seed`; `pnpm smoke` (seeds twice); `psql` count of tagged seeded Awards after `pnpm seed:all` twice | matcher tests pass; tags written; second load no change; 7 Categories exist | `test-results/r12/unit-award-categories.txt`, `test-results/r12/award-tagging.txt` | wave 1 integrated | D70 code, seeds, migrations |
| 70-AC2 e2e | `pnpm e2e e2e/regression-r12-award-categories.spec.ts` | Organizer adds Category, gives Award in it, Awards page groups it | `test-results/e2e/regression-r12-award-categories-*/` | wave 1 integrated | D70 code |
| 71-AC1 route | `pnpm e2e e2e/regression-r12-award-history.spec.ts` | War Weeks newest first, Profile names where linked else roster names | e2e output + screenshots | wave 1 integrated | D70/D71 code |
| 71-AC2 screenshots + smoke | same spec at 390 and 1280; `pnpm smoke` route check | screenshots exist; route 200, unknown id 404 | `test-results/e2e/regression-r12-award-history-*/`, `test-results/r12/smoke.txt` | wave 1 integrated | D71 code |
| 69/70/71-AC gate, E-4 | `pnpm format:check && pnpm gate` on the integrated branch; CI on the PR (`gh pr checks`) | all green | `test-results/r12/gate.txt`, PR checks | after DX | any change |
| E-1 ADR, seed+migration together, smoke | ADR 0009 present; migrations and demo seed in the same branch; smoke on seeded local Postgres | present; smoke green | file paths; smoke evidence | after DX | — |
| E-2 docs, about, checklist, MCP | read the diff of `/about` source, guide, checklist, MCP tools; `pnpm test src/mcp` | each updated | file paths; unit output | after DX | DX |
| E-3 closeouts | ticket files `done` with `[CLOSEOUT]` | present | ticket files | closeout | — |
| Team rule: showcase | `/about` and maintainer's guide updated | present | diff | after DX | — |
| Team rule: checklist | `docs/regression-checklist.md` lines for the new pages and flows | present | diff | after DX | — |

### Red-team round 1 (2026-10-02): amendments

Reviewer: fresh `atlas-red-team-reviewer` (opus), read-only. Verdict FAIL → fixed here; the plan is PASS once these hold.

- **B1 → P9.** The demo Competition goes in `seeds/demo/xi.json` (teams mode, live, loaded by smoke and e2e via `localSeedFiles`), not `demo/xii.json` (free-for-all, never loaded by smoke). Name: "Daily Workout Check-in", team scoring, ranked by headcount, Placement Points 5/3/1, self check-in on, no close time.
- **B2 → P2, P3.** The CHECK is exactly: `format::text <> 'participation'` ⇒ `participation_points`, `participation_team_scoring`, `check_in_closes_at` null and `self_check_in` false; `format::text = 'participation'` ⇒ `participation_points` not null and `(scoring = 'team') = (participation_team_scoring is not null)`. `competitionRefusal`/`updateCompetition` refuses a scoring change on a `participation` Competition while anyone is marked ("Remove who took part before changing its scoring.", like Games), and otherwise sets `participation_team_scoring` to `ranked` (to team) or null (to individual) in the same update. The seed loader's upsert sets `participation_team_scoring` the same way from `excluded.scoring` (keeping the stored value when still team). Unit test for the scoring change; seed test for a reload that changes scoring.
- **C1 → 69-AC2.** Read as: an Organizer creates the team Participation Competition and assigns the Host; the Host sets ranked 5/3/1 and self check-in, two Participants check in, the Host ticks a third, Closes (Standings move) and Reopens (withdrawn). `competition.create` stays Organizer-only.
- **S1 → P9, DX.** The four new columns are insert-only in the seed loader (like `format`, `gameType`), except the scoring-driven `participation_team_scoring` rule in B2. DX updates CONTEXT "Seed idempotence rules" for them and for A4's Award exception.
- **S2 → A4, DX.** Fill-if-empty applies only to a seeded Award never edited in the app (`award.updated_at = award.created_at`; the award mutation already bumps `updated_at`), so an Organizer's "None" is kept. DX tells the maintainer to rerun the Seed workflow **once per past-edition file** (`seeds/i.json` … `seeds/xi.json`), never blank and never for the edition being run.
- **S3 → 70-AC1/AC2.** The e2e Category name is unique per run; `e2e/global-setup.ts` (via `e2e/db.ts`) deletes Award Categories with no `key` after the War Week reset. Expectation becomes "the 7 seeded keys exist".
- **S4 → P1, DX.** `participation` is appended last in `COMPETITION_FORMATS`, and the enum value is its **own** generated migration before the columns, tables and CHECK (maintainer's guide rule; R3's 0015/0016 precedent). DX adds "Rolling out R12" to the maintainer's guide: confirm Migrate succeeded before checking the deploy (rerun if the deploy went first), then the per-file Seed reruns.
- **S5 → P1.** Also covered: `enrollmentUnavailable` refuses `participation` ("A Participation Competition takes check-ins, not Entrants."); `generatedRefusal` gets a participation branch; `competitionGuardError` sends a closed Participation Competition to "Reopen the Competition first."; the Bracket input Format type excludes `participation`; the participation lock reads its columns itself (extending `lockedCompetition`'s select is the worker's call, either is fine); a `participation` Competition page shows no Bracket and keeps `AutoRefresh` (asserted in D69's e2e).
- **S6 → P8, P10.** R3 decision 17 pattern: the server computes names, ids and booleans; no `email` or `marked_by_email` in any client prop, action payload or MCP output. Unit test: `get_participation` output contains no `@`.
- **N1.** Screenshots at 1440×900 and 390×844 (the regression checklist's viewports).
- **N2.** Whichever wave-1 deliverable integrates second regenerates its migrations (`pnpm db:generate` for schema; `pnpm db:generate --custom --name …` then paste the SQL for custom ones).
- **N3.** e2e needs `pnpm build` first; tagging counts are taken after `pnpm smoke`'s loads, not `pnpm seed:all`.
- **N4.** Accepted: a Participant whose check-in the Host removed can check in again while check-in is open; the Host turns self check-in off or sets a close time. Documented in CONTEXT by DX.
- **N5.** `deleteCompetition` refuses while anyone is marked ("Remove who took part first."), like Games.
- **N6 → P4.** Team headcounts use each Participant's Team at Close; marks of a Participant with no Team are skipped.
- **N7.** `/about` media unaffected (no new stills); copy only.
- **N8.** Intended: the loader may tag a seeded Award with an archived Category; only the app's picker refuses archived ones.

### Questions queued (non-blocking)

- Q1: Should an archived Award Category be restorable? The ticket says add, rename, archive; the plan ships exactly that (no Restore).
- Q2: The plan tags only "MVP 1st Place" (and "MVP"/"War Week MVP") as War Week MVP; "MVP 2nd/3rd Place" stay untagged. Tag them too?

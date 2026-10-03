# Epic R16: The Competition model

**What to build:** Points come from results. `points` becomes Placement (part 90); Discretionary points replace the Points page (91); Max Points goes (92); Head-to-head and Best score become Formats and ranked Games and Finish Points go (93); Participation follows scoring (94); Placement Points without a limit (95).

**Work package:** this epic is **one work package**: one branch, one migration, one seed conversion, one full gate, one PR. The files `90`–`95` under `../issues/` are its **parts**: each holds the decisions and behaviour checks for one area, with no gate, order or migration of its own. `96` is folded into this file.

**Branch:** `feat/regression-r16-competition-model`

**Blocked by:** none (R15 merged into `staging` 2026-10-03, PR #124).

**Status:** ready-for-agent

**Red-team:** **required** (Drizzle schema change; Hosts record Placements; Discretionary points are Organizer-only). Pass 1 and pass 2 on 2026-10-03, both BLOCKED; resolved below and restructured into one work package.

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## How the work is done

- **Parts are built in any order on the one branch**, delegated as `/atlas-implement` sees fit. Anything that touches `src/db/schema.ts`, `drizzle/` or the seed schema (`src/seed/schema.ts`) is done by **one worker at a time** (shared files: the schema, the Drizzle journal and snapshots).
- **One migration.** `pnpm db:generate` runs **once**, after every part's schema change is in `src/db/schema.ts`, giving a single `drizzle/0028_*.sql`. It is then hand-edited to coerce old rows (below). Never generate a migration per part.
- **Checks while building:** `pnpm typecheck && pnpm lint && pnpm test` with local Postgres up (`docker compose up -d`) and `DATABASE_URL` pointing at it, so Postgres tests run rather than skip. The vitest summary is recorded in the closeout with its skipped count; any skipped Postgres file is a failure. Smoke and e2e run in the full gate at the end; commits before that aren't required to be green.
- **Retired tests are deleted, not skipped.** Each part lists in its closeout the specs it deletes and the ones it rewrites; `docs/agents/testing.md`'s command table is updated to match. A deleted test is replaced by one for the new behaviour where the behaviour still exists.
- **Permissions are server-side.** Every new write goes through `authorize` / `can` (`src/auth/authorize.ts`, `src/lib/access.ts`) with a new action in `WarWeekAction` and a rule in `can`. Each new action has unit tests in `src/lib/access.test.ts` for every role it refuses and an action-level test (Postgres) that calls the server action as that role.
- **ADR:** one new ADR covers Placement writes (Organizers and the Competition's Hosts; Participants never) and Discretionary points (Organizers only, scoped by `war_week_id`), and updates ADR 0002's table.

## The migration

Deployed data is **reset, not converted** (Paul: not a production database with real users yet). The migration changes the schema and coerces just enough that it applies to rows of the old shape; it doesn't preserve Standings. Seed JSON is where data is converted.

Drizzle applies every pending migration in one transaction. Hand-edit the generated SQL so, in order:

1. CHECKs naming changed columns are dropped first (`competition_game_type_iff_games`, `competition_participation_columns` and any other the diff touches) and re-added last.
2. `competition_format` is recreated: drop `competition.format`'s default; create the new type (`placement`, `head-to-head`, `best-score`, plus today's values other than `points` and `games`); `ALTER COLUMN format TYPE … USING` a `CASE` mapping `points` → `placement`, `games` + head-to-head → `head-to-head`, `games` + best-score → `best-score`, `games` + ranked → `placement`; drop the old type; set the default to `placement`. No `ALTER TYPE … ADD VALUE`.
3. A former ranked Competition: its Games, Entrants and generated Points Entries are deleted and `finalized_at` cleared.
4. Per-person Participation rows become ranked before `participation_team_scoring` and its enum are dropped.
5. `points_entry.war_week_id` is added nullable, backfilled from the Competition, then set not null.
6. `max_points` and `game_type` (and its enum) are dropped; Finish Points leave `game_config`.

## Seed conversion

All seed JSON is converted here, after the parts' loader changes.

- **Rule for a `points` Competition:** sum each target's entries; order targets by total; ties share a place and the next place is skipped (1, 1, 3), the rule Brackets and Games use. Write Placements, `finalized: true`, `finalizedAt` = the latest old entry's `enteredAt`, `finalizedByEmail` = its `enteredByEmail`. Placement Points: keep the Competition's own when they reproduce every target's total place for place (Settlers of Catan's `[5,3,1]` with a lone 1st stays); otherwise the list of totals by place, a skipped place taking the value of the tied place above it (non-increasing, never awarded). The old entries leave the seed. A `points` Competition with no entries (vi–x) becomes an empty, unfinalized Placement.
- **War Week XI** (`seeds/xi.json`, 22 Competitions, 24 entries, all one per Team): by the rule. **Subjective Points** (Red 6, Blue 4) becomes Discretionary points with reason "Subjective Points" and the Competition is removed. **HQ Attendance** and **AI Survey Completion** become Placements by the rule.
- **Demo XI:** Electric City Matrix (ranked, no Games) becomes an empty, unfinalized Placement. Bouncy Pong and Tuesday Stairs become Head-to-head and Best score and their three typed entries (`bouncy-pong-nick-brown`, `tuesday-stairs-red`, `tuesday-stairs-blue`) are removed (Paul confirmed: Games aren't seeded). Daily Workout Check-in loses `participationTeamScoring`.
- **Demo XII:** Step Challenge becomes a Placement with a Score, higher wins: each Participant's Score is the sum of their old daily entries, Places from Scores, then the rule. Mile Run already matches [3, 2, 1].
- **Every seed:** `maxPoints`, `gameType`, `finishPoints` and `participationTeamScoring` gone; `format` values renamed.

## Human prerequisite: reset staging, then prod

Prerequisite: the R16 PR is merged into `staging` and `migrate.yml`'s run on that push is green.

1. **Staging.** Run the **Seed** workflow (Actions tab) on `staging`, file blank (all seeds), **reset** ticked, `staging` typed in **confirm_reset**.
   Expected: the run is green.
   Check: `/xi/leaderboard` shows the frozen XI totals; Admin has Discretionary points and no Points page; a Team's "where points came from" shows "Discretionary: Subjective Points".
2. **Prod**, after the `staging` → `main` PR merges and its migrate run is green. **First** check in prod Admin that War Week XII holds nothing an Organizer entered that should be kept (a reset of `seeds/xii.json` deletes its Competitions, Hosts and Points Entries), and that every War Week in prod comes from a seed (`/history` lists only seeded editions). If either fails, stop and ask Paul. Then run the Seed workflow as for staging, on `production`.
   Expected and check: as for staging, on the production URL.

If a migrate run fails, don't reseed: the migration test missed an old-row shape. Fix it on a `fix/…` branch.

## Acceptance criteria

The parts' own, plus:

- [ ] **Migration on populated data** (`src/db/migrations.test.ts`; the closeout shows it ran, not skipped): create a throwaway database on the local server; run the Drizzle migrator with a copy of `drizzle/` whose journal stops at `0027`; insert one row of each pre-R16 shape (a `points` Competition with typed entries in two War Weeks, a `games` head-to-head with Games and Entrants, a `games` best-score, a closed `ranked` one with generated entries, a per-person and a ranked team Participation, a Bracket with `max_points`); run the migrator with the full `drizzle/` (one transaction, as on staging); assert it commits, each Competition has its mapped Format, the ranked one has no Games, entries or `finalized_at`, Participation is ranked, and every Points Entry's `war_week_id` is its Competition's; drop the database.
- [ ] **Frozen XI Standings:** a Postgres test holds a literal table of each Team's total from `seeds/xi.json` as of `staging` at `f6d1605` (computed once and pasted in, never by the conversion), loads the converted `seeds/xi.json` with the real loader into a fresh War Week, and asserts `getStandings` returns exactly those totals.
- [ ] **Every seed loads twice:** a Postgres test loads every file in `seeds/` and `seeds/demo/` (including `xi.json` and `demo/xii.json`, which smoke doesn't load) twice into a fresh database and asserts per-table row counts don't change on the second load; one Subjective Points entry per Team; Step Challenge has Placements with Scores and is finalized.
- [ ] `grep -rn '"maxPoints"\|"finishPoints"\|"participationTeamScoring"\|"gameType"\|"format": "points"\|"format": "games"' seeds` finds nothing.
- [ ] `git diff f6d1605 -- e2e src scripts | grep -n '^+.*\(\.skip(\|\.fixme(\|\.only(\)'` finds nothing (`skipIf` is the repo's Postgres guard and is allowed).
- [ ] Smoke row counts and constraints updated for the new tables.
- [ ] The new ADR is in `docs/adr/` and ADR 0002's table reflects Placement and Discretionary points.
- [ ] MCP reports the new Formats (Placement, Head-to-head, Best score, Participation, Bracket) and Discretionary points, read-only, no emails.
- [ ] `/about` copy and stills (`pnpm tsx scripts/about-media.ts --stills`), `docs/maintainers-guide.md` (including the reset as how R16 reached staging and prod) and `docs/regression-checklist.md` updated where user-visible.
- [ ] `CONTEXT.md` updated per the grilling record's glossary list and each part's CONTEXT.md line.
- [ ] Each part file records its closeout and is `done`; this epic records the work-package closeout and the PR URL.
- [ ] The PR description lists the human prerequisite as a post-merge step for Paul.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-03 (red-team pass 1): BLOCKED, 2 blocking (migration never tested on populated data; Discretionary points unscoped and under-checked), 10 warnings, 10 minor.
- 2026-10-03 (Paul, on pass 1): B1 reset staging/prod rather than convert; B2 `war_week_id`; W1 reset is fine; W2 schema at agent's discretion; W3 server-side checks on every action; W4 fix the Standings test; W5 delete old tests; W6 wait for R15 to merge; W7 one full gate at the end, seed conversion in one place; W8 fix the e2e setup; W9 Discretionary entries can be edited and deleted; W10 demo XI's stray Games-Competition entries are dropped; minors at agent's discretion.
- 2026-10-03 (red-team pass 2): BLOCKED, 1 blocking (the R11 scratch-schema pattern can't replay drizzle's `"public"`-qualified SQL in an already-migrated database), 6 warnings, 8 minor.
- 2026-10-03 (Paul, on pass 2): do R16 as one work package rather than interdependent tickets; parts keep their decisions and checks. Applied: one migration and one throwaway-database migration test (B1); part 91 lists every Points-page dependant (W1); Postgres tests must not skip, narrowed grep (W2); the seed test loads every file (W3); schema work is serial (W4); prod reset pre-check (W5); part 90's e2e counts toward team and cleans up (W6); minors resolved in place.

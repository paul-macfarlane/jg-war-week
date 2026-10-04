# Execution record: Epic R21, Competition setup and logging

Contract: [`spec.md`](./spec.md) as of `origin/staging` `6cccc63e`
(decisions 1–13 and 1a, the open question, 16 acceptance criteria, 8 DoD
items) and the grilling record
[`../regression-2026-10/grilling-2026-10-04.md`](../regression-2026-10/grilling-2026-10-04.md)
(decisions 3–9, 16–18, 21–25). Blocked by R20: met (PR #133 merged into
`staging` as `168cbd5e`). Red-team: required (Drizzle schema change).
Branch: `feat/r21-competition-setup`. This section is the `/atlas-plan`
output; it does not amend the spec.

## [EXECUTION PLAN]

2026-10-04. Status: **approved** (red-team passed: cycle 1's 3 blocking
fixed and re-checked, 4 non-blocking notes applied; D1 answered by Paul
2026-10-04).

### D1 When a result may be edited (the spec's open question, answered)

General principle, every Format: a result may be edited or deleted only
while the Competition is open, by anyone who could have logged it
(decision 4). Once Closed, nobody edits, Organizers and Hosts included;
they Reopen first. Nothing below cascades into Points, which exist only
after Close.

| # | Case | Answer |
|---|---|---|
| D1a | Best score Attempt | Edit or delete while open. |
| D1b | Head-to-head Match, including once the series is decided | Edit or delete while open; the series recomputes, and if the edit undecides it, logging reopens. |
| D1c | Bracket Match | Only the latest result along a path is editable. A Match whose result fed a later Match that already has a result is refused for everyone ("A later Match already used this result. Change that Match first."); a correction clears results back from the latest one. Today's confirm-and-reset of later results (`engine.ts` `clearLink` resetting decided Heats) is removed. Group Brackets: a Match is editable while no Match its advancers went to has a result. S4 gives a Bracket Match a "Clear result" under the same rule if it lacks one. |
| D1d | Bracket Match players editing a recorded result | Allowed with self-report on, for the Matches they played; replaces ADR 0005's "a second report is refused". |
| D1e | Placement rows | Unchanged: editable while open, locked by Close. |
| D1f | Result edit after its round is complete, next Match unplayed | Allowed; the next round re-fills from the new advancers and any moves or overrides made there are lost. |

Decision 3's locks: no change beyond P8. P8 (an Entrant still counts as a
result that locks Format and scoring) and P9 (an Attempt's Team frozen at
logging) stand as the plan's calls; Paul raised no objection.

### Plan decisions (the plan's call within the spec; red-team checks)

- **P1 Names (decision 1a).** Tables: `heat` → `bracket_match`,
  `heat_entrant` → `bracket_match_entrant`, `game` + `game_player` →
  `series_match` + `series_match_entrant` (Head-to-head) and `attempt`
  (Best score). Enum `heat_status` → `bracket_match_status`. Columns:
  `finalized_at` → `closed_at`, `generated_by_bracket` → `generated`,
  `winner_to_heat_id` → `winner_to_match_id`, `loser_to_heat_id` →
  `loser_to_match_id`, `heat_id` → `bracket_match_id`, `game_id` →
  `series_match_id`. Every constraint, index and FK renamed to what
  drizzle-kit would name it from the new schema (so a later
  `pnpm db:generate` finds no diff). Code: `src/lib/games/` splits into
  `src/lib/series/` (Head-to-head) and `src/lib/best-score/`; `heat*`
  modules → `match*` under `src/lib/bracket/`; permission keys
  (`games.log`, `bracket.heat-report`, …) → `series.log`,
  `attempts.log`, `bracket.match-report`; components and e2e specs
  renamed to match. **Kept:** route segments (`/admin/competitions/[id]/games`
  and the other 308 redirects; R20 decision 10, no route renamed), MCP
  tool names (`get_games`, `get_bracket`: a public interface; their
  descriptions and output fields already say Match/Attempt after R20),
  committed `drizzle/*.sql` history, and comments that narrate history.
- **P2 Scoring config (decision 6).** Columns, not jsonb: the existing
  `score_direction` enum column (none / higher / lower) widens from
  Placement-only to Placement, Bracket, Head-to-head and Best score (Best
  score: higher or lower only; Participation: none), plus a new
  `score_unit varchar(20)` (null = none). Best score's `betterIs` and
  `unit` move out of `game_config` into these columns. One pure module
  `src/lib/scoring.ts`: `ScoringConfig = { direction, unit }`, the label
  ("Score (sec)") and `orderByScore(entries, direction)` returning places
  with ties shared — reused by Placement (`src/lib/placement/score.ts`
  delegates to it), Bracket Matches, Head-to-head Matches and Best score
  standings.
- **P3 Per-Format config.** `game_config` → `series_config` jsonb
  (`{ drawsAllowed, bestOf: 1 | 3 | 5 | 7 }`, required; a new Head-to-head
  defaults to Best of 3) and `best_score_config` jsonb
  (`{ teamScore: "best-member" | "sum-of-members" }`, default best
  member; meaningful only in team scoring). `max_attempts integer`
  column (null = unlimited, CHECK ≥ 1, Best score only). The `count`
  field goes from config, form, MCP and seed format.
- **P4 Bracket config (decisions 10, 11).** `bracket_config` becomes
  `{ kind: "head-to-head" | "group", entrantsPerMatch, advancePerMatch,
  thirdPlaceMatch, rounds: { [round]: { entrantsPerMatch,
  advancePerMatch } } }`. `kind` replaces "2 / 1 means head-to-head";
  Head-to-head ignores the size fields (2 / 1) and is the only kind with
  a 3rd place Match; Group requires 3–8 per Match (2 per Match is the
  Head-to-head kind). `rounds` holds per-round defaults that differ from
  the Bracket-wide ones. `bracket_match` gains `advance_count smallint`
  (1 for Head-to-head); `slot_count` stays.
- **P5 Flexible Group engine (decision 11).** `src/lib/bracket/groups.ts`
  (renamed from `heats.ts`):
  - Note: the spec's `engine.ts` is the head-to-head engine; the Group
    engine is today's `heats.ts`, which this replaces.
  - A Match's size is its Entrant count; its `advanceCount` is 1…size;
    a Match before the final round with size ≤ `advanceCount` is a bye
    (the final is never a bye, as today).
  - Dealing is size-aware: a round fills its Matches' existing sizes
    snake-style by rank (not a fresh ⌈n/S⌉ split), so overridden sizes
    survive. A re-fill of a later round (D1f) re-projects it from its
    defaults, dropping that round's moves. `rounds` keys beyond the
    projected final are pruned.
  - Build deals Round 1 snake-style from the round's defaults (today's
    deal), then projects later rounds from the summed advancers and each
    round's defaults; the final is the first round whose incoming count
    ≤ that round's entrants per Match (one Match).
  - Edits (Organizers and Hosts, on a round with no result): set a
    Match's advancing count; move an Entrant to another Match in the same
    round (sizes follow); change a round's defaults (re-deals that round
    if filled and unplayed). Each edit re-projects every later round. A
    round that would send on as many as it received is refused (today's
    "would never end" message).
  - A round with any result is locked (decision 11 "Locks").
  - Advancers fill the next round ranked by place then Match position, as
    today; the final's order gives places 1–4.
  - Persisted as today: every round's `bracket_match` rows exist;
    re-projection deletes and recreates rows of later, empty rounds in the
    same transaction.
- **P6 "Set by hand" (decision 7).** Derived, no column: with a direction
  set and every Score in, a Match or Placement sheet whose stored order
  differs from `orderByScore`, or breaks a Score tie, shows "set by hand".
- **P7 Close / Reopen (decision 1).** One `closeCompetition` /
  `reopenCompetition` in `src/mutations/close.ts`, each Format supplying a
  pure "placings now" function; the five pairs
  (`finalizePlacements`/`reopenPlacements`, `finalizeBracket`/
  `unfinalizeBracket`, `closeGames`/`reopenGames`,
  `closeParticipation`/`reopenParticipation`) become thin callers or
  go. Bracket Close still requires a complete Bracket.
- **P8 Locks (decisions 2, 3).** `COMPETITION_SETTING_FIELDS` loses
  `enrollClosesAt`, `loggingClosesAt`, `checkInClosesAt`,
  `entrantsOpen`; gains `scoreUnit` (never locks: a label),
  `seriesConfig` (first Match), `bestScoreConfig` (first Attempt),
  `maxAttempts` (refused below the most Attempts any one person already
  has; otherwise free until Closed). `scoreDirection` locks per Format on
  play started. What counts as a result is unchanged (an Entrant still
  locks Format and scoring).
- **P9 Attempts belong to a Participant, Team frozen at logging.**
  `attempt.participant_id` NOT NULL plus `attempt.team_id` (nullable,
  set to the Participant's Team when logged; team scoring refuses a
  Participant on no Team). A later Team change doesn't move credit. Sum of
  members needs the Participant. Head-to-head: the Competition's two
  `entrant` rows are the series' sides; `series_match_entrant` references
  `entrant_id` (spec 57–58, "two Entrants"), not team / participant.
- **P10 Migration data (spec "Schema change").** Two hand-edited
  migrations, following 0028/0029's precedent: `0031` pure renames
  (row-preserving by construction); `0032` reshape, DDL and row fates
  below. The non-numeric Match Scores, and every dropped row, are listed
  by `scripts/r21-migration-report.ts` run before migrating (a deliberate
  deviation from "the migration's output lists them": drizzle's migrator
  doesn't surface `RAISE NOTICE`). Its output goes in the PR. XII, staging
  and prod are reset by reseed afterwards (R16 precedent).
- **P10a 0032 statement order and DDL.**
  1. Drop CHECKs `competition_score_direction_placement_only`,
     `competition_game_config_head_to_head_or_best_score`,
     `competition_participation_columns` (it names `check_in_closes_at`;
     Postgres would drop it silently with the column).
  2. Create `series_match` (`id` uuid pk, `competition_id` FK cascade,
     `recorded_at` timestamptz not null default now, `logged_by_email`
     varchar(254) not null, `logged_by_participant_id` FK set null,
     timestamps; index on `competition_id`, `logged_by_participant_id`),
     `series_match_entrant` (`series_match_id` FK cascade, `entrant_id` FK
     cascade, `place` int ≥ 1 (1/2; 1/1 a Draw), `score` numeric(12,3);
     pk (`series_match_id`, `entrant_id`)), `attempt` (`id` pk,
     `competition_id` FK cascade, `participant_id` FK cascade not null,
     `team_id` FK cascade null, `score` numeric(12,3) not null,
     `recorded_at`, `logged_by_email`, `logged_by_participant_id` FK set
     null, timestamps; index on `competition_id`, `participant_id`).
  3. Add columns: `competition.score_unit` varchar(20),
     `series_config` jsonb, `best_score_config` jsonb, `max_attempts`
     int; `bracket_match.advance_count` smallint (nullable for now).
  4. Convert data (row fates below), including `bracket_config` and
     `advance_count`.
  5. `bracket_match_entrant.score` → numeric(12,3) via
     `CASE WHEN score ~ '^\s*-?\d{1,9}(\.\d{1,3})?\s*$' THEN score::numeric END`
     (guarded so nothing overflows and aborts the transaction).
  6. Set `advance_count` NOT NULL; drop `game_player`, `game`,
     `game_config`, `entrants_open`, `logging_closes_at`,
     `enroll_closes_at`, `check_in_closes_at`.
  7. Re-add CHECKs: `competition_score_direction_by_format`
     (participation: none; best-score: higher or lower; others: any),
     `competition_series_config_head_to_head` (not null iff
     head-to-head), `competition_best_score_config_best_score` (null
     unless best-score), `competition_max_attempts` (null, or ≥ 1 and
     best-score), `competition_self_enroll_bracket_only`
     (`not self_enroll and entrant_limit is null` unless bracket),
     `competition_participation_columns` (as today minus
     `check_in_closes_at`), `attempt_score_not_null` is the column
     constraint, `bracket_match_advance_count_from_1`.
- **P10b Row fates in 0032.**

  | Source shape | Fate |
  |---|---|
  | Bracket `bracket_config` (old keys) | Rewritten: `kind` = head-to-head when 2 / 1, else group; `entrantsPerHeat` → `entrantsPerMatch`, `advancePerHeat` → `advancePerMatch`, `thirdPlaceGame` → `thirdPlaceMatch`; `rounds` = `{}`. Null → head-to-head default. |
  | `bracket_match.advance_count` | 1 for head-to-head; else the config's `advancePerMatch`; the final (last round, not 3rd place) 1. |
  | Head-to-head `game_config` (or null) | `series_config` = `{ drawsAllowed: (old or false), bestOf: (old or 7) }` (7 so existing Matches fit). |
  | Head-to-head Games among exactly two players, ≤ 7 Games | Two `entrant` rows (existing ones reused, created otherwise); each Game → `series_match` + two `series_match_entrant` rows keeping place. |
  | Head-to-head > 2 Entrant rows, Games among exactly two of them (≤ 7 Games) | The two who played are kept and their Games converted as above; the other Entrant rows dropped. Listed. |
  | Head-to-head Games among > 2 players or > 7 Games; > 2 Entrant rows with no Games | Games dropped; Entrant rows beyond the first two (by seed position) dropped. Listed. |
  | Best score `game_config` (or null) | `score_direction` ← `betterIs` (default higher); `score_unit` ← `unit` (empty → null); `best_score_config.teamScore` ← team + total: sum-of-members, else best-member. |
  | Best score Game with a null score | Dropped (`attempt.score` is not null; `game_player.score` is nullable). Listed. |
  | Best score Game, individual | `attempt` (participant = the player, team = their Team now). |
  | Best score Game, team | `attempt` with participant = logger when on that Team; Host-logged ones dropped. Listed. |
  | Best score `entrant` rows | Dropped (decision 5). Listed. |
  | Non-Bracket `self_enroll` / `entrant_limit` | Reset to false / null. |
  | Non-numeric Match Score | Null. Listed. |

  Migration test (`src/db/migrations.test.ts`): old-shape rows for each
  row of this table, including a 4 / 2 Group Bracket, a Head-to-head
  with three Entrant rows whose Games are between Entrants 1 and 3, and
  a null-score Best score Game, asserted after
  0031 + 0032.
- **P10c Seeds.** S2 renames the `bracketConfig` keys in
  `seeds/demo/xii.json` and `xii-scale.json`; adds a Head-to-head
  `entrants` field (two names; idempotent by Competition and target) to
  the seed format, `src/lib/setup.ts` and the loader, and names two
  Entrants for Bouncy Pong (XI demo: the smoke pair Albert Hernandez and
  Austin Gage), Ping Pong (XII) and Cornhole (scale); sets `seriesConfig`
  Best of 3 on each. Seeds load twice with no row count change.
- **P11 Coordination with R22** (in progress in
  `.claude/worktrees/r22-people-and-admin/`, also schema). Whichever
  merges second renumbers its migrations and regenerates the drizzle
  snapshot on the latest `staging` before its PR; the ADR number is the
  next free one at commit time. Shared files to expect conflicts in:
  `src/db/schema.ts`, `src/db/migrations.test.ts`,
  `src/components/entrants-picker.tsx`, `src/components/log-a-result.tsx`,
  `src/lib/access.ts`, `CONTEXT.md`, `docs/maintainers-guide.md`,
  `docs/regression-checklist.md`, `docs/agents/testing.md`. R22 puts
  `ParticipantPicker` on "match and game players"; R21 removes the
  Head-to-head player picker and Best score's self picker (the
  Organizer's "log for" picker stays). Record that in the PR for R22. The
  `/about` stills wait for R22's stills-script fix, or are re-shot after
  it.
- **P12 Migration snapshots.** `drizzle-kit generate` prompts on renames
  and can't run without a terminal. Procedure: change `schema.ts`, run
  `pnpm db:generate` in a pseudo-terminal answering "create" to every
  prompt, keep the generated `meta/00NN_snapshot.json` and journal entry,
  then replace the SQL body by hand with the renames (0031) or the P10a
  steps (0032). The schema parity check runs at the end of S1 and of S2,
  and again after any renumber forced by R22.
- **P13 Enrollment (decision 5).** S2 removes enrollment from
  Head-to-head and Best score: `enrollmentUnavailable` answers for every
  non-Bracket Format, the server refuses `enroll` / `withdraw` and the
  switches, the CHECK in P10a backs it, and `enroll-rule.test.ts` covers
  it.

### Run record

- Isolation (R20 precedent): integration worktree
  `.claude/worktrees/r21-competition-setup/war-weeker/` from
  `origin/staging` (`6cccc63e` or later), database `war_weeker_r21`,
  `SMOKE_PORT=3130`, `E2E_PORT=3230`; workers `war-weeker-<x>` with
  `war_weeker_r21<x>` and ports 3131+/3231+. Every command runs with
  `DATABASE_URL=postgres://postgres:postgres@localhost:2345/<db>?sslmode=disable DATABASE_DRIVER=pg`.
  Never the `war_weeker` database or ports 3100/3200 (other sessions).
  No `.env*` file is read.
- Clear `test-results/` in the worktree before evidence; gate log at
  `test-results/r21/gate.log`; e2e screenshots at
  `test-results/e2e/<test>/`.

### Slices, order and ownership

Edges: S1 → S2 → {S3, S4, S5, S6} → S7 → S8. Each slice ends green on
`pnpm typecheck && pnpm lint && pnpm test` plus the checks named for it;
S2 and S8 run the full `pnpm gate`.

| Slice | Decisions | Owns | Suggested worker |
|---|---|---|---|
| **S1 Rename** | 1a (all but the `game` split), 1 (column names) | migration `0031`; `src/db/schema.ts`; every `heat*` / `finalize*` / `champion*` identifier and file in `src/`, `scripts/`, `e2e/`; seed field `finalized*` → `closed*` (`seeds/xi.json`, demo seeds, `src/seed/schema.ts`, `src/lib/setup.ts`); banned-term `ALLOWLIST` deleted | sonnet (mechanical) |
| **S2 Model** | 1a (`game` split), 2, 5, 6 (storage), 8, 13 (storage), P2–P4, P9, P10 | migration `0032` and snapshot; schema; seed format and loader (P10c: Head-to-head `entrants`, `bracketConfig` keys); demo seeds (H2H Best of 3 and two Entrants, no `entrantsOpen`, Tuesday Stairs `bestScoreConfig.teamScore = "sum-of-members"`, unit as column); scale fixture (`src/seed/scale.ts`: Cornhole 2 Entrants Best of 7, Darts Attempts per Participant); removal of `log-rule`'s time checks, `enroll-rule`'s close time, Participation's close time, `entrantsOpen` paths; enrollment for Bracket only (P13); migration test; report script | opus (data-preserving SQL) |
| **S3 Close and locks** | 1, 3, 9 | `src/mutations/close.ts`; `src/lib/competition-locks.ts`; settings form lock wiring; a Format change to Best score writes Best score's defaults (`score_direction` higher) in the same save, so `competition_score_direction_by_format` never refuses it (vitest: Format change Placement → Best score succeeds); Placement sheet (no quick fill, no Add everyone; `QUICK_FILL` removed from `src/lib/placement-rows.ts`) | sonnet |
| **S4 Logging and rules** | 4, 7, 12, 13, D1 (incl. D1c's later-result refusal, `clearLink` reset removed, vitest per case D1a–D1f) | `src/lib/scoring.ts`; Bracket Match result form (Scores → places, set by hand); Head-to-head two fixed rows, series decided refusal and disabled reason, drawn series; Best score as yourself, max attempts, "Update your score", own-Attempt edit/delete; one self-report setting on Bracket / H2H / Best score (never Placement); the rule modules (`bracket/match-report-rule.ts`, `series/log-rule.ts`, `best-score/log-rule.ts`) | opus (rules) |
| **S5 Bracket setup** | 10, 11 | toggle (shadcn `ToggleGroup`, added via `pnpm dlx shadcn@latest add toggle-group` and stripped of `cursor-*` / `disabled:pointer-events-none`); `src/lib/bracket/config.ts`, `groups.ts`, `tree.ts`; admin tree edits (advancing per Match, move Entrant, round defaults) | opus (engine) |
| **S6 Scoring UI** | 6 (display) | direction and unit fields per Format; "Score (unit)" headers (Placement, Bracket tree, H2H, Best score) | sonnet |
| **S7 MCP, smoke, e2e** | AC 11, all e2e | `src/mcp/*` config output; `scripts/smoke/*`; new e2e `regression-r21-*.spec.ts`; existing specs updated | sonnet |
| **S8 Docs and close** | DoD 3–7 | ADR (next free number) and ADR 0005/0006 "superseded in part"; `CONTEXT.md`; `/about` copy and stills; `docs/maintainers-guide.md`; `docs/regression-checklist.md`; `docs/agents/testing.md` smoke/e2e cells; backlog 25 closed; `.scratch/backlog.md` R21 line | sonnet |

S3–S6 overlap in `src/components/competition-settings-form.tsx` and
`src/mutations/competition-settings.ts`. Either run them in sequence
(S3 → S6 → S5 → S4) or give the settings form to S6 and have the others
add fields only through it. The orchestrator chooses.

### Acceptance criteria → verification

All on the integration worktree's database. "vitest" = `pnpm test`;
"smoke" = `pnpm build && pnpm smoke`; "e2e" = `pnpm build && pnpm e2e`
(Chromium, stub sessions, seeds reloaded with `--reset`). Evidence
invalidated by any later change to the named files.

| AC | Check | Command / spec | Expected | Earliest | Evidence |
|---|---|---|---|---|---|
| 1 Close / Reopen everywhere; `closed_at` | vitest on `close.ts` per Format; smoke Bracket loop | `src/mutations/close.test.ts`; `scripts/smoke/brackets.ts` | Each Format writes generated Points Entries on Close, withdraws on Reopen; Bracket Close refused until complete | S3 | gate.log |
| 2 No "closes at"; Enrollment closes on build, limit, Close | vitest on enroll and log rules; e2e enrollment and settings | `enroll-rule.test.ts`, `series/log-rule.test.ts`; `e2e/enrollment.spec.ts`; `regression-r21-settings.spec.ts` | No time input on the settings form of any of the five Formats (each opened); refusals only for build / limit / Closed | S2 | gate.log, screenshots |
| 3 Self-report off by default; on: Best score as yourself, either H2H player, Bracket player; off: refused; Placement never | e2e stub sessions; smoke over HTTP | `e2e/regression-r21-self-report.spec.ts`; `scripts/smoke/games.ts` (→ `series.ts`, `attempts.ts`) | New Competition of each Format has the switch off; three writes succeed when on and are refused (server message) when off; Placement settings show no switch | S4 | screenshots, gate.log |
| 4 Placement lower is better, "sec" | e2e | `e2e/regression-r21-scoring.spec.ts` | Places filled from Scores; header "Score (sec)"; tie settled by hand shows "set by hand" | S6 | screenshots |
| 5 Group Match and H2H Match from Scores; tie manual or Draw | vitest `scoring.test.ts`; e2e | `regression-r21-scoring.spec.ts` | Places / Winner computed; equal Scores need a pick, or record a Draw with draws on | S4 | gate.log, screenshots |
| 6 H2H Best of 3 2–0 refused; drawn series; two fixed rows | vitest; e2e | `series/log-rule.test.ts`; `regression-r21-head-to-head.spec.ts` | Third Match refused by the server and the button disabled with the reason; drawn series shares the higher place's points; no player picker | S4 | screenshots |
| 7 Best score max 3 | vitest; e2e | `best-score/log-rule.test.ts`; `regression-r21-best-score.spec.ts` | Fourth refused for Participant and Organizer; "N attempts left"; no Entrant list or enroll | S4 | screenshots |
| 8 No Best / Total; Team score | vitest; e2e; seed test | `best-score/standings.test.ts`; `src/seed/seeds.test.ts` | Individual = best Attempt; Best member vs Sum of members ranked as specified; Team score field only in team scoring; no Best / Total control on the form and no `count` in `get_games` output (asserted absent); Tuesday Stairs is Sum of members. No Attempts are seeded, so the PR's Tuesday Stairs before / after says so | S2 (seed), S4 | gate.log |
| 9 Max 1 "Update your score" | vitest; e2e | same | Second save edits; Attempt count stays 1; Organizer edits too | S4 | screenshots |
| 10 Participant edits own Attempts | vitest; e2e | same | Owner edits/deletes each (one Host-logged); another Participant refused by the server; self-report off refuses | S4 | screenshots |
| 11 H2H either player edits Host-logged Match | vitest | `series/log-rule.test.ts` | Allowed with self-report on | S4 | gate.log |
| 12 Bracket toggle | e2e | `regression-r21-bracket-setup.spec.ts` | Group shows size fields only; Head-to-head shows 3rd place only | S5 | screenshots |
| 13 Group of 11, 4 / 2 | vitest engine; e2e | `bracket/groups.test.ts`; `regression-r21-bracket-setup.spec.ts` | Override to 3 / 1; move Entrant; short Match is a bye; next round from summed advancers; Close gives places 1–4 and points; edit with a result refused | S5 | screenshots, gate.log |
| 14 No 5 · 3 · 1, no Add everyone | e2e | `regression-r21-scoring.spec.ts` | Neither button exists (asserted absent with `toHaveCount(0)` on a located sheet) | S3 | screenshots |
| 15 Migration, seeds twice, CHECK inserts | migration vitest; smoke | `src/db/migrations.test.ts` (new block); smoke | Rows of every renamed table survive 0031 with ids intact; 0032 converts sample rows as P10; non-numeric scores null and listed; seeds load twice unchanged; CHECK inserts refused | S2 | gate.log, report output in PR |
| 16 MCP config, no `@` | smoke | `scripts/smoke/mcp.ts` | `get_games` / `get_bracket` / `get_placements` show direction, unit, Best of, max attempts, Team score, per-Match size and advancing; no `@` | S7 | gate.log |

Extra checks for decisions without an AC:

- **1a names:** `rg -n -i '(heat|game|finaliz|champion)' src scripts e2e -g '*.ts' -g '*.tsx'`
  saved to `test-results/r21/names-scan.txt`. Exempt, exactly: route
  directories `src/app/admin/competitions/[id]/{games,bracket}` and
  `src/app/admin/placements/` with their redirect tests; the MCP tool
  names `get_games` and `get_bracket` (and their mentions in smoke, MCP
  tests and `llms-txt`); old-shape SQL in `src/db/migrations.test.ts`;
  `scripts/r21-migration-report.ts`. Any other hit, comments included,
  is FAIL. Banned-term vitest passes with no allowlist.
- **Schema parity:** after S2, `pnpm db:generate` reports no changes, and
  a schema-only `pg_dump` of a database migrated through 0032 equals one
  built by `drizzle-kit push` from `schema.ts` (sorted, normalized);
  diff saved to `test-results/r21/schema-parity.txt` (empty).

### Definition of Done → plan

| DoD | Where |
|---|---|
| Red-team before implementation | This plan (below) |
| Migration and seed together; smoke on seeded local Postgres | S2; S8 gate |
| ADR for self-report; 0005 and 0006 superseded in part | S8 (content from S4 and D1) |
| `CONTEXT.md` terms | S8 |
| `/about`, guide, regression checklist | S8 |
| Backlog 25 closed | S8 |
| e2e screenshots 1440 and 390 | S7 |
| `pnpm format:check && pnpm gate`; CI | S8, then PR |

### Fixtures and cleanup

- Viewports: each new `regression-r21-*` spec screenshots its final state
  at 1440×900 and at 390×844 by `page.setViewportSize` (the Playwright
  project is Desktop Chrome only), under `test-results/e2e/<test>/`.
- `docs/agents/testing.md`: the unit row's spec-B allowlist note, and the
  smoke and e2e cells, are updated in S8.

- Stub sessions as today (`e2e/session.ts`): an Organizer, a Host of the
  Competition, two linked Participants, an unlinked JG email.
- New e2e specs create their own Competitions in the seeded XI War Week
  and delete them in `finally` (team rule: own or restore).
- Group Bracket of 11: a new individual Competition with 11 seeded
  Participants as Entrants.
- Smoke reuses its own `smoke-` Competitions. Smoke's logged Bouncy Pong
  Match (now Best of 3) is deleted in `finally`, so repeated runs and
  later e2e never meet a decided series (team rule: put shared seeded
  data back).

### Human-gated items

- **Before production Migrate** (maintainers guide, R16 pre-check and
  Migrate / deploy order): Paul runs `scripts/r21-migration-report.ts`
  against staging, then production, with his own credentials (agents
  never read `.env*`), pastes the output in the PR, then runs
  `migrate.yml`. Renamed tables make a Vercel rollback past this deploy
  unsafe; the app errors between deploy and Migrate. Post-check:
  `/xii/competitions` and the Bracket page answer 200.
- **Staging and prod reseed** after merge (R16 precedent): Paul runs the
  `seed.yml` workflow; post-check `/xii/competitions` renders and MCP
  `get_games` for a Head-to-head answers.
- **PR review and merge** into `staging`; CI green.

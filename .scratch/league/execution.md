# Execution record: Epic R23, League (round robin and Swiss)

Contract: [`spec.md`](./spec.md) as of `origin/staging` `734f28e7`
(decisions 1–12, the schema section, 8 acceptance criteria, 6 DoD items)
and the grilling record
[`../regression-2026-10/grilling-2026-10-04.md`](../regression-2026-10/grilling-2026-10-04.md)
(decisions 2, 7, 13, 14, 22). Blocked by R21: met (PR #135 merged into
`staging`); R22 (PR #138) is merged too, so `ParticipantPicker` is the
picker. Red-team: required (Drizzle schema change). Branch:
`feat/23-league` (Paul's `/atlas-implement` instruction), worktree
`.claude/worktrees/r23-league/war-weeker/`. This section is the `/atlas-plan` output; it does not
amend the spec.

## [EXECUTION PLAN]

2026-10-04. Status: **approved** (Paul answered Q1–Q4 on 2026-10-04; see
"Paul's answers" below). Red-team cycle 1: no blocking; W2 and W4–W8 and
every minor folded in below; W1 and W3 resolved by Paul's answers. Q3's
answer amends spec decision 9 and adds one Head-to-head rule: see
[SCOPE CHANGE] below.

### Readings of the spec (the plan's calls; red-team and Paul check)

| # | Spec text | Reading |
|---|---|---|
| R1 | Decision 11, "Settings lock once round 1 is paired" | Locks once round 1 is paired: **Pairing, rounds, Score direction, the Entrants** (and so enrollment, which closes then anyway). **Score unit never locks** and **self-report locks only while Closed**, as on every Format (`CONTEXT.md` Settings lock; ADR 0011). Reason text: "Locked once round 1 is paired." |
| R2 | Decision 3, "with a direction set, Scores decide the result" | With a direction and both Scores in, the result is computed (equal Scores a draw) and a posted result that disagrees is refused ("The Scores decide this result: change a Score."). No "set by hand" override on League (unlike Head-to-head). With direction none or a Score missing, the recorder picks A won / B won / Draw. |
| R3 | Decision 6, "Round 1 pairs by Seed Position, or randomly if there are no seeds" | The app has no seeding UI (a Bracket draws Seed Positions at random at build). "Pair round 1" (Swiss) and "Pair rounds" (round robin) draw Seed Positions at random by `shuffleSeedPositions` with an injectable `rng`, as `generateBracket` does, then pair by them. Seeded Leagues (seed files) carry their own pairings. |
| R4 | Decisions 5, 6: byes | A bye or sit-out is a Match row with no second Entrant and **never a result**. Swiss bye: 1 match point; round robin sit-out: 0. Neither counts in W / D / L, nor as "a result" for locks, "round has a result" or Close's unplayed list. |
| R5 | Decision 7, tiebreaks | Buchholz = sum of the final match points of every opponent actually played (a bye adds nothing; an unplayed paired Match adds nothing). Sonneborn-Berger = sum of beaten opponents' match points + half of drawn opponents'. Round-robin head-to-head = match points from Matches among the Entrants tied on match points (one pass over the whole tie group, not recursive), then SB for those still level, then a shared place (1, 1, 3). |
| R6 | Decision 10, "tiebreak values show as columns" | Round robin: columns **H2H** (only on a row tied on match points; "—" otherwise) and **SB**. Swiss: **Buchholz**. |
| R7 | Decision 6, "editing before the round has a result" | One edit: **swap two Entrants within a round** (either may be the bye/sit-out; two already in the same Match refused as a no-op). Swiss: refused once any Match of that round has a result. Round robin: refused once either affected Match has a result (decision 5's per-Match rule). A swap that creates a repeat pairing is allowed, and the Edit pairings dialog warns, naming the repeats before saving (and, in a round robin, the pairs that will then never meet) (Paul, Q4). |
| R8 | Correcting results after the next Swiss round is paired | Allowed while open, by whoever could record it (decision 8); already-made pairings stand (standard arbiter practice). No re-pairing cascade. |
| R9 | No path back from a wrong round 1 | **"Clear pairings"** (Organizer or Host) deletes every League Match while none has a result, which unlocks R1's settings and Entrants — the League twin of re-building a Bracket before a Match result. Nothing else is undone automatically (Paul, Q2: add it). |
| R10 | Decision 9, Close (amended by Paul, Q3) | **Refused until the League is complete**, like a Bracket: every round is paired (Swiss: all N rounds) and every Match that isn't a bye or sit-out has a result. Refusal: "Finish every Match before closing." naming the unplayed Matches (and any Swiss rounds not yet paired), the same reason on the page (Close disabled) and the server. This replaces decision 9's "closing early allowed with a warning". |
| R11 | Entrants after round 1 | Locked once round 1 is paired (R1). Mid-League withdrawals are out of scope: an unplayed Match has to be recorded (or the pairings cleared before any result) before Close. |
| R12 | Defaults | A new League is **Round robin**, rounds blank (Swiss default ⌈log₂ N⌉ worked out at pairing from the Entrant count; shown in the field's help), Score direction none, self-report off, enrollment off. |
| R13 | Decision 12, MCP | A new read-only tool **`get_league`**; `get_bracket` and `get_games` answer a League with `bracket: null` / `matches: null` and a message naming `get_league` (their existing redirect pattern). |
| R14 | "Top finishers once Closed" | The Top finishers block renders only when Closed; while open the table carries Provisional points. |

### Plan decisions

- **P1 Schema (red-team).** Migration `0034` (hand-edited body, generated
  snapshot; R21 P12 procedure):
  1. `ALTER TYPE competition_format ADD VALUE 'league'` (appended; Postgres
     17 locally, Neon in prod: allowed in a transaction, and nothing in
     0034 uses the literal as an enum — every CHECK compares
     `format::text`, the R3 decision 13 rule).
  2. `CREATE TYPE league_result AS ENUM ('a', 'b', 'draw')`.
  3. `competition.league_config jsonb` (`{ pairing: "round-robin" |
     "swiss", rounds: number | null }`).
  4. Table **`league_match`** (one table; the round is a column, decision
     "each Match holds the round"; there is no round-level data to keep,
     so no `league_round` table): `id` uuid pk; `competition_id` FK
     cascade; `round` int; `position` int (order in the round);
     `entrant_a_id` FK `entrant` cascade not null; `entrant_b_id` FK
     `entrant` cascade **null** (null = bye / sit-out); `result`
     `league_result` null; `score_a`, `score_b` numeric(12,3);
     `recorded_at` timestamptz; `recorded_by_email` varchar(254) (audit,
     never read back); `recorded_by_participant_id` FK `participant` set
     null; `seed_key` varchar(80); `created_at`, `updated_at`.
     Constraints: unique (`competition_id`, `round`, `position`); unique
     (`competition_id`, `seed_key`); indexes on `entrant_a_id`, `entrant_b_id`, `recorded_by_participant_id`; CHECKs
     `league_match_round_from_1` (round ≥ 1), `league_match_position_from_0`,
     `league_match_two_entrants` (`entrant_b_id is null or entrant_b_id <>
     entrant_a_id`), `league_match_bye_no_result` (`entrant_b_id is not
     null or (result is null and score_a is null and score_b is null)`),
     `league_match_recorded` (`(result is null) = (recorded_at is null)`),
     `league_match_scores_need_result` (`result is not null or (score_a is
     null and score_b is null)`). "An Entrant plays once per round" spans
     two columns, so it is the engine's and the swap's rule, proven by
     vitest, not a constraint.
  5. CHECKs on `competition`: new `competition_league_config_league`
     (`(league_config is not null) = (format::text = 'league')`) and
     `competition_league_config_shape`, written with `CASE` so the cast
     never runs on a non-number (M4): null config passes; pairing must be
     `round-robin` or `swiss`; `rounds` is JSON null / absent, or (Swiss
     only) a JSON number that is an integer ≥ 1
     (`case when jsonb_typeof(league_config->'rounds') = 'number' then
     (league_config->>'rounds')::numeric >= 1 and
     (league_config->>'rounds')::numeric = floor((league_config->>'rounds')::numeric)
     and league_config->>'pairing' = 'swiss' else
     coalesce(jsonb_typeof(league_config->'rounds'), 'null') = 'null' end`);
     drop and re-add `competition_self_enroll_bracket_only` as
     `format::text in ('bracket','league') or (not self_enroll and
     entrant_limit is null)` (name kept: drizzle names it from
     `schema.ts`; the comment says "Bracket and League"). Score direction:
     unchanged (League falls to `else true`).
  Schema parity after S1: `pnpm db:generate` reports no changes, and a
  `drizzle-kit push` schema dump equals a migrated one (R21 method),
  saved to `test-results/r23/schema-parity.txt`. No data conversion: no
  migration report script. Migration test (`src/db/migrations.test.ts`,
  "league (0034)"): a throwaway database at 0033 with each Format's rows
  migrates untouched through `migrateTo` (which commits; a new enum value
  can't be used in the transaction that added it, 55P04, so not the
  `inRolledBackTransaction` pattern; W4); then a `league` Competition
  inserts; each new CHECK refuses its
  bad row (23514).
- **P2 Type safety first.** `BracketFormat` in `src/lib/bracket/types.ts`
  is `Exclude<Format, "placement" | LoggedFormat | "participation">`, so
  adding `league` would make it `"bracket" | "league"` and wrongly narrow
  every `isBracketFormat` else-branch. It becomes
  `Extract<Format, "bracket">`. Every Format branch that falls through to
  Bracket gains an explicit League case or an exhaustive `switch` with a
  `never` check: `run-area.tsx` (`runAreaTitle`, `CompetitionRunArea`),
  Participant `page.tsx`, `generatedNote` / `generatedRefusal`,
  `recent-results.ts` kind, `hasPlay`, `getBracket`, `src/mcp/bracket.ts`,
  `competitions.tsx` badge, `competition-status.ts`. `Record<Format, …>`
  maps (`FORMAT_LABELS`, `FORMAT_DESCRIPTIONS`) get League by the
  compiler. Label: "League"; description: "Entrants play each
  other one Match at a time, round robin or Swiss, for match points."
- **P3 Pure modules, `src/lib/league/`** (no DB, no zod in modules that
  reach the client via `access.ts`):
  - `config.ts`: `LeagueConfig`, `leagueConfigSchema` (strict),
    `DEFAULT_LEAGUE_CONFIG` (`round-robin`, `rounds: null`),
    `swissDefaultRounds(n) = max(1, ⌈log₂ n⌉)`, `roundsOf(config, n)`
    (round robin: n−1 even, n odd; Swiss: `rounds ?? default`),
    `roundsError(config, n)` (Swiss: 1…n−1, "A Swiss League of N Entrants
    plays 1 to N−1 rounds."), `PAIRING_LABELS`.
  - `pairing.ts`:
    - `roundRobin(entrants)` — circle method over Seed Position order,
      a phantom for odd N whose partner sits out; returns every round.
    - `swissRound({ entrants, matches, round })` — R5's ranking order
      (match points, Buchholz, Seed Position) groups Entrants by match
      points. With an odd count the bye goes to the lowest-ranked Entrant
      with no bye. A deterministic depth-first search pairs the
      top unpaired Entrant with, in order: its own group's bottom half
      from its mirror position, the rest of its group below it, then lower
      groups top first (a float down); never a previous opponent;
      backtracking (and then the next bye candidate) when a later Entrant
      can't be paired. No pairing at all → `{ error: "Every pairing would
      repeat a Match. Close the League." }` (rounds are locked by then,
      R1; red-team W2), reached by a vitest (6 Entrants, 5 rounds, a
      result pattern that dead-ends). Round 1 is one group,
      so it is seed 1 v 1+⌊N/2⌋…
    - `swap(round, x, y)` and `rematches(matches)`.
  - `standings.ts`: `leagueStandings(pairing, entrantIds, matches)` →
    rows `{ entrantId, played, wins, draws, losses, byes, matchPoints,
    headToHead | null, sonnebornBerger | null, buchholz | null, rank }`,
    multi-key ranking with standard competition ranks (R5), and
    `leaguePlacings(rows)` → `Placing[]` for `pointsFor`;
    `formatMatchPoints` ("2½").
  - `result.ts`: `parseLeagueResult(direction, raw)` →
    `{ result: "a" | "b" | "draw", scoreA, scoreB }` using
    `computedOutcome(direction, { drawsAllowed: true }, …)` from
    `src/lib/series/input.ts` and `parseScore` (R2).
  - `rules.ts` (client-safe): `LeagueRecordFacet` `{ runs, closed,
    selfReport, linked, scoring, match: { a, b } | null }` and
    `leagueRecordError` (closed → `COMPETITION_CLOSED`; missing Match;
    bye → "A bye has no result."; `runs` passes; else `SELF_REPORT_OFF`,
    `NOT_LINKED`, `NOT_A_PLAYER` with the Team rule of `series/log-rule.ts`
    `onSides`); the same rule for edit and clear (decision 8, spec B).
    `pairError` / `pairNextError` (≥ 2 Entrants; Swiss: every Match of the
    latest round has a result, rounds left, `roundsError`); `swapError`
    (R7); `clearPairingsError` (R9); `unplayedSummary(matches, config, n)`
    (R10's refusal copy).
- **P3a Scoping (red-team W7).** Every League read and write filters
  on the Match id **and** the Competition id from the request **and** the
  War Week (`src/mutations/series.ts` precedent); a mutation vitest posts
  another Competition's Match id and is refused. `pairNextError`'s
  "every Match has a result" ignores byes and sit-outs (R4), with a test
  on a round holding a bye (M5).
- **P4 Server.** `src/queries/league.ts` (`getLeagueView(competitionId,
  email)`: config, Entrants, rounds with Matches and per-Match
  `canRecord` / `canClear`, standings with Provisional points
  (`pointsFor(leaguePlacings)`, or `entryPointsFor` once Closed), your
  next Match, offers and their disabled reasons; `getLeagueRecordFacts`;
  `getLeagueStandings` for Close). `src/mutations/league.ts`, each in a
  transaction under `lockedCompetition` (`FOR UPDATE`):
  `pairLeague` (round 1 / round robin: shuffle Seed Positions, insert
  rows), `pairNextRound`, `swapPairing`, `clearPairings`,
  `recordLeagueResult` (insert or overwrite; sets `recorded_at` now and
  the recorder), `clearLeagueResult`. `src/actions/league.ts` through
  `guarded` and `src/auth/authorize.ts` (ADR 0003 order; authorize before
  parse). Access (`src/lib/access.ts`): `league.pair` (Organizer or that
  Competition's Host; covers pair, pair next, swap, clear pairings) and
  facet-bound `league.record` / `league.clear` (target
  `leagueRecord`), evaluated before the Organizer shortcut like
  `series.*`.
- **P5 Plug-ins to existing modules.**
  - Close: `leaguePlacingsNow(rows, entrants, rules)` in
    `placings-now.ts` (R10's refusal; points to each Entrant's Team or
    Participant by scoring), a `league` branch in `close.ts`
    `placingsNow`; `generatedNote` "From league".
  - Locks (`competition-locks.ts`, `queries/competition-locks.ts`):
    `CompetitionResults` gains `leagueMatches` (rows) and
    `leagueResult` (any result); `hasResult` counts both; `hasPlay`
    League = paired; new field `leagueConfig` with a new lock `"paired"`
    ("Locked once round 1 is paired."), and `entrants` on a League locks
    on paired (a League case in `settingLockReason`) (R1).
  - Score direction on a League locks with "Locked once round 1 is
    paired." (a League case, not `LOCKED_BY_RESULT`; M2). Saving Pairing
    Round robin writes `rounds: null` in the same save, tested (M3).
  - Other Format-specific code (M1): `src/lib/setup.ts` closed guard
    (~955) gets League copy; the seed format's direction / unit rule
    (~186) admits League; `NO_SELF_REPORT` and `POINTS_NO_ENROLL` copy
    name League; `get_placements` and `get_participation` redirect a
    League. League is **not** added to `NO_ENROLL` (a `Partial`, so the
    compiler won't force it).
  - Settings: `leagueConfig` in `COMPETITION_SETTING_FIELDS`,
    `parseCompetitionSetting`, the `write` switch; `formatDefaults` writes
    `DEFAULT_LEAGUE_CONFIG` for League and `league_config = null`
    otherwise (so the CHECK holds on every Format change);
    `shownSettings`: Pairing, rounds, direction + unit, self-report,
    enrollment; `SELF_REPORT_FORMATS` + League.
  - Entrants: `replaceEntrants` gains a `league` path (Teams or
    Participants by scoring, no Squads, ≥ 0, refused once paired);
    `enrollmentUnavailable` allows League; `getEnrollFacts.built` = any
    `league_match` for a League with `ENROLL_CLOSED_PAIRED`
    "Enrollment is closed: round 1 is paired."; the Participant page
    shows `EnrollButton` for League too.
  - Counts that list result tables: `queries/competitions.ts`,
    `finale-slides.ts`, `scored-counts.ts`, `mutations/setup.ts` (delete
    refusal: "N has League Matches. Clear the pairings first." while any
    exists), `open-unscored-competitions.ts` (a League with a result, for
    End War Week's warning), `competition-status.ts` ("Underway · Round n
    of m"; a Closed League with no winner reads "Done" like Placement and
    Bracket), `recent-results.ts` (League as `results-closed`, copy "From
    league").
- **P6 Results table (shared).** `ResultsTable` gains optional stat
  columns: prop `stats?: { id, header, label, fold }[]`, row `stats?:
  Record<string, number | string | null>`; `ResultsColumn` adds
  `` `stat:${string}` ``; `sortResults` / `nextResultsSort` sort them
  (numeric, missing last; start descending). League columns: W · D · L ·
  Match points · H2H · SB (round robin) or Buchholz (Swiss). Below `sm`,
  `fold: true` stats (W, D, L, tiebreaks) fold into one text line under
  the name ("2 W · 1 D · 0 L · SB 4.5") with no sort button, Match points
  stays a column, points fold as today; no sideways scroll at 390. Other
  Formats pass no `stats` and render unchanged (existing R20 e2e and
  vitest are the regression proof). Vitest for `sortResults` on a stat.
- **P7 UI.**
  - Settings fieldset (`competition-settings-form.tsx`): Pairing as the
    shadcn `ToggleGroup` already in the repo (Round robin / Swiss),
    Rounds (Swiss only; number, blank = default, help "Blank: ⌈log₂ N⌉,
    3 for 6 Entrants"), each disabled with R1's reason.
  - Admin run area: `LeagueBuilder` (Entrants via `EntrantsPicker` and the
    per-field save; "Pair rounds" (round robin) / "Pair round 1" /
    "Pair next round" (Swiss, disabled with the reason until the round is
    done or the rounds are used up); "Clear pairings"; Close / Reopen by
    `ConfirmActionButton`; Close disabled with R10's reason naming the unplayed Matches until the League is complete)
    and `LeagueRounds` (each round, each Match "A 1–0 B", "½–½",
    Scores with the unit, "Recorded <time>", **Record result** / Edit /
    Clear, a per-round **Edit pairings** that swaps two Entrants by two
    selects). Record result opens `ResponsiveSheetDialog` (dialog at
    1440, bottom sheet at 390): two fixed rows with Scores, a result
    `ToggleGroup` (A won / Draw / B won) disabled and filled when the
    Scores decide (R2). Buttons: primary `default`, others `outline`,
    icon-only `ghost`; no `cursor-*` classes; results by sonner toast.
  - Participant page: `LeagueView` — Top finishers when Closed (R14), the
    results table with stats and the Provisional badge, a "Your next
    Match" card ("Round 3 · v Ada Anvil", or "Round 3 · You have a bye"),
    the rounds with the viewer's Match highlighted (`data-you`, the
    `YouTag`), and Record result where self-report allows it (P4).
- **P8 MCP.** `src/mcp/league.ts` `toLeagueResult(view, name)` (pure,
  whitelisted fields, names only): `{ found, competition: { name,
  scoring, format: "League", pairing: "round robin" | "swiss", rounds,
  roundsPaired, scoreDirection, scoreUnit, selfReport, closed },
  standings: [{ rank, name, team, wins, draws, losses, byes,
  matchPoints, tiebreaks: { headToHead, sonnebornBerger } | { buchholz },
  points, provisional }], rounds: [{ round, matches: [{ a, b (null for a
  bye), result: "a won" | "b won" | "draw" | null, scoreA, scoreB,
  recordedAt }] }] }`. Registered in `MCP_TOOLS` and `route.ts`;
  `llms-txt.ts` intro and tool list; README and the guide's tool list;
  `get_bracket` / `get_games` redirect (R13). Vitest: a view carrying
  `recorded_by_email` serializes with no `@` and no "email".
- **P9 Seeds.** Seed format (`src/lib/setup.ts` `competitionSeedSchema`,
  `src/seed/schema.ts`): League takes `leagueConfig`, `entrants` (names,
  any count ≥ 2, Teams or Participants by scoring; the Head-to-head
  `.length(2)` stays for Head-to-head) and a War-Week-level
  `leagueMatches: [{ key, competition, round, position, a, b | null,
  result | null, scoreA?, scoreB?, recordedAt? }]` (superRefine: Entrants
  exist, once per round, bye has no result); `closed` / `closedAt` /
  `closedByEmail` extend from Placement to League. Loader (W5, M6): a League's Entrants and Matches
  load only when it has **no Entrant and no `league_match`** yet (so an
  Organizer's own Entrants, pairings or a Clear pairings are never
  overwritten or resurrected); Entrants and Matches insert in one
  statement each, untargeted `onConflictDoNothing`; a seeded result
  without `recordedAt` gets the War Week's `closedAt` or the load time
  (the `league_match_recorded` CHECK); superRefine also refuses a
  rematch. A closed League writes its generated Points Entries through
  `leaguePlacingsNow` with seed keys `league:<competition>:<entrant>`
  (per Entrant; the Placement precedent). Smoke proves a reload over a
  re-paired League changes nothing and doesn't throw. Demo XII (`seeds/demo/xii.json`): **"Chess Round Robin"**,
  5 Participants, all 5 rounds played and Closed (the AC 1 example's
  results, so the page shows H2H and SB at work), and **"Chess Swiss"**, 8
  Participants, 3 rounds, rounds 1–2 played and round 3 paired with one
  result. Scale (`src/seed/scale.ts`, the seed format can't hold 64
  Entrants by hand): **"Blitz Chess"**, a Swiss of 64 of the 100, 6
  rounds, round 1 paired by `pairLeague` with `seededRng`, skipped when
  it has rows. `seeds.test.ts` assertions updated; smoke row counts
  (`expectedXiCounts` / XII and scale queries) gain `league_match`; the
  scale assertions that count Entrants (smoke "100 Participants and 64
  Entrants", `regression-r19-scale`) are updated for Blitz Chess (M7).
- **P10 Banned terms.** Remove League from `banned-terms.test.ts`,
  `CONTEXT.md`'s table and paragraph, the guide, and the copy regexes in
  `src/app/{about,terms,privacy}/page.test.tsx` and
  `organizer-guide.test.tsx`. **Tournament and ELO stay banned**: League
  copy says "chess", never "tournament" or "Elo".
- **P11 Coordination.** A worktree `.claude/worktrees/r24-scale/` on
  `feat/r24-scale` exists at `734f28e7` with no changes yet. If it adds a
  migration, whichever PR merges second renumbers and regenerates the
  snapshot on the latest `staging` (R21 P11). Likely shared files:
  `results-table.tsx`, `bracket-*`, seeds and smoke scale lines.

### Run record

- Integration worktree `.claude/worktrees/r23-league/war-weeker/` from
  `origin/staging` (`734f28e7` or later), database `war_weeker_r23`,
  `SMOKE_PORT=3150`, `E2E_PORT=3250`; workers `war-weeker-<x>` with
  `war_weeker_r23<x>` and ports 3151+ / 3251+. Every command runs with
  `DATABASE_URL=postgres://postgres:postgres@localhost:2345/<db>?sslmode=disable DATABASE_DRIVER=pg`.
  Never the `war_weeker` database or ports 3100 / 3200. No `.env*` read.
- Clear `test-results/` before evidence (R21 could not: if the guard
  refuses again, R23 writes only under `test-results/r23/` and
  `test-results/e2e/regression-r23-*/` and records it). Gate log
  `test-results/r23/gate.log`.

### Slices, order and ownership

Edges: S1 → S2 → {S3 ∥ S4} → S5 → S6. Each slice ends green on
`pnpm typecheck && pnpm lint && pnpm test`; S2 and S4 also run
`pnpm build && pnpm smoke` (no e2e: the League UI is S3's, so their e2e
would fail for S3's reasons; red-team W8); the first full e2e runs on the
integrated S3 + S4 head; the orchestrator
runs `pnpm format:check && pnpm gate` on the integrated head after each
wave.

| Slice | Decisions | Owns | Suggested worker |
|---|---|---|---|
| **S1 Model and engine** | 1, 4–7, schema; P1–P3, R3–R5 | `src/lib/enums.ts`, `src/db/schema.ts`, `drizzle/0034_*` + snapshot, `src/db/migrations.test.ts`; `src/lib/bracket/types.ts` (P2) and every compile-forced Format map; `src/lib/league/*` with vitests (AC 1, 2, 5) | opus (engine, migration) |
| **S2 Server** | 2, 3, 5, 6 (edits), 8, 9; P4, P5, R1, R2, R7–R11 | `src/queries/league.ts`, `src/mutations/league.ts`, `src/actions/league.ts`, `src/auth/authorize.ts`, `src/lib/access.ts`; Close, locks, settings, Format change, enrollment, self-report formats, counts and status modules (P5) with vitests | opus (rules, access) |
| **S3 UI** | 10, 11; P6, P7 | `results-table.tsx` + `src/lib/results-table.ts`; settings fieldset; `league-builder.tsx`, `league-rounds.tsx`, `league-view.tsx`, `league-result-form.tsx`; run area and Participant page branches; competitions badge | sonnet |
| **S4 Seeds, MCP, smoke** | 12, schema seeds; P8, P9 | seed format and loader, demo XII, `scale.ts`; `src/mcp/league.ts`, `route.ts`, `tools.ts`, `llms-txt.ts`, redirects; `scripts/smoke/league.ts` and its calls in `index.ts`, row counts, CHECK proofs, MCP list | sonnet |
| **S5 e2e** | AC 3, 4, 6, 7 | `e2e/regression-r23-*.spec.ts`; `e2e/competition-page.ts` (`FormatName`, `RUN_AREA_TITLE`), `e2e/r21-logging.ts` `addXiCompetition` (`league_config`) | sonnet |
| **S6 Docs and close** | DoD 3, 4; P10 | `CONTEXT.md` (League, Pairing, Round robin, Swiss, Match points, Bye / sit-out, Buchholz, Sonneborn-Berger, head-to-head tiebreak; Format now six; Entrant, Match, Self-report, Enrollment, Settings lock, Close, Results table, Competition status, Recent results; banned table); banned-term scan and copy tests; `/about` (`src/lib/about.ts` League card, `scripts/about-media.ts` still of XII's Chess Swiss, light and dark); `docs/maintainers-guide.md` ("Run a Competition as a League", enrollment, MCP list, banned terms, R23 rollout note); `docs/regression-checklist.md`; `docs/agents/testing.md` smoke and e2e cells; README tool list; `.scratch/backlog.md` R23 line | sonnet |

S3 ∥ S4 share `src/queries/league.ts` (S2 owns it; S3 and S4 only read
it) and `src/lib/setup.ts` (S4 only). Predicted collisions: none in code;
`package.json` untouched.

### Acceptance criteria → verification

All on the integration worktree's database. "vitest" = `pnpm test`;
"smoke" = `pnpm build && pnpm smoke`; "e2e" = `pnpm build && pnpm e2e`
(Chromium, stub sessions, seeds reloaded with `--reset`). Each spec
screenshots with `shoot()` at 1440×900 and 390×844 into
`test-results/e2e/<test>/`. Evidence is invalidated by any later change to
the files it names, `src/lib/league/*`, `src/queries|mutations|actions/league.ts`,
`src/db/schema.ts`, the seeds, or (for e2e) `results-table.tsx` and the
League components (M8).

| AC | Check | Command / spec | Expected | Earliest | Evidence |
|---|---|---|---|---|---|
| 1 Round robin of 5 | vitest | `src/lib/league/pairing.test.ts`, `standings.test.ts` | 5 rounds; each of the 10 pairs exactly once; each Entrant sits out exactly once, worth 0; the fixture below gives ranks A1 B2 E3 C4 D5, MP 2½ 2½ 2 2 1, H2H A 1 B 0 C ½ E ½ D —, SB C 3.25 E 4; a separate fixture ties after H2H and SB and shares the place (1, 1, 3) | S1 | gate.log |
| 2 Swiss of 9 over 4 rounds | vitest | `pairing.test.ts` (engine), `standings.test.ts` (fixed fixture) | Engine, results from a seeded PRNG over 200 runs and a fixed run: no rematch, every Entrant once per round, the bye each round to the lowest-ranked Entrant without one, worth 1, never twice; plus 64 Entrants × 6 rounds pairs every round within a search-step budget (counted, not timed; M8). Buchholz on the fixed fixture below matches the hand-worked table | S1 | gate.log |
| 3 Swiss League run to Close, 6 Entrants | e2e | `regression-r23-league-swiss.spec.ts` | As an Organizer: Add Competition → Format League, Pairing Swiss (UI); 6 Entrants by `ParticipantPicker`; Pair round 1 (3 Matches); results recorded including a Draw; Pair next round to round 3 (default ⌈log₂ 6⌉); Close is disabled with R10's reason before the last round is played, then Closes; `xiParticipantPointsBreakdown` shows each placed Entrant's Placement Points "From league"; Reopen removes them; Record result as a dialog at 1440 and a bottom sheet at 390 | S5 | screenshots `test-results/e2e/regression-r23-league-swiss-*` |
| 4 Self-report | e2e; smoke over HTTP | `regression-r23-league-self-report.spec.ts`; `scripts/smoke/league.ts` | On: a player records their own Match from the Participant page; the other player can edit it; a non-player sees no Record result and a direct action call is refused with `NOT_A_PLAYER`. Off: the player and the non-player are both refused (`SELF_REPORT_OFF`) | S5 (e2e), S4 (smoke) | screenshots; gate.log |
| 5 Score decides | vitest | `src/lib/league/result.test.ts` | higher and lower: the better Score wins; equal Scores → draw; a posted result against the Scores refused (R2); direction none needs a picked result | S1 | gate.log |
| 6 Pairing edits | e2e (+ vitest backstop; smoke over HTTP is written in S4) | `regression-r23-league-swiss.spec.ts` (round 1 before and after a result); `src/mutations/league.test.ts` | Before any result: Edit pairings swaps two Entrants and the round shows the swap. After one result: the control is disabled with "A Match in this round has a result."; the server refuses the same swap (mutation vitest, and smoke over HTTP) | S5 | screenshots; gate.log |
| 7 Participant page | e2e | `regression-r23-league-page.spec.ts` | On a round robin made by SQL with results: the table headers Rank, Participant, W, D, L, Match points, H2H, SB, War Week points with the Provisional badge; every header sorts; the rounds; "Your next Match" names the round and opponent for a linked Participant; no sideways scroll at 390; axe (wcag2a/aa, no contrast violation) in light and dark | S5 | screenshots, axe JSON |
| 8 MCP, no `@` | smoke; vitest | `scripts/smoke/mcp.ts` (`get_league` on Chess Swiss and Chess Round Robin; tool list); `src/mcp/league.test.ts` | Pairing, rounds, Matches with results, standings with tiebreaks; no `@` anywhere in the output; `get_bracket` / `get_games` redirect | S4 | gate.log |

Fixtures for AC 1 and 2 (written into the tests as data, hand-worked here):

- **Round robin A–E** (results): A beat B, A–C draw, A beat D, E beat A,
  B beat C, B–D draw, B beat E, C beat D, C–E draw, D–E draw. MP: A 2½,
  B 2½, C 2, E 2, D 1. A and B tie: H2H A 1, B 0 → A 1st, B 2nd. C and E
  tie, H2H ½ each → SB: C = D 1 + ½·A 2½ + ½·E 2 = 3.25; E = A 2½ + ½·C 2
  + ½·D 1 = 4 → E 3rd, C 4th. D 5th.
- **Swiss 1–9, 4 rounds** (a/b = first/second won, d = draw, — = bye):
  R1 1–5 a, 2–6 d, 3–7 a, 4–8 b, 9 —; R2 1–3 a, 8–9 d, 2–5 a, 6–7 b, 4 —;
  R3 1–8 d, 2–9 b, 3–6 a, 7–4 a, 5 —; R4 1–9 a, 8–3 b, 7–2 d, 4–5 d, 6 —.
  MP / Buchholz: 1 3½ / 9; 3 3 / 9½; 7 2½ / 8; 9 2½ / 7½; 8 2 / 10½;
  2 2 / 8; 6 1½ / 7½; 5 1½ / 7; 4 1½ / 6. Ranks 1, 3, 7, 9, 8, 2, 6, 5, 4.

Extra checks for decisions without an AC:

- **Schema parity** (P1): `test-results/r23/schema-parity.txt` empty but
  drizzle's bookkeeping; `pnpm db:generate` "No schema changes".
- **Seeds twice; CHECKs** (DoD 2): smoke loads every seed twice with no
  row count change (`league_match`, `entrant`, generated Points Entries
  included) and proves each new CHECK by a refused insert
  (`competition_league_config_league`, `competition_league_config_shape`,
  `league_match_bye_no_result`, `league_match_recorded`,
  `league_match_two_entrants`), and that `competition_self_enroll_bracket_only`
  now admits a League with enrollment and still refuses Head-to-head.
- **Format plumbing** (P2): vitest per pure switch for `league`
  (`generatedNote`, `competitionStatus`, recent-results kind, `hasPlay`,
  `settingLockReason` R1 cases, `enrollmentUnavailable`); the R21
  settings e2e (each Format's settings opened) includes League.
- **No email on League pages** (red-team W6): `scripts/smoke/pickers.ts`
  extends to XII's Chess Swiss and Chess Round Robin, Participant page and
  admin page, HTML and `RSC: 1` payload, as an Organizer and as a Host.
- **Banned terms** (P10): `banned-terms.test.ts` passes with League
  removed; no "tournament" or "Elo" in new copy.

### Definition of Done → plan

| DoD | Where |
|---|---|
| Red-team before implementation | This plan (red-team record below) |
| Migration and demo seed together; smoke on seeded local Postgres | S1 + S4; gate after S4 and S6 |
| `CONTEXT.md` terms; League off the banned list | S6 (P10) |
| `/about` card and still, guide, regression checklist | S6 |
| e2e screenshots 1440 and 390 committed under `test-results/e2e/` | S5; committed in the closeout |
| `pnpm format:check && pnpm gate`; CI on the PR | S6, then PR |

### Fixtures and cleanup

- e2e specs create their own XI Competitions (`E2E R23 … ${Date.now()}`),
  hosted by the e2e Host, Entrants from the XI roster, and delete them in
  `finally` (team rule: own or restore); Participants via
  `participantPageAs`, whose `close()` restores emails. The AC 3 spec
  creates its League through the UI, the AC 4 and AC 7 specs by SQL
  (`addXiCompetition` with `league_config`).
- Smoke uses its own `smoke-League` Competition in XI, created and deleted
  in the step, and reads XII's seeded Leagues read-only.
- No external dependency: no fixture outside local Postgres.

### Human-gated items

- **PR review and merge** into `staging`; CI green.
- **Staging and production after merge**: Paul runs `migrate.yml`
  (additive 0034: enum value, column, table, CHECKs) then `seed.yml` for
  the XII demo. Post-check: `/xii/competitions` lists Chess Round Robin and
  Chess Swiss, both pages answer 200, MCP `get_league` answers. Rollback
  note: an older deploy can't read a `league` Competition (no Format
  branch), so roll back only after deleting League Competitions.

### [SCOPE CHANGE] Close waits for a finished competition (Paul, 2026-10-04, Q3)

Paul: "In the case of any competition type where there is a 'final'
(brackets, this new tournaments) we shouldn't allow closing until they
have been completed. Same with Head to Head best ofs."

- **League:** R10 above (amends spec decision 9).
- **Bracket:** already refuses Close until every Match is played
  (`bracketPlacingsNow`, `FINISH_EVERY_MATCH`). No change; S2 adds a
  regression vitest only if none exists.
- **Head-to-head (new, outside the League spec):** Close is refused until
  the series is **decided** (a majority of the Best of, `bestOfWinner`)
  or **drawn** (every Match played with no majority, draws allowed). Same
  one-line reason on the page (Close disabled) and the server ("Finish
  the series before closing."). Owned by S2 (`placings-now.ts` /
  `close.ts`, vitests in `placings-now.test.ts` and
  `src/mutations/close.test.ts`), with existing tests, e2e and seeds that
  Close an undecided series updated to finish it first. S3 disables the
  Close button with the reason. S6 updates `CONTEXT.md` (Close, Best of,
  Series view: drop "one Closed early with equal wins"),
  `docs/maintainers-guide.md` and `docs/regression-checklist.md`.
- **Placement, Best score, Participation:** no "final"; unchanged.
- New criterion **SC1**: vitest (`placings-now.test.ts`, `close.test.ts`):
  closing an undecided Head-to-head series is refused and writes nothing;
  a decided series and a drawn series close; a League with an unplayed
  Match or an unpaired Swiss round is refused; a complete one closes.
  Evidence gate.log; earliest S2; invalidated by changes to
  `placings-now.ts`, `close.ts`, `src/lib/series/*`, `src/lib/league/*`.

### Paul's answers (2026-10-04)

- **Q1:** Score unit and self-report stay changeable; they do not lock
  when round 1 is paired (R1 as written; self-report locks only while
  Closed, as on every Format).
- **Q2:** Yes, add "Clear pairings" (R9).
- **Q3:** No Close until complete, for League, Bracket and Head-to-head
  Best of ([SCOPE CHANGE] above; R10).
- **Q4:** Allow round-robin swaps, with a warning naming the repeated
  and never-meeting pairs (R7).

### Questions for Paul before approval (red-team W1, W3), answered above

- **Q1 (R1).** Spec decision 11 says settings lock once round 1 is
  paired and lists unit and self-report among the settings. Plan: Pairing,
  rounds, Score direction and Entrants lock then; **Score unit never
  locks and self-report locks only while Closed**, as on every other
  Format. Accept, or lock unit and self-report too?
- **Q2 (R9).** Add **"Clear pairings"** (Organizer or Host, only while no
  Match has a result) so a wrong Entrant list or setting can be fixed
  after pairing? Without it, Entrants and settings can't change once
  round 1 is paired, short of deleting the Competition.
- **Q3 (R10).** Refuse **Close when no Match has a result** (otherwise
  everyone ties for 1st and takes 1st's points)? Closing with some
  Matches unplayed stays allowed with the warning (decision 9).
- **Q4 (R7, W3).** In a **round robin**, a swap can make two pairs meet
  twice and two never meet. Plan: allow it and have the Edit pairings
  dialog name those pairs before saving. Alternative: refuse a swap that
  creates a repeat in a round robin.

# Execution record — Epic E: Bracket formats, milestone slice

Contract: [`E-bracket-formats-milestone.md`](./E-bracket-formats-milestone.md), which
fixes the slice of ticket [`16`](../issues/16-bracket-formats-in-usage-order.md)
whose stable requirements are the brackets spec (`.scratch/brackets/spec.md`:
stories 10, 11, 15–18, 22; "Engine" and "Schema" decisions) as amended by
the spec's Decisions (single-stage schema W5, random seeding W2, placings only)
and by hardening decisions 4 and 7 (`.scratch/hardening/spec.md`). T10 was dropped
and the per-heat/both points modes removed on 2026-09-26 (epic "Scope
changes").

## [EXECUTION PLAN]

### Intent

One more Format, Heats, on the Bracket engine that single elimination already
runs on, without changing how single elimination behaves, plus a warning so an
Organizer can't end a War Week with an unfinalized Bracket by accident. Heats
are the most-used multi-entrant shape in past War Weeks (Catan tables every
year, Mario Kart, poker, the four-way Beyblade arena).

### Repository areas, interfaces and domain concepts

| Area | Files | Change |
|---|---|---|
| Enums and schema | `src/lib/enums.ts`, `src/db/schema.ts`, `drizzle/0011_*` | `COMPETITION_FORMATS` gains `heats`; `competition.bracket_config jsonb`; `heat.slot_count`; the `heat_entrant` slot check widens |
| Engine (pure) | `src/lib/bracket/{types,engine,view,points,input}.ts` and new `formats.ts`, `heats.ts`, `config.ts` | Format modules behind one dispatcher; the `Bracket` value carries its Format and config; every Heat is built at Generate |
| Queries and mutations | `src/queries/brackets.ts`, new `src/queries/unfinalized-brackets.ts`, `src/mutations/brackets.ts`, `src/lib/setup.ts` (`parseCompetitionInput` strips `bracketConfig` like `format`) | Load Heats of any size; dispatch by Format; save config; `saveBracket` matches Heats by id |
| Actions and input | `src/actions/brackets.ts`, `src/lib/bracket/input.ts` | `setCompetitionFormat` takes the config; Heat Results of N Entrants |
| Lifecycle | `src/queries/unfinalized-brackets.ts`, `src/app/admin/setup/page.tsx`, `src/components/war-week-lifecycle-controls.tsx` | The End War Week dialog names unfinalized Brackets |
| UI | `src/components/bracket-builder.tsx`, `bracket-results.tsx`, `bracket-view.tsx`, `organizer-guide.tsx`, `src/lib/bracket/view.ts` | Format option and config form; finishing-order Heat Result sheet; place numbers |
| Seeds | `competitionSeedSchema` in `src/lib/setup.ts`, `src/seed/load.ts` | The widened Format enum flows through; an optional `bracketConfig` per Competition, insert-only like `format` |
| Docs and showcase | `CONTEXT.md`, `docs/maintainers-guide.md`, `README.md`, `src/lib/about.ts`, `public/about/brackets.png` (via `scripts/about-media.ts`) | Glossary, Bracket rules, seed idempotence rules, guide, About card |
| Tests | `src/lib/bracket/*.test.ts`, `src/mutations/brackets.test.ts`, `src/queries/unfinalized-brackets.test.ts`, `e2e/bracket-heats.spec.ts`, `scripts/smoke/brackets.ts` | see the verification map |

Domain terms (CONTEXT.md): **Format** gains `heats`; **Bracket** becomes "the
Rounds and Heats of a non-`points` Competition" (Heats may hold more than two
Entrants). No Stage or Group terms come in with this slice. No term in the
banned list is introduced.

### Decisions resolved for this plan

Each is the planner's reading of the contract. Paul confirmed on 2026-09-26:
decision 1 (approved), 7 (remove per-heat/both), 8 (no seeded Bracket),
10 (planner's call), and dropped T10.

1. **Heats stop "until one Heat is left"**, not after a fixed number of
   Rounds (spec story 10 offers both; the scope rule prefers the smaller
   control). Config: Entrants per Heat, S (2–8), and how many advance from
   each, A (1 to S−1). **The last Round is the first one whose remaining
   count is ≤ S; it is always one recordable Heat, never a bye**, and its
   order is the final placing. Every earlier Round must send fewer Entrants
   on than it received; a config that can't (for that Entrant count) is
   refused at Generate with "With N Entrants, S per Heat and A advancing,
   Round r would never end. Lower how many advance." — e.g. 4 Entrants, 3
   per Heat, 2 advance.
2. **Balanced Heats.** A Round with N Entrants has ⌈N/S⌉ Heats and the
   Entrants are dealt snake-style by rank, so Heat sizes differ by at most
   one. Every Round's Heats and their `slot_count`s follow from N, S and A,
   so **all Rounds are built at Generate** (later Rounds with empty slots;
   a Round may hold a one-slot Heat). A non-final Heat with no more
   Entrants than A is a bye: decided when its Round is filled (Round 1 at
   Generate, later Rounds when the previous Round completes) with places by
   rank; its Entrants advance and it's never recordable. That is the Heats
   Format's own bye rule (`engine.isBye` is single elimination's); `generate`
   bounds the Rounds it builds, so a wrong rule fails a test instead of
   hanging.
3. **Advancers are ranked by place, then by Heat position** (all 1sts in
   Heat order, then all 2nds…), and dealt into the next Round's pre-built
   Heats in snake order once every Heat of the Round is decided. That is
   the spec's "snake-seeded". Until then, an Entrant who has already
   advanced sees "Advanced to Round r+1 · waiting for Round r to finish".
   Round fills are computed from whole-Round results, so Heats Format Heats
   have `winnerTo = null`.
4. **Final placings:** the final Heat's places are 1st…kth; every other
   Entrant is tied at the place after those still in when it went out
   (eliminated in Round r ties with everyone eliminated in Round r), matching
   the existing single-elimination rule of "tied by the Round lost in".
5. **Forfeits in a multi-entrant Heat:** forfeiters finish behind every
   non-forfeiter, in the tapped order among themselves; the top A places
   advance, so a forfeiter advances only when fewer than A Entrants didn't
   forfeit (the next Heat's slots are pre-built and must fill); not every
   Entrant may forfeit. Heat Results need a clear order: no ties. Goes into
   CONTEXT.md "Bracket rules".
6. **Reset rule:** when a decided Heat's result changes and the next Round
   is already filled, the fill is recomputed; if the advancers or their
   order differ, every later Heat is emptied and the ones that had a Heat
   Result are the reset list the confirm names. A score-only edit that keeps
   the order resets nothing (ticket 07's rule).
7. **Per-heat and both points are removed** (Paul): Bracket points come
   only from placings through the Competition's Placement Points (past
   multi-entrant games paid only 1st place). This epic stops the code
   reading or writing `bracketPoints` (`input.ts` `formatSchema`,
   `mutations/brackets.ts` `setCompetitionFormat`, `queries/brackets.ts`,
   `schema.ts`'s column mapping stays until the drop). The column and the
   `bracket_points` type are dropped in a later migration once this is on
   `main` (expand/contract: dropping them in 0011 would break an Instant
   Rollback to a build that selects the column). `BRACKET_POINTS` in
   `enums.ts` stays only as the column's type until then.
8. **No seeded Bracket in XI** (ticket 16 "Seeds"; Paul has no history for
   one). The Playwright flow and the About still build their Brackets
   through the app, as today.
9. **End War Week warns; it never refuses.** Smoke's lifecycle check ends
   XI with live Brackets around, and an Organizer may have a reason. The
   dialog names each unfinalized Bracket ("Not finalized: Pool, Speed
   Chess. Their placings aren't in the Standings until you finalize
   them.").
10. **Config lives in `competition.bracket_config jsonb`** (spec "Schema"),
    validated by a per-Format zod schema in `src/lib/bracket/config.ts`, with
    the default (`heats`: 4 per Heat, 2 advance) applied when the column is
    null, so a seed or an older row still generates. It is insert-only in
    the seed loader, like `format`. Saving a different config clears the
    Heats (with `force` once results exist, as Generate does); changing the
    Format sets it to null. **Single-stage rows stay** (W5): `heat` gains
    only `slot_count smallint not null default 2`; its unique key stays
    `(competition_id, round, position)`; `heat_entrant`'s check becomes
    `heat_entrant_slot_from_0` (`slot >= 0`). No `stage` or `pool` column
    and no stage/round tables until a Format needs them.
11. **Format labels:** "Points", "Single elimination", "Heats".

### Design: the engine seam

`src/lib/bracket/types.ts`:

- `Bracket` becomes `{ format: BracketFormat; config: BracketConfig; heats: Heat[] }` where `BracketFormat` is `Exclude<Format, "points">`.
- `Heat` keeps `slots: HeatSlot[]` (length = `slot_count`); `HeatSlot.place` is 1…n.
- `FormatEngine` is the interface every Format module exports:

```ts
type FormatEngine = {
  validateConfig(config, entrantCount): string | null   // the Generate refusal
  generate(config, entrants, newId): Bracket            // every Heat of every Round
  applyResult(bracket, heatId, result): Bracket
  resetByResult(bracket, heatId, result): string[]      // later Heats with a result that this result would clear
  isRecordable(bracket, heatId): boolean
  isBye(bracket, heat): boolean                         // each Format's own rule
  hasResults(bracket): boolean                          // byes and empty pre-built Heats don't count
  isComplete(bracket): boolean
  champion(bracket): string | null
  finalPlacings(bracket, entrants): Placing[]
}
```

`src/lib/bracket/formats.ts` is the only module the mutations, queries,
`view.ts` and components call for Format-dependent behavior (today
`bracket-results.tsx`, `bracket-builder.tsx`, `bracket-view.tsx` and
`view.ts` import `isBye`/`isDecided`/`resetByResult` from `engine.ts`; D5
moves them): it exposes the same functions and delegates by
`bracket.format` (or the `format` argument to `generate`) to `engine.ts`
(single elimination, unchanged apart from filling two slots) and `heats.ts`.
The single-elimination branch of `resetByResult` keeps ticket 07's
semantics by taking the result's first non-forfeit as the winner; the
existing `engine.resetByResult(bracket, heatId, winnerId)` stays for its
tests and is wrapped.

`src/lib/bracket/config.ts`: `bracketConfigSchema(format)`, `defaultConfig(format)`, `configOf(competition)` (column or default), and the option labels the builder shows. The snake deal lives in `heats.ts` (its only user).

`src/lib/bracket/view.ts`: `Format` is derived from `COMPETITION_FORMATS`; `formatLabel` covers the three; `roundName`/`heatName` take the Bracket ("Round 1 Heat 3", "Final"; "Semifinal" only in single elimination); `nextHeatFor` returns `opponentIds: string[]` and the "advanced, waiting for Round r" state.

`src/lib/bracket/points.ts` is unchanged (placings only).

`src/queries/brackets.ts`: `loadBracket` reads the Competition's `format`
and `bracket_config`, orders Heats by `(round, position)` as today and
builds `slots` from `slot_count`. `src/mutations/brackets.ts`: `saveBracket`
matches Heats by id and refuses (throws, a programming error) if the set of
Heat ids differs; `insertBracket`/`insertSlots` write the new column.

### Ordered steps and dependencies

Waves are the delegation structure; the orchestrator decides models per
packet and gives parallel packets their own worktrees under
`.claude/worktrees/hardening-e/`. Every packet ends with
`pnpm format:check && pnpm typecheck && pnpm lint && pnpm test` (format
before lint, `docs/agents/testing.md`); the full gate runs at the end of
waves 3 and 5, plus `pnpm format:check` before the PR (CI runs it).

**Wave 1 (two packets, no shared file; one local database, so D1's DB
test run waits until D2 has recorded its migration proof)**

- **D1 End War Week warning.** `getUnfinalizedBrackets(warWeek)` in a new
  `src/queries/unfinalized-brackets.ts` (Competitions of the War Week with
  `format <> 'points'`, `finalized_at is null`, and at least one `heat`
  row, by name) with a DB test (rolled back; the test proves a finalized
  and a `points` Competition are excluded); `src/app/admin/setup/page.tsx`
  loads it for Organizers when `status === "live"` and passes
  `unfinalizedBrackets: string[]` to `WarWeekLifecycleControls` →
  `EndWarWeekButton`, whose `ConfirmDialog` `description` adds the warning
  (decision 9). The Playwright assertion lives in D6.
- **D2 Schema, enums, config, types, the dispatcher skeleton and the
  migration proof.** Decision 10 in `src/lib/enums.ts` and
  `src/db/schema.ts`; `pnpm db:generate` → `drizzle/0011_<name>.sql` (never
  hand-edited; drizzle-kit emits the `ALTER TYPE … ADD VALUE` statement,
  the column adds, the constraint drop/add pair). `src/lib/bracket/config.ts`
  with tests; `types.ts` per the seam (`FormatEngine` included);
  `formats.ts` dispatching only to `engine.ts`, which learns `slot_count`
  so every existing engine test passes with only added fields in its
  fixtures; `loadBracket`, `insertBracket`, `insertSlots`, `saveBracket`
  per the seam; `parseCompetitionInput` strips `bracketConfig`;
  `competitionSeedSchema` accepts an optional `bracketConfig` validated
  against its `format`, and `syncCompetitions` inserts it insert-only.
  **Migration proof (W7), done first, before any code change:** with the
  unmodified checkout at 0010, build a single-elimination Bracket with
  results on the local database (the SQL in `scripts/about-media.ts`
  `setupBracketDemo`, or the smoke loop without its cleanup) and dump
  `loadBracket`'s JSON (or a raw `select` of `heat` and `heat_entrant`) to
  `test-results/hardening-e-migrate/before.json`. Then implement, run
  `pnpm db:migrate`, and assert the same Heats load with two slots
  (`after.json`, compared in `migrate.txt`); then
  `pnpm seed:load --reset seeds/*.json` and `pnpm seed:all` again. Save the
  command output and the generated SQL to `migrate.txt`, and check that no
  statement other than `ALTER TYPE … ADD VALUE` references `'heats'` (a
  value added by `ALTER TYPE` can't be used in the same transaction).
  Files: the above plus `src/seed/load.ts`, `src/seed/schema.test.ts`,
  `src/queries/brackets.ts`.

**Wave 2 (one packet, on D2)**

- **D3 Heats engine.** `src/lib/bracket/heats.ts` + `heats.test.ts`
  exporting a `FormatEngine` (not yet wired) per decisions 1–6:
  `validateConfig` and `generate` table-driven over 2–17 Entrants × S 2–8 ×
  A 1..S−1 (every accepted combination terminates with one final Heat of
  ≤ S; every refused one names the Round; the Heat sizes differ by at most
  one; Round-1 slots are filled by snake; later Rounds are built empty,
  including one-slot Heats; Round-1 byes decided), Round fill by
  rank-then-snake once a Round completes with later-Round byes decided at
  fill (table-driven over the same ranges), `applyResult` (full order,
  forfeits per decision 5), `resetByResult` (order-preserving edit resets
  nothing; a changed advancer set or order empties later Rounds and lists
  the decided ones), `isRecordable`, `hasResults` (byes and empty Heats
  excluded), `isComplete`, `champion`, `finalPlacings` with tied places;
  `pointsFor` over those placings (`points.test.ts` gains a Heats case).

**Wave 3 (one packet, on D3)**

- **D4 Wiring, mutations, actions, input and DB tests.** `formats.ts`
  dispatches to both engines. `input.ts`: `parseFormatInput` takes
  `config` validated with `bracketConfigSchema(format)`;
  `parseHeatResultInput` accepts a finishing order of N Entrants.
  `mutations.setCompetitionFormat` saves `bracketConfig` per decision 10
  (refused while finalized: `FINALIZED`; clears Heats, `force` once results
  exist); `generateBracket` calls `validateConfig` then `generate`;
  `recordHeatResult` passes the result to `resetByResult`;
  `finalizeBracket` and `getBracket`'s `champion` go through `formats.ts`.
  Decision 7: `bracketPoints` leaves `formatSchema`, `setCompetitionFormat`
  and `loadBracket`'s select (`schema.ts` keeps the column).
  DB tests in `src/mutations/brackets.test.ts`: a Heats Bracket generates,
  records a full run (including a multi-entrant forfeit), finalizes to the
  expected "From bracket" rows; config saved and cleared; refusal cases;
  the existing two-connection finalize race still passes; `gate.txt` must
  show these DB tests ran, not skipped. Smoke: `scripts/smoke/brackets.ts`
  adds `assertHeatsLoop` with its own team Competition "SMOKE TEST heats"
  and the same two extra Teams (4 Teams, S 4, A 2 → one Final of four),
  records one four-Entrant result with Red first, finalizes, asserts the
  champion on `/xi/competitions/<id>` and Red's leaderboard delta, then
  un-finalizes and cleans up with its own delete. Then `pnpm gate`.

**Wave 4 (one packet, on D4)**

- **D5 UI.** Builder: `FORMAT_OPTIONS` from `COMPETITION_FORMATS`; a config
  `<form>` on `useActionState` + the shared zod schema (ADR 0004) with
  shadcn `Select`s from `config.ts` labels, shown for Heats, disabled while
  finalized; the "how many advance" options that `validateConfig` would
  refuse for the saved Entrant count are disabled with the refusal as their
  hint (the same function, so no second rule); and a Preview of Round 1
  after Generate. Every component and `view.ts` import Format-dependent
  helpers from `formats.ts`, not `engine.ts`. Results: the Sheet for a Heat
  with more than two slots is "tap Entrants in finishing order" (numbered
  chips that fill 1, 2, 3… with an undo per tap), scores per Entrant, a
  Forfeit switch per Entrant; the two-slot Sheet is unchanged. `HeatRows`
  shows place numbers for a decided multi-entrant Heat and keeps ✓ for two
  slots. Participant view: "Your next Heat" with several opponents or the
  "advanced, waiting" state. `organizer-guide.tsx` "Running a Bracket"
  describes both Formats. Each screen has zero horizontal overflow at 375
  (checked in D6).

**Wave 5 (one packet, on D5)**

- **D6 Flow, docs, showcase and evidence.**
  - `e2e/bracket-heats.spec.ts`: XI "Settlers of Catan" (5/3/1), eight
    named Participants none of whom has a Catan Points Entry (Anthony
    Conway has one), S 4 / A 2: Round 1 two Heats of four, a Final of four;
    before finalizing, it opens `/admin/setup` → End War Week, asserts the
    warning names "Settlers of Catan", cancels (the D1 check); then
    Finalize and 3 "From bracket" entries on `/xi/competitions/<id>`.
  - The flow runs its screens at 375 and 1280 (screenshots via
    `testInfo.outputPath`) and asserts
    `document.documentElement.scrollWidth <= clientWidth` at 375, 768 and
    1280 on the builder, results and participant view.
  - Docs: CONTEXT.md glossary (Format, Bracket), "Bracket rules"
    (decisions 1–6, 9) and "Seed idempotence rules" (`format` and
    `bracketConfig` insert-only); `docs/maintainers-guide.md` "Run a
    knockout Competition as a Bracket" → both Formats and the
    `formats.ts`/`FormatEngine` seam; `docs/agents/testing.md`'s e2e row
    ("Five browser flows" → six); `src/mcp/llms-txt.ts` (lines 45 and 55
    say single-elimination Brackets); `README.md:3` if it names single
    elimination as the only Format; `src/lib/about.ts` brackets card copy;
    `public/about/brackets.png` regenerated with
    `pnpm tsx scripts/about-media.ts --stills` after `setupBracketDemo`
    builds a Heats Bracket.
  - Final `pnpm gate`; CI on the PR; tracker records (ticket 16's
    `[PROGRESS]` names what this slice delivered).

### Declared scope

In scope: the files named above; `drizzle/0011_*` plus `drizzle/meta/`;
`seeds/*.json` only if the seed schema change requires it (it shouldn't: the
new field is optional).

Out of scope and untouched: T10 (dropped: qualifiers run as a separate
Competition), Stages,
Groups and Group tables, Squads, self-report, Heat times/locations, Now/Next,
MCP tools (`llms.txt` may name the Formats but adds no tool), the Archive
view (it already renders any edition's Bracket through the same page),
seeded Brackets, seeding by Standings or drag, the Finale for a Bracket,
Slack, dropping the `bracket_points` column (a later migration), double elimination, round robin,
`src/lib/access.ts` (the existing `bracket.*` actions cover every write;
Hosts keep their Competition scope), `.env*`.

### Criterion → verification map

Run surface: **local + deployed** (deployed only through the PR's CI on
GitHub; no deploy in this epic). Real dependencies: local Postgres from
`docker compose up -d`; Chromium for Playwright. Fixtures: the XI demo seed
reloaded with `--reset` by `e2e/global-setup.ts` and by smoke; smoke's own
"SMOKE TEST" rows are created and deleted by each check. Evidence root
`test-results/` is cleared at the start of the work package and holds only
this epic's evidence, committed on the branch.

| # | Criterion | Check | Expected | Evidence | Earliest checkpoint | Invalidated by |
|---|---|---|---|---|---|---|
| 1 | Engine tests for Heats | `pnpm test src/lib/bracket` | pass; the table-driven ranges in D3 are present, and one hand check: break a rule (e.g. drop the "every Round eliminates" refusal) and see its test fail | `test-results/hardening-e-gate/gate.txt`; `test-results/hardening-e-focus/engine-probe.txt` | end of wave 2 | any change under `src/lib/bracket/` |
| 2 | Single elimination unchanged | existing `engine.test.ts`, `view.test.ts`, `mutations/brackets.test.ts`, smoke `bracket loop`, `e2e/bracket.spec.ts` | pass; `git diff staging -- src/lib/bracket/engine.test.ts src/lib/bracket/view.test.ts src/mutations/brackets.test.ts e2e/bracket.spec.ts scripts/smoke/brackets.ts` shows only added fields or added cases, no changed expectation | gate.txt; `test-results/hardening-e-gate/single-elim-diff.txt`, reviewed in the closeout | wave 1 (D2) then every wave | engine, mutation, query or UI changes |
| 3 | Playwright Heats flow finalizing to "From bracket" entries; End War Week warning | `pnpm e2e` | `bracket-heats` passes (3 entries; warning seen and cancelled) | `test-results/e2e/<test>/*.png`, gate.txt | wave 5 | UI, engine, mutation, seed or e2e changes |
| 4 | Screenshots 375/1280; zero overflow 375/768/1280 | the assertions inside the flow | files exist for both viewports; the overflow assertions pass | `test-results/e2e/<test>/*.png`; gate.txt | wave 5 | UI changes |
| 5 | Migration and seeds | D2's migration proof; `pnpm seed:load --reset seeds/*.json && pnpm seed:all`; `pnpm smoke` | a pre-0011 Bracket loads identically after 0011 (`before.json` = `after.json` plus the defaulted column); only the `ALTER TYPE … ADD VALUE` statement names the new enum value; seeds load twice; smoke 0 FAIL, row counts unchanged | `test-results/hardening-e-migrate/{before,after}.json`, `migrate.txt`; gate.txt | end of wave 1 (D2), rerun in waves 3 and 5 | schema, migration, seed schema or loader changes |
| 6 | Docs and showcase current | stale-copy greps, all empty: `grep -rn "single elimination is the only\|only one today\|Five browser flows" docs README.md`; `grep -n "single-elimination" src/mcp/llms-txt.ts`; `grep -rn "or \`single-elimination\` (a Bracket)" CONTEXT.md`; `grep -rn "Format to single elimination" src/lib/about.ts src/components/organizer-guide.tsx`; `git diff --stat staging -- public/about/brackets.png` non-empty; banned-term scan per CONTEXT.md (the full banned list over `src/`, `scripts/`, `drizzle/`) compared with the same scan on `staging`: no new hits | as stated | `test-results/hardening-e-docs/grep.txt` | wave 5 | copy or doc changes |
| 7 | Tracker records | ticket 16 gets a `[PROGRESS]` comment and its `Status:` line is unchanged; the epic file records `[CLOSEOUT]` and `Status: done` in the final commit | present | the files | final commit | — |
| 8 | `pnpm gate` locally and in CI | `pnpm format:check && pnpm gate` (`DATABASE_DRIVER=pg`, local `DATABASE_URL`); GitHub Actions on the PR | exit 0; DB tests not skipped; CI green | `test-results/hardening-e-gate/gate.txt`; `test-results/hardening-e-ci/runs.md` | end of wave 3 (first full gate) and wave 5 (final) | any change |

Human-gated criteria: none. For the later `staging → main` PR: migration
0011 adds an enum value and columns. Instant Rollback to a pre-0011 build is
safe only while no Competition uses the Heats Format (older code treats
every non-`points` Format as single elimination and reads two slots); once
one does, roll forward.

Candidate evidence from planning: none exercised (no commands run against
the database during planning). Baseline: Epic D's gate on `72a8620`
(`test-results/hardening-d-gate/gate.txt`: 82 files / 1411 tests, smoke 177
ok, e2e 22 passed) is the last known green state of `staging`.

### Repository-specific considerations (`docs/agents/planning.md`)

- **Drizzle schema change (confirmed team policy):** red-teamed (record
  below); D2 ships the migration and the seed-schema change together and
  proves a pre-0011 Bracket survives, seeds load twice and smoke passes
  before wave 2 starts.
- **Any vertical slice:** the gate (typecheck, lint, vitest, build, smoke
  with `/xi`, `/xi/leaderboard`, `/xi/finale`, `/api/mcp`, e2e) is criterion 8.
- **MCP tool change:** none; `get_bracket` stays deferred.
- **Auth or access change:** none; no new `WarWeekAction`.
- **Finale change:** none.
- **Showcase rule** (`docs/agents/testing.md` team rule): criterion 6.
- ADR 0001 layering holds: new engine modules are pure (`src/lib/bracket/`
  imports no DB, no `next/*`, types only from `@/db/schema`); the lint rule
  enforces it. ADR 0004: the builder's new config form uses `useActionState`
  and the shared zod schema.

### Open decisions for Paul (defaults apply unless changed in the epic file)

None. Follow-up after this reaches `main`: a `chore/` migration drops
`competition.bracket_points` and the `bracket_points` type (decision 7).

## [RED-TEAM]

2026-09-26, fresh `atlas-red-team-reviewer` on the first draft (then
covering Heats and groups → knockout): `ATLAS_RED_TEAM_BLOCKED`, 4 blocking,
12 warnings, 11 minors. Adjudicated by the planner; every item resolved:

- B1 (the Heats Round rule could loop forever, and the fixtures 6/3/2 hit
  it): decision 1 now ends at the first Round with ≤ S remaining, requires
  every earlier Round to eliminate, refuses otherwise; fixtures are 8/4/2.
- B2 (nothing could save Heats created after Generate): every Heat of every
  Round is built at Generate; transitions fill slots; `saveBracket` matches
  by id.
- B3 (refusing Group ties contradicted spec stories 14 and 23) and B4 (the
  Groups flow never finalized): resolved in that draft; both are moot after
  the T10 cut.
- W1 packet overlap: D1 owns a new query file; D4 owns the `formats.ts`
  wiring; worktrees for parallel packets. W3 forfeits: decision 5. W4
  `isRecordable`/`hasResults` are Format-aware on the `FormatEngine`. W5
  config change clears the draw. W6 rollback wording corrected. W7 migration
  proof on a table holding Heats. W8 banned-term scan per CONTEXT.md against
  a `staging` baseline. W9 `format:check` per packet and before the PR. W10
  criterion 2 reviews the test diffs. W2, W11 and W12 (cross-seeding, Group
  ranges, Stage columns) are moot after the T10 cut.
- Minors applied (smoke loop naming and cleanup, fixed evidence paths, extra
  stale-copy greps, `parseCompetitionInput`, seed idempotence rules, ticket
  16 status unchanged, check rename, `nextHeatFor` advanced state, DB tests
  shown as run).

Second pass, fresh reviewer, on the revision: `ATLAS_RED_TEAM_BLOCKED`,
1 blocking, 6 warnings, 8 minors. The reviewer brute-forced the Heats rule
(every N 2–17 × S 2–8 × A: 318 accepted combinations all end in one final
Heat, 130 refused). The one blocking finding (Group-Stage placings) and the
cross-seeding, stand-in id and Group items are moot after the T10 cut. Kept:
W1 later-Round byes and one-slot Heats (decision 2; `generate` bounds its
Rounds), W3 migration proof first from the unmodified checkout, W4 the SQL
check allows `ALTER TYPE … ADD VALUE`, W5 D1's DB test waits for D2's proof,
W6 the builder disables refused options via `validateConfig`; minors on
`isBye` on the `FormatEngine`, components importing from `formats.ts`,
`docs/agents/testing.md` and `llms-txt.ts` in the docs list, and the Round
bound.

**Scope cut after review (2026-09-26, Paul):** T10 dropped (qualifiers
run as their own Competition before a single-elimination Bracket), and with it
round-robin Groups, Group tables and ties, cross-seeding, Stage placings,
and the `heat.stage`/`heat.pool` columns. The change only removes reviewed
scope; the Heats rules, the seam, the migration proof and the verification
map are as reviewed, so no third pass. The `bracketPoints` code removal (decision 7) deletes an
optional input field that only ever held `placings`; no schema change. The orchestrator re-checks decisions
1–3 against the engine tests at the end of wave 2.

## [PROGRESS]

- 2026-09-27 **Execution structure recorded** (`/atlas-implement`, work package `hardening-e`): waves as planned, six deliverables D1–D6 with edges D2→D3, D1→D4, D3→D4, D4→D5, D5→D6. Wave 1 runs D1 in a worktree (`.claude/worktrees/hardening-e/war-weeker/d1`, branch `feat/hardening-e-bracket-formats-d1`, database `war_weeker_d1`) while D2 runs on the direct checkout; predicted ownership is disjoint (D1: `src/queries/unfinalized-brackets.ts` + test, `src/app/admin/setup/page.tsx`, `src/components/war-week-lifecycle-controls.tsx`; D2: enums, schema, `drizzle/`, `src/lib/bracket/{types,config,formats,engine}`, `src/queries/brackets.ts`, `src/mutations/brackets.ts`, `src/lib/setup.ts`, `src/seed/`). Re-checked at closeout. Every later wave is one worker on the direct checkout. Packet change against the plan: the `bracketPoints` code removal (decision 7) moves from D4 to D2, which already owns every file it touches. Human gates: none. Proof root `test-results/` cleared in `69e86d4`.
- 2026-09-27 **Wave 1 integrated** (`0e90db9` D2, `678743c` D1): migration 0011 proof in `test-results/hardening-e-migrate/`; focused checks in `test-results/hardening-e-focus/wave1.txt`. Approved at the acceptance screen: `src/mutations/brackets.test.ts` "refuses a Heat slot…" now expects slot 2 to be accepted (decision 10's `slot >= 0`); the only changed single-elimination expectation.
- 2026-09-27 **Wave 2 integrated** (`b19d231` D3, the Heats engine). Packet correction: the D3 packet said Heat sizes are bigger-first *and* snake-dealt, which conflict for uneven counts; the engine follows decision 2 (snake deal, sizes differ by at most one), so the extra Entrants can land in the later Heats and the short Heat falls wherever the last partial snake pass ends (e.g. 5 Entrants at 4/2: Heat 1 = Seed Positions 1, 4, 5; Heat 2 = 2, 3, a bye). The 318/130 accept/refuse totals are unchanged. Probe: disabling the "every Round eliminates" refusal makes the suite fail on the Round bound (`test-results/hardening-e-focus/engine-probe.txt`).


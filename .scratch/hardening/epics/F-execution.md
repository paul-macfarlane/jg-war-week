# Execution record — Epic F: Brackets on the day

Contract: [`F-brackets-on-the-day.md`](./F-brackets-on-the-day.md), which
fixes the slice of ticket [`16`](../issues/16-bracket-formats-in-usage-order.md)
whose stable requirements are the brackets spec (`.scratch/brackets/spec.md`:
stories 9 (by Standings only), 13, 22, 24, 25 and 26; its Surfaces decisions
for Now/Next, live refresh and MCP; story 4 of ticket 1 for the Finale of a
Bracket) as amended by ticket 16's 2026-09-27 `[SCOPE CHANGE]` (drag seeding,
round robin and the Archive bracket view cut). Epic E (PR #84) is merged into
`staging` at `aab4b4c`; this branch starts there.

## [EXECUTION PLAN]

### Intent

The Bracket engine and screens from Epics D and E already build, run and
finalize a Bracket. This epic makes a Bracket usable *during* War Week without
adding a Format, a role or a new kind of write: a Heat can carry a Day, start
time and location (so "Your next Heat" and the home page's Now/Next answer
"when and where"); the bracket pages refresh on their own; Claude can read a
Bracket through MCP; a Host can seed by Standings instead of only at random;
and a finalized Bracket's champion can be crowned on the projector the way the
Finale crowns the War Week.

### Repository areas, interfaces and domain concepts

| Area | Files | Change |
|---|---|---|
| Schema | `src/db/schema.ts` (`heat`), `drizzle/0012_*` + `drizzle/meta/` | `heat.day_id uuid null references day(id) on delete set null`, `heat.start_time time null`, `heat.location varchar(200) null`; index on `day_id` |
| Engine types (pure) | `src/lib/bracket/types.ts`, `engine.ts`, `heats.ts` (`generate` only), `view.ts` | `Heat` gains `dayId`, `startTime`, `location` (all `string \| null`); both `generate`s set them null; `isTimed`, `heatEntrantLabels`, `formatHeatWhen`, and `heatNameAt` (the name from `format`, final Round, Round and position; `heatName(bracket, heat)` delegates to it) |
| Seeding (pure) | `src/lib/bracket/seeding.ts` + test, `src/lib/bracket/input.ts` + test | `standingsSeedPositions(entrants, standings, scoring, rng)`; `parseGenerateInput` takes `seeding: "random" \| "standings"` |
| Now/Next (pure) | `src/lib/schedule.ts` + test, new `src/lib/bracket/now-next.ts` + test | `ScheduleEntry` gains `kind?: "heat"` and `entrants?: string`; `heatEntries(rows)` turns timed `ready` Heat rows into entries; `withHeats(days, entries)` merges and re-sorts; `computeNowNext` unchanged |
| Queries | `src/queries/brackets.ts`, `src/queries/schedule.ts`, `src/queries/setup.ts` (`getSetupDays`, existing), `src/queries/competitions.ts` | `loadBracket` reads the three columns; `getBracketEntrants` adds the Participant's Team name; `getTimedHeats(warWeek)` (three light selects, no `BracketView`); `getCompetitionByName(warWeek, name)` |
| Mutations and actions | `src/mutations/brackets.ts` + DB test, `src/actions/brackets.ts` + test, `src/lib/access.ts` + test | `setHeatSchedule(competitionId, heatId, values, ctx)`; `generateBracket` takes `seeding` and loads Standings for "standings"; `WarWeekAction` gains `"bracket.heat-schedule"` (default branch: the row's Host or an Organizer) |
| Heat time form | new `src/components/heat-schedule-form.tsx`, new `src/lib/bracket/heat-schedule.ts` + test (zod + field labels, ADR 0004), `src/lib/setup-schedule-faq.ts` (export `clockTime`), `src/components/bracket-results.tsx`, `src/app/admin/brackets/[id]/page.tsx` | A "Time & place" Sheet per Heat: Day (`OptionSelect`), start time (`TimeCombobox`), location (`Input`), Save, Clear; the page loads the Days with `getSetupDays` |
| Live refresh | `src/components/bracket-results.tsx` split into `BracketResults` (state) and `BracketResultsView` (props only) + `bracket-results.test.tsx` (static render); the participant page already mounts `AutoRefresh` | `AutoRefresh` renders only while no Sheet is open (story 25) |
| Participant view | `src/components/bracket-view.tsx`, `src/app/[edition]/competitions/[id]/page.tsx` | "Your next Heat" and every timed Heat card show Day, time and location; a "Play the Finale" link on the champion card once finalized |
| Home | `src/components/now-next.tsx`, `src/app/[edition]/(home)/page.tsx` | Timed Heats join now/next; a Heat entry shows a "Heat" badge, its opponents line and links to the Competition |
| MCP | new `src/mcp/bracket.ts` + test, `src/mcp/tools.ts`, `src/app/api/mcp/route.ts`, `src/mcp/llms-txt.ts` (+ test if it counts tools) | `get_bracket(competition)` read-only, names only |
| Bracket Finale | new `src/components/use-finale.ts` (the `useFinale` hook moved out of `finale.tsx`), new `src/components/bracket-finale.tsx` (`BracketFinale` state + `BracketFinaleStage` props-only) + `bracket-finale.test.tsx`, new `src/lib/bracket/finale.ts` + test (pure rows), new `src/app/[edition]/finale/[competition]/page.tsx`, `src/app/admin/standings/page.tsx` | A finalized Bracket's placings count in from last to first, ending on the champion |
| Builder | `src/components/bracket-builder.tsx` | "By Standings" beside Generate / Re-roll; confirms before clearing timed Heats |
| Smoke | `scripts/smoke/brackets.ts`, `scripts/smoke/mcp.ts`, `scripts/smoke/hosts.ts` | `get_bracket` over `/api/mcp` with the token inside the bracket loop; `/xi/finale/<id>` 200 after finalize and 404 after un-finalize; `setHeatSchedule` refusals for a Participant and a Host of another Competition |
| Playwright | `e2e/bracket.spec.ts` (extended), `e2e/db.ts` and `e2e/session.ts` (gain `xiParticipantId` and `participantPageAs`, moved from `bracket-heats.spec.ts`, which then imports them) | Host sets a time; Participant sees it in "Your next Heat" and Now/Next (`?at=`); the Bracket Finale plays; screenshots and overflow checks |
| Docs and showcase | `CONTEXT.md`, `docs/maintainers-guide.md`, `docs/agents/testing.md` (e2e row), `README.md` (e2e list; MCP tools if listed), `src/lib/about.ts`, `src/components/organizer-guide.tsx`, `scripts/about-media.ts` (`setupBracketDemo` sets one Heat's time so `public/about/brackets.png` shows it) | Every user-visible change |

Domain terms (CONTEXT.md): **Heat** gains "with an optional Day, start time
(ET, like Schedule Items) and location"; the **Schedule display rules** gain
the Heat now/next rule; **Finale rules** gain the Bracket Finale; **Bracket
rules** gain seeding by Standings, the time-and-place rule and "a re-draw
clears Heat times"; the MCP line in **Access rules** names `get_bracket`. No
new term and nothing from the banned list ("Match", "Tournament" stay out of
the MCP payload keys too).

### Decisions resolved for this plan

Each is the planner's reading of the contract; Paul may overrule any in the
epic file before `/atlas-implement`. Decisions 1, 3, 4, 7 and 9 are listed
under "Open decisions for Paul".

1. **Three nullable columns on `heat`, no check constraint.** `day_id`
   (`on delete set null`), `start_time`, `location`. The form saves Day and
   start time together (zod refine: "Pick a Day and a start time together, or
   clear both."); location may stand alone ("Table 3" for Catan). A Heat is
   **timed** iff `day_id` and `start_time` are both set (`isTimed`). Deleting a
   Day nulls `day_id`, so its Heats become untimed without a new refusal
   (the scope rule prefers not adding one; a Day delete is already refused
   while it has Schedule Items, which is the common case; the seed loader
   upserts Days by date, so a reload keeps their ids). Existing Heats load
   with nulls and behave as today.
2. **The time and place are set from the results screen** (epic Order 1),
   on any Heat that isn't a bye, while the Bracket isn't finalized. A decided
   Heat may still be edited (harmless; it never shows in Now/Next). The
   new `WarWeekAction` `"bracket.heat-schedule"` takes the default branch of
   `can`: an Organizer, or a Host of the row's Competition. The action is
   `setHeatSchedule(competitionId, heatId, prevState, formData)` (the first
   two bound by the form, as `useActionState` passes `prevState, formData`)
   through `bracketWrite`
   (`authorize("bracket.heat-schedule", "competition", competitionId)` runs
   before `heatId` or the input is read, ADR 0003), like `recordHeatResult`.
   The mutation takes the `lockedCompetition` row lock like every Bracket
   write. Refusals: a `heatId` not in that Competition is "That Heat no
   longer exists."; a `dayId` not in the Competition's War Week is "That Day
   no longer exists."; a bye is "A bye isn't played."; finalized is the
   existing `FINALIZED`. A Day deleted between that check and the update
   fails the foreign key and surfaces as the generic "Something went wrong.
   Try again." (accepted: two Organizers racing a Day delete against a Heat
   time is not worth a `for share` lock).
3. **A re-draw clears times.** Generate, Re-roll, By Standings, Save
   Entrants and Save Heat settings delete and rebuild the `heat` rows, as
   today, so their times go with them. `HAS_RESULTS_ERROR` and the mutations
   are untouched (their test expectations stay word for word); the **builder**
   counts timed Heats from the `bracket` it already receives and, whenever
   that count is above zero, puts each of those buttons behind the existing
   `ConfirmDialog` with builder-only copy: "This clears N Heat times." (with
   Heat Results too: "This clears every Heat Result and N Heat times."). No
   timed Heats → no confirm, as today. Recorded in CONTEXT.md.
4. **Only `ready` Heats join Now/Next** (every slot filled, no Heat Result).
   That is one status check: a decided Heat is `played`/`forfeit`; a
   Heats-Format Round not yet filled is `pending`; a bye is never `ready`.
   **Reset Heats (corrected after red-team pass 2):** re-recording a result
   clears the later Heats and then advances the new winner straight in
   (`engine.ts` `clearDownstream` then `advance`; `heats.ts` `clearAfter`
   then `fillNextIfComplete`), so the Heat directly after a re-recorded one
   comes back `ready` with its new Entrants and **shows** (it is the next
   game to play, with the right names). Heats further on stay `pending`
   with empty slots and don't show. The epic's "Reset Heats … drop out" is
   read as the emptied ones; Paul accepted (2026-09-27). A Host may set the Final's time before it is filled; it
   appears in Now/Next once both finalists are known. Timed Heats of a
   finalized Bracket are all decided, so they never show. (Alternative for
   Paul: also show timed `pending` non-bye Heats with "TBD" opponents, which
   would show reset Heats too.)
5. **A Heat's now/next entry** reuses the Schedule Item span rules (no end
   time, so 60 minutes) by mapping each timed `ready` Heat to a
   `ScheduleEntry` with `kind: "heat"`: `id` = the Heat id, `title` =
   "<Competition> · <Heat name>" (e.g. "Beyblades · Semifinal 1"), `entrants`
   = the Entrants line ("Ashley Schuliger vs Sam Schantz"; "Red, Blue, Gold
   and Green" for a Heats Heat, via `heatEntrantLabels`), `location`,
   `category: "competition"`, `competition` set, `startTime` as the row
   returns it (`HH:MM:SS`, the same shape as a Schedule Item's, so "Up next"
   grouping by equal start strings works), `endTime`/`host`/`virtualLink`/
   `description` null. `withHeats` appends each entry under its Day and
   re-sorts by start time then title; `computeNowNext` is untouched, so every
   existing rule (past-midnight, `?at=`, "Up next" sharing the earliest start)
   applies unchanged. A Schedule Item linked to the same Competition is a
   different entry and shows alongside (the contract's "never merged").
   `CompactItem` renders a Heat entry with a "Heat" badge in place of the
   category badge, the `entrants` line under the title, and links the title
   to `/<edition>/competitions/<id>`. `get_schedule` (MCP) and
   `/<edition>/schedule` don't gain Heats: the contract scopes Now/Next only.
   The home page loads Heats with **`getTimedHeats(warWeek)`**, three light
   selects run once per render inside the page's existing `Promise.all`:
   `heat` rows of this War Week's Competitions with `status = 'ready'`,
   `day_id` and `start_time` not null (with the Competition's id, name and
   format); `max(round)` per such Competition (for `heatNameAt`); and the
   `heat_entrant` → `entrant` → Team / Participant labels of those Heats.
   Never a `BracketView` per Competition (the page refreshes every 10 s).
6. **Live refresh never discards an unsaved result.** `bracket-results.tsx`
   splits into `BracketResults` (owns `openSheet: { kind: "result" |
   "schedule"; heatId } | null`) and `BracketResultsView` (props only, no
   state of its own beyond the forms), which renders `<AutoRefresh />` only
   when `openSheet === null`. So a refresh can't run mid-entry; and
   `router.refresh()` keeps client state anyway. The participant page already
   mounts `AutoRefresh`; the results page gets it through `BracketResults` so
   the rule lives next to the Sheets. Test (`renderToStaticMarkup`, the
   repo's component-test style, with `@/components/auto-refresh` mocked to a
   marker element): `BracketResultsView` with `openSheet` set renders no
   marker; with `null` it does.
7. **`get_bracket(competition)` takes a Competition name** in the current
   War Week, like every other tool works on the current War Week.
   `getCompetitionByName`: an exact match wins; else a case-insensitive
   (trimmed) match when exactly one; else `{ found: false, message }`
   (names are unique per War Week only case-sensitively). Payload
   (`src/mcp/bracket.ts`, `toBracketResult(view, days)`): `{ found: true,
   competition: { name, scoring, format, finalized }, entrants: [{
   seedPosition, name, team }], rounds: [{ round, name, heats: [{ name,
   status, date, startTime, location, entrants: [{ name, place, score,
   forfeited }] }] }], champion: name | null }`. A `points` Competition →
   `{ found: true, competition: { name, scoring, format: "points" }, bracket:
   null, message }`; no current War Week → `{ warWeek: null }`. Names only:
   never an email, the Organizer list or Hosts. Byes read `status: "bye"`.
   Times are ET `HH:MM` with the Day's `YYYY-MM-DD` date, like
   `get_schedule`. Registered in `MCP_TOOLS` so `/llms.txt` lists it; the
   llms.txt sentence "there is no MCP tool for Bracket detail yet, so ask
   about a Competition's Standings, not its Bracket" goes.
8. **Seeding by Standings** (story 9 minus drag and Squads):
   `standingsSeedPositions(entrants, standings, scoring, rng)` orders Entrants
   by their rank in the Team Standings (team Competition) or individual
   Standings (individual one); Entrants sharing a rank (ties, and every
   Entrant with no Points Entries, who all tie at zero) are shuffled among
   themselves with `rng` (Fisher–Yates, as `shuffleSeedPositions`); an Entrant
   missing from the Standings goes last, shuffled. `generateBracket` gains
   `seeding` ("random" default, so every existing caller and the smoke loop
   are unchanged); for "standings" it loads the War Week's `mode` by the
   Competition's `warWeekId` and calls `getStandings({ id, mode }, tx)`
   inside the transaction. The builder gets a "By Standings" button beside
   Generate / Re-roll, under the same confirms; the caption reads "Random, or
   by the current Standings (ties drawn at random). Top Seed Positions get
   any byes." The Standings used are the same `getStandings` rows the
   leaderboard shows; nothing is stored beyond Seed Positions.
9. **The Bracket Finale lives at `/<edition>/finale/<competitionId>`**, any
   signed-in JG user, 404 unless that Competition is a finalized Bracket of
   that edition. **The 404 must come from a layout above any loading
   boundary** (red-team pass 2): `src/app/[edition]/finale/loading.tsx`
   would wrap the new segment in Suspense and stream `notFound()` as a 200
   (the repo's rule, `src/app/[edition]/competitions/[id]/layout.tsx:5-9`).
   So the existing `finale/page.tsx` and `finale/loading.tsx` move (unchanged
   except `page.tsx`'s `"../war-week"` import, which becomes `"../../war-week"`)
   into a route group `finale/(standings)/` (same URL, the pattern of
   `competitions/(list)`), and `finale/[competition]/layout.tsx` runs the
   "finalized Bracket of this edition" check and calls `notFound()`; any
   `loading.tsx` for the new page sits below that layout. `src/lib/bracket/finale.ts` (pure): `bracketFinaleRows
   (placings, entrants)` → `[{ entrantId, label, color, place }]` sorted by
   place then Seed Position, and `bracketFinaleRanks(rows)` = their places
   (so `finaleRows` shows tied places together and the champion last).
   `BracketFinale` owns the clock through `useFinale` (moved to
   `use-finale.ts` unchanged; `finale.tsx` imports it; `finale.test.tsx`
   keeps passing) and renders `BracketFinaleStage({ phase, rows, finale,
   competitionName, … })`, props only: `ready` shows the Start button;
   `playing` lists the rows that are shown; `done` lists them all and the
   champion card (🏆, name, "Champion of <Competition>"). No totals to
   count (placings, not points). Start / `Space` / click, Replay and
   `prefers-reduced-motion` are the Finale's, via the shared hook. It reads
   nothing from Standings and writes nothing (Finale rule). Links: the
   champion card on the participant Bracket view ("Play the Finale"), the
   results screen's finalized note, and `/admin/standings` lists "Finale:
   <Competition>" for every finalized Bracket (`getBracketCompetitions`
   filtered by `finalizedAt`), replacing the "will appear here later" line.
10. **"Your next Heat" shows the time and place** under the Heat name:
    "Sunday, Feb 22 · 7:00 PM ET · Main room" (`formatDayHeading` and
    `formatEtTime`, which is what those return), or just the location when
    only that is set; nothing when neither is. Every timed Heat card in the
    Bracket view and results screen shows the same line in small text, so a
    Host can see what's set. `nextHeatFor` is unchanged in shape: the fields
    ride on the `Heat` it returns.
11. **Migration 0012 is generated, never hand-edited** (`pnpm db:generate`),
    and proved like Epic E's 0011: a Bracket with results dumped before,
    migrated, loaded after (nulls added), seeds load twice, smoke passes.
    Instant Rollback to a pre-0012 build is safe: the old code selects
    explicit columns and never the new ones.
12. **Times in the form are `HH:MM`.** Postgres returns `time` as `HH:MM:SS`;
    the form prefills `startTime.slice(0, 5)` for `TimeCombobox`, the zod
    rule is the Schedule Item's `clockTime` (`^HH:MM$`, exported from
    `setup-schedule-faq.ts`), and the mutation stores what zod accepted.
    Unit fixtures for Now/Next use `HH:MM:SS` for Heats and Schedule Items
    alike, as the rows come back.

### Design: the seams

- `Heat` (`types.ts`): `{ id, round, position, slots, winnerTo, status,
  dayId: string | null, startTime: string | null, location: string | null }`.
  Engines copy Heats with `structuredClone`, so the fields survive
  `applyResult`/`resetByResult`; both `generate`s set them null. `saveBracket`
  updates only `status` and slots, so a Heat Result never touches them;
  `setHeatSchedule` updates only the three columns. Hand-built test fixtures
  gain the three null fields (added fields only; criterion 8).
- `view.ts`: `isTimed(heat)`; `heatEntrantLabels(heat, entrantsById)` →
  "A vs B" / "A, B, C and D"; `formatHeatWhen(heat, days)`; `heatNameAt({
  format, finalRound, round, position })` with `heatName`/`roundName`
  delegating (no behavior change; `view.test.ts` unchanged).
- `src/lib/bracket/heat-schedule.ts`: `heatScheduleSchema` (zod: `dayId`
  uuid or "", `startTime` `clockTime` or "", `location` ≤ 200 or ""; refine
  Day and time together), `parseHeatScheduleInput(formData)` and
  `HEAT_SCHEDULE_LABELS` for `FormFieldErrors`. The form posts `FormData`
  through `useActionState` (ADR 0004); server-refused fields show their error
  and take focus like the Schedule Item form.
- `src/lib/bracket/now-next.ts`: `TimedHeatRow` (what `getTimedHeats`
  returns) and `heatEntries(rows): { dayId: string; entry: ScheduleEntry }[]`
  (pure); `withHeats` in `schedule.ts`. The home page:
  `withHeats(schedule, heatEntries(timedHeats))` then `computeNowNext(...)`
  as today.
- `src/mcp/bracket.ts`: `toBracketResult(view, days)` pure; the route resolves
  the Competition with `getCompetitionByName` and calls `getBracket` and
  `getSetupDays`.
- `use-finale.ts`: `useFinale(ranks)` exactly as it is in `finale.tsx`.

### Ordered steps and dependencies

Waves are the delegation structure; the orchestrator picks models and gives
parallel packets their own worktrees under `.claude/worktrees/hardening-f/`.
Every packet ends with `pnpm format:check && pnpm typecheck && pnpm lint &&
pnpm test`; the full gate runs at the end of waves 3 and 4.

**Wave 1 (one packet, direct checkout)**

- **D1 Schema, types, queries, time-and-place write, access.** Decision 1 in
  `schema.ts`; `pnpm db:generate` → `drizzle/0012_<name>.sql`. **Migration
  proof first, from the unmodified checkout at 0011:** a one-off `tsx`
  script in the scratchpad (not committed) that, against the local Postgres,
  creates a team Competition on XI with 4 Teams via `mutations.setCompetition
  Format`/`replaceEntrants`/`generateBracket`/`recordHeatResult`, then dumps
  `loadBracket`'s JSON to `test-results/hardening-f-migrate/before.json`;
  implement; `pnpm db:migrate`; dump `after.json` and compare in
  `migrate.txt` (identical plus three null fields per Heat); delete the
  Competition and its Teams; `pnpm seed:load --reset seeds/*.json && pnpm
  seed:all`; save the generated SQL (only `ALTER TABLE "heat" ADD COLUMN`
  ×3, one index, one foreign key) and the command output. Then: `types.ts`
  fields; `engine.ts`/`heats.ts` `generate` set nulls; `loadBracket` and
  `insertBracket` read/write the columns; `getBracketEntrants` adds the
  Participant's Team name (`teamName`, for `get_bracket`); `view.ts`
  helpers (decisions 5, 10; `heatNameAt`); `setup-schedule-faq.ts` exports
  `clockTime`; `heat-schedule.ts` + test; `access.ts` action +
  `access.test.ts` row (an Organizer and the Host pass; a Participant and a
  Host of another Competition get `NOT_HOST`); `mutations.setHeatSchedule` +
  DB tests (sets and clears; refuses a foreign Day, a foreign Heat, a bye, a
  finalized Bracket; a Heat Result after a time is set keeps the time; a
  re-generate drops it); `actions.setHeatSchedule` + a test that `authorize`
  is called with `"bracket.heat-schedule"` before the input is parsed (mock
  `authorize` to refuse and pass malformed input: the refusal wins). The
  smoke rows for `setHeatSchedule` are **not** added here: smoke finds an
  action only through `.next/server/server-reference-manifest.json`, which
  lists it once a client component imports it (D3). Tracker: the epic file's `Status:` to
  `in-progress` with the `[EXECUTION PLAN]` pointer comment, per
  `docs/agents/issue-tracker.md` (the orchestrator's first commit).
  Files: `src/db/schema.ts`, `drizzle/`, `src/lib/bracket/{types,engine,
  heats,view,heat-schedule}.ts` + tests, `src/lib/setup-schedule-faq.ts`,
  `src/queries/brackets.ts`, `src/mutations/brackets.ts` + test (new
  function only), `src/actions/brackets.ts` + test (new action only),
  `src/lib/access.ts` + test, the epic file.

**Wave 2 (three packets on D1, disjoint files)**

- **D2 Seeding by Standings and the builder confirms.** `seeding.ts`
  `standingsSeedPositions` + `seeding.test.ts` (Teams and Participants; ties
  shuffled among themselves only; zero-point Entrants shuffled; an Entrant
  missing from the Standings last; and a single-elimination and a Heats
  Bracket generated from the result put the top-ranked Entrant at Seed
  Position 1 with the byes, through `formats.generate`); `input.ts`
  `generateSchema` gains `seeding` (+ `input.test.ts`);
  `mutations.generateBracket` (decision 8) + a DB test with three Points
  Entries and one tie; `actions.generateBracket` passes it through, with an
  action test that a `seeding: "standings"` input reaches the mutation;
  `bracket-builder.tsx`: "By Standings" button and caption, and the
  timed-Heat confirms of decision 3. The smoke bracket loop is unchanged
  (random default).
  Files: `src/lib/bracket/seeding.ts` + test, `src/lib/bracket/input.ts` +
  test, `src/mutations/brackets.ts` + test (the `generateBracket` section
  only), `src/actions/brackets.ts` + test (the `generateBracket` action and its
  test case only),
  `src/components/bracket-builder.tsx`.
- **D3 Time & place UI, Now/Next, live refresh.** `heat-schedule-form.tsx`
  (Sheet: Day `OptionSelect` from `getSetupDays`, each option labelled
  `formatDayHeading(day.date)` alone (e.g. "Sunday, Feb 22"), `TimeCombobox` prefilled
  `HH:MM`, `Input` location, Save and Clear, `useActionState`,
  `FormFieldErrors`); `bracket-results.tsx` split per decision 6, with a
  **"Time & place" button in each non-bye Heat card's header row beside
  "Record result", `aria-label="Time & place for <Heat name>"`, positioned
  `relative z-10` so it sits above the card's full-card "Record" overlay**,
  hidden while finalized; the when-line on cards; `bracket-results.test.tsx`
  (its `BracketResultsView` fixtures are unfinalized with no champion, so
  `ConfirmActionButton`, whose `useRouter` needs a mounted app router, never
  renders; `next/navigation` is **always** mocked, since with a Sheet open
  the result form's `useSaveHeatResult` calls `useRouter`);
  `src/app/admin/brackets/[id]/page.tsx` loads the Days; `bracket-view.tsx`
  and the competition page (decision 10; the page passes `getSetupDays`);
  `now-next.ts` `heatEntries` + test and `schedule.ts` `withHeats` + tests
  (criterion 1's cases, driven through `computeNowNext` with `?at=`-style
  instants: before, during and after the 60-minute window; a Heat with no
  Day or no time; a Heat and a Schedule Item on the same Competition both
  shown; a `played` and a `forfeit` Heat not shown; a bye not shown; and a
  reset built through the engine, not by hand: an 8-Entrant single
  elimination with every Heat played, then a Quarterfinal re-recorded with
  the other winner via `applyResult`, so its Semifinal comes back `ready`
  with the new Entrant and **is** shown while the reset Final is `pending`
  and **is not** (decision 4); fixtures in `HH:MM:SS`); `queries/schedule.ts`
  `getTimedHeats` (decision 5) + a DB test in `src/queries/` (a timed
  `ready` Heat returned with its labels; a `pending`, a decided and an
  untimed one not); `now-next.tsx` Heat rendering; the home page.
  Files: the above plus `src/components/now-next.tsx`,
  `src/app/[edition]/(home)/page.tsx`,
  `src/app/[edition]/competitions/[id]/page.tsx`, `src/lib/schedule.ts` +
  test, `src/lib/bracket/now-next.ts` + test, `src/queries/schedule.ts` +
  test, and `scripts/smoke/hosts.ts`: `assertParticipantRefused` and
  `assertHostChecks` gain `setHeatSchedule` rows, called with the args
  `[competitionId, <random uuid>, null, {}]` (`callAction` sends JSON, not
  `FormData`; `authorize` refuses before the input is read).
- **D4 MCP `get_bracket`.** `src/mcp/bracket.ts` + `bracket.test.ts`
  (unknown Competition; a `points` Competition; an unfinalized Bracket with a
  timed Heat, a bye and a decided Heat; a finalized one with the champion;
  **a fixture whose Entrant objects carry extra keys such as `email:
  "x@jahnelgroup.com"` and `hosts` (cast), asserting the serialized result
  has only the whitelisted keys and no "@"**); `tools.ts` entry; the route
  registration (`competition: z.string().trim().min(1)`); `queries/
  competitions.ts` `getCompetitionByName` (decision 7) + DB test (exact
  beats case-insensitive; two case-variants → undefined); `llms-txt.ts` copy
  (+ its test if it counts tools). Smoke: `mcp.ts` `mcpTool(name, args)`
  generalised from `mcpLeaderboard` (which keeps its signature);
  `brackets.ts` after finalize calls `get_bracket("SMOKE TEST bracket")`
  **with the bearer token and no session** and asserts `found`, the champion
  name, four Entrants and that the raw text has no "@"; and
  `get_bracket("no such competition")` → `found: false`.
  Files: `src/mcp/bracket.ts` + test, `src/mcp/tools.ts`, `src/mcp/llms-txt.ts`
  (+ test), `src/app/api/mcp/route.ts`, `src/queries/competitions.ts` +
  test, `scripts/smoke/mcp.ts`, `scripts/smoke/brackets.ts`.

Ownership check: D2 owns `seeding.ts`, `input.ts`, the `generateBracket`
mutation and action, `bracket-builder.tsx`; D3 owns the UI, `schedule.ts`,
`now-next.ts`, `queries/schedule.ts`, the home and competition pages,
`smoke/hosts.ts`; D4 owns
`src/mcp/`, the route, `queries/competitions.ts`, `smoke/mcp.ts` and
`smoke/brackets.ts`. D1 already delivered every shared query and helper
(`getBracketEntrants.teamName`, `heatNameAt`, `heatEntrantLabels`,
`getSetupDays` exists). No file appears in two wave-2 packets.

**Wave 3 (one packet, on D2–D4)**

- **D5 Bracket Finale.** `use-finale.ts` extracted; `src/lib/bracket/
  finale.ts` + test (rows sorted by place then Seed Position; ranks equal
  places so tied 3rds share a step; the champion is the last step);
  `bracket-finale.tsx` (decision 9; `data-finale` phase attribute like the
  Finale) + `bracket-finale.test.tsx` (static render: `ready` shows Start and
  the title; `playing` with only the last places shown hides the champion
  card; `done` shows it with the champion's name); the route group move
  (`src/app/[edition]/finale/page.tsx` and `loading.tsx` →
  `finale/(standings)/`, unchanged except the `war-week` import path) and
  `src/app/[edition]/finale/[competition]/layout.tsx` (the 404 check,
  decision 9) + `page.tsx` (`force-dynamic`, no `AutoRefresh`); the links:
  `BracketView` gains a `finaleHref: string | null` prop (set by the
  competition page when the Bracket is finalized) and shows "Play the
  Finale" on the champion card; `BracketResults` gains the same prop (set by
  the admin bracket page) for its finalized note; the `/admin/standings`
  list; smoke `brackets.ts`: `/xi/finale/<id>` answers
  200 after finalize and 404 after un-finalize. Then `pnpm gate`.
  Files: the above, `src/app/[edition]/finale/(standings)/{page,loading}.tsx`
  (moved), `src/app/[edition]/finale/[competition]/{layout,page}.tsx`,
  `src/components/finale.tsx` (import only),
  `src/components/bracket-view.tsx`, `src/components/bracket-results.tsx`,
  `src/app/[edition]/competitions/[id]/page.tsx` and
  `src/app/admin/brackets/[id]/page.tsx` (pass `finaleHref` only),
  `src/app/admin/standings/page.tsx`, `scripts/smoke/brackets.ts`. Smoke
  also still gets 200 from `/xi/finale` after the move.

**Wave 4 (one packet, on D5)**

- **D6 Flow, docs, showcase, evidence.**
  - `e2e/db.ts` gains `xiParticipantId` and `e2e/session.ts` gains
    `participantPageAs`, moved verbatim from `bracket-heats.spec.ts`, which
    imports them (criterion 8 expects exactly that import-only change).
  - `e2e/session.ts` gains `E2E_HOST_EMAIL = "e2e-host@jahnelgroup.com"`
    and `asHost(context)` (`signIn` with it); the flow inserts a
    `competition_host` row for that email on the Beyblades Competition via
    `runQuery` before it starts and deletes it in a `finally`;
    `deleteE2eUsers` also removes that email's `competition_host` rows.
  - `e2e/bracket.spec.ts` extended in place: after Generate and before
    recording, **find the Round-1 Heat that holds Ashley Schuliger** (query
    `heat` → `heat_entrant` → `entrant` → `participant` by display name via
    `runQuery`; its name is "Semifinal <position>"; the draw is random), and
    **as the Host** (a new context with `asHost`) on `/admin/brackets/<id>`
    open "Time & place for <that Heat>", pick XI's first Day (2026-02-22,
    the option whose label contains "Sunday, Feb 22", matched without
    `exact`), type "7:00 PM", location "Main
    room", Save; expect the toast "Time and place saved." and the card's
    when-line "Sunday, Feb 22 · 7:00 PM ET · Main room" (the Day's date read
    from the `day` table and formatted with `formatDayHeading`, so the
    assertion follows the seed);
    screenshots at 375 and 1280. Then `participantPageAs(browser, "Ashley
    Schuliger")` opens `/xi/competitions/<id>` and asserts "Your next Heat ·
    <that Heat>" contains "7:00 PM ET" and "Main room"; opens
    `/xi?at=2026-02-22T18:30:00-05:00` (that Day) and asserts "Up next" contains
    "Beyblades · <that Heat>", "Main room" and "Ashley Schuliger";
    screenshots at 375 and 1280. Back as Organizer: record the three Heats
    and Finalize as today; then `/xi/finale/<id>`: Start → Replay visible
    within 20 s, the champion card names the champion; screenshots at 375
    and 1280. Then in a new context with `reducedMotion: "reduce"`, open
    `/xi/finale/<id>`, press Start, and expect `data-finale="done"` and the
    champion card at once (the Finale rule "reduced motion shows the final
    state"). Overflow assertions (`scrollWidth <= clientWidth`) at 375, 768
    and 1280 on the results screen with the time set, the participant view,
    the home page with the Heat and the Bracket Finale. The existing
    assertions (4 "From bracket" entries, champion 5 points) stay word for
    word. No idle waits.
  - Docs: CONTEXT.md (glossary Heat; Schedule display rules: "Timed Heats
    (a Day and a start time, every slot filled, no Heat Result yet) join
    now/next under the same rules, 60 minutes long, alongside any Schedule
    Item on the same Competition; a decided Heat, and a Heat still waiting
    for its Entrants, drops out" (worded to Paul's call on decision 4);
    Bracket rules: time and place and who sets it, a re-draw clears times,
    seeding by Standings with ties at random; Finale rules: the Bracket
    Finale; Access rules: `get_bracket` in the MCP sentence);
    `docs/maintainers-guide.md` "Run a knockout Competition as a Bracket"
    (time and place, By Standings, the Bracket Finale) and its MCP
    paragraph; `docs/agents/testing.md` e2e row ("a Bracket built, timed,
    recorded, advanced and finalized into Points Entries and played as a
    Finale"); `README.md` e2e list and, if it lists tools, `get_bracket`;
    `src/mcp/llms-txt.ts` re-checked; `src/lib/about.ts` brackets card copy
    (time and place, Finale for a Bracket, By Standings) and
    `scripts/about-media.ts` `setupBracketDemo` sets one Heat's Day, time and
    location by SQL so `public/about/brackets.png` (regenerated with `pnpm
    tsx scripts/about-media.ts --stills`) shows the when-line;
    `organizer-guide.tsx` "Running a Bracket" and "The Finale" sections.
  - Tracker: ticket 16 `[PROGRESS]` (delivered: T13, T14's live refresh and
    `get_bracket`, the Finale for a Bracket, W2 by Standings; still open: Epic
    G), `Status:` line unchanged; this epic's `[CLOSEOUT]` and `Status: done`
    in the final commit (after `ai-review`, per the tracker guide).
  - Final `pnpm format:check && pnpm gate`; CI on the PR.

### Declared scope

In scope: the files named above; `drizzle/0012_*` plus `drizzle/meta/`;
`public/about/brackets.png`; `test-results/` evidence.

Out of scope and untouched: seeds (`seeds/*.json`, the seed schema: Heats
aren't seeded, so no time fields there); `get_schedule` and
`/<edition>/schedule` (Heats stay off the full schedule); the Archive bracket
view; drag seeding; round robin, double elimination; Squads and self-report
(Epic G); the Slack champion post; deleting a Day that timed Heats reference
(decision 1: `set null`); `src/lib/finale.ts` timing; `HAS_RESULTS_ERROR`;
`src/auth/`; new test dependencies (no jsdom or testing-library: every
component test is a static render of a props-only component); `.env*`; the
`bracket_points` column drop (its own `chore/` migration).

### Criterion → verification map

Run surface: **local + deployed** (deployed only through the PR's CI on
GitHub; no deploy in this epic). Real dependencies: local Postgres from
`docker compose up -d`; Chromium for Playwright; `/api/mcp` over HTTP with the
smoke `MCP_TOKEN`. Fixtures: the XI demo seed reloaded with `--reset` by
`e2e/global-setup.ts` and by smoke; smoke's "SMOKE TEST" rows are created and
deleted by each check; the e2e Beyblades Bracket is rebuilt by the flow; the
migration proof's Competition is deleted by its script. Evidence root
`test-results/` is cleared at the start of the work package and holds only
this epic's evidence, committed on the branch.

| # | Criterion (epic) | Check | Expected | Evidence | Earliest checkpoint | Invalidated by |
|---|---|---|---|---|---|---|
| 1 | Now/Next unit tests with timed Heats | `pnpm test src/lib/schedule.test.ts src/lib/bracket/now-next.test.ts` | pass; the cases in D3 are present (before/during/after, no Day or no time, Heat + Schedule Item on one Competition both shown, decided and reset Heats and a bye hidden) | `test-results/hardening-f-gate/gate.txt` | end of wave 2 | changes to `schedule.ts`, `now-next.ts`, `view.ts`, `types.ts` |
| 2 | By-Standings seeding unit tests | `pnpm test src/lib/bracket/seeding.test.ts` | pass; Teams and Participants, ties, zero-point Entrants, a single-elimination and a Heats Bracket generated from the result | gate.txt | end of wave 2 | `seeding.ts`, `engine.ts`, `heats.ts` |
| 3 | `get_bracket` tests and smoke | `pnpm test src/mcp src/queries/competitions.test.ts`; `pnpm smoke` (`bracket loop` check) | pass: unknown, `points`, unfinalized, finalized, whitelisted keys only, no "@"; smoke `ok - … get_bracket …` with the bearer token and no session | gate.txt | end of wave 2 | `src/mcp/*`, the route, `queries/brackets.ts`, `queries/competitions.ts`, smoke |
| 4 | Access: only an Organizer or that Competition's Host sets a time; `authorize` first | `pnpm test src/lib/access.test.ts src/actions/brackets.test.ts src/mutations/brackets.test.ts`; `pnpm smoke` (`hosts` checks) | pass; smoke shows `setHeatSchedule` refused for the Participant and the other-Competition Host with "You're not a Host of that Competition." and nothing written | gate.txt | end of wave 1 (unit), end of wave 2 (smoke, once D3 imports the action) | `access.ts`, `authorize.ts`, `actions/brackets.ts`, `mutations/brackets.ts`, `hosts.ts` |
| 5 | Migration on the seeded local DB; seeds load twice; smoke; old Heats keep working | D1's proof; `pnpm seed:load --reset seeds/*.json && pnpm seed:all`; `pnpm smoke` | `before.json` = `after.json` + three null fields; only the column adds, one index and one foreign key in the SQL; seeds load twice; smoke 0 FAIL, row counts unchanged; the existing `bracket loop` and `heats loop` pass unchanged | `test-results/hardening-f-migrate/{before,after}.json`, `migrate.txt`; gate.txt | end of wave 1 (smoke with no new rows), rerun waves 3 and 4 | schema, migration, seed loader |
| 6 | Playwright: the Host (an `e2e-host` session with a `competition_host` row) sets time and place; Participant sees "Your next Heat" and Now/Next (`?at=`); the Bracket Finale plays | `pnpm e2e` | `bracket.spec.ts` passes with the new steps, on the Heat that holds Ashley whichever the draw; the Bracket Finale plays and, under reduced motion, shows the final state at once; the pre-existing assertions unchanged | `test-results/e2e/<test>/*.png`; gate.txt | wave 4 | UI, engine, mutation, seed or e2e changes |
| 7 | Screenshots 375/1280 of the four screens; zero overflow 375/768/1280 | the assertions inside the flow | eight screenshot files exist; overflow assertions pass | `test-results/e2e/<test>/*.png`; gate.txt | wave 4 | UI changes |
| 8 | Single elimination and Heats unchanged without times | existing `engine.test.ts`, `heats.test.ts`, `view.test.ts`, `mutations/brackets.test.ts`, smoke `bracket loop` + `heats loop`, `e2e/bracket-heats.spec.ts`; `git diff staging -- src/lib/bracket/*.test.ts src/mutations/brackets.test.ts e2e/bracket-heats.spec.ts scripts/smoke/brackets.ts` | pass; the diff shows only added null fields in fixtures, added cases, the added `get_bracket` and `/xi/finale/<id>` smoke steps, and `bracket-heats.spec.ts` importing the two moved helpers; no changed expectation | gate.txt; `test-results/hardening-f-gate/unchanged-diff.txt`, reviewed in the closeout | wave 1 then every wave | engine, mutation, query, UI, smoke or e2e changes |
| 9 | CONTEXT.md, `/about`, the Organizer guide and the maintainers guide match | stale-copy greps, all empty: `grep -n "for Bracket detail yet\|will appear here later" src/mcp/llms-txt.ts src/app/admin/standings/page.tsx`; non-empty: `grep -n "get_bracket" CONTEXT.md docs/maintainers-guide.md src/mcp/tools.ts`; `grep -n "Time & place\|By Standings" src/lib/about.ts src/components/organizer-guide.tsx docs/maintainers-guide.md`; `grep -n "finale/" CONTEXT.md docs/maintainers-guide.md`; `git diff --stat staging -- public/about/brackets.png` non-empty; banned-term scan (CONTEXT.md list over `src/`, `scripts/`, `drizzle/`) vs the same on `staging`: no new hits | as stated | `test-results/hardening-f-docs/grep.txt` | wave 4 | copy or doc changes |
| 10 | Tracker records | ticket 16 `[PROGRESS]` comment, `Status:` unchanged; the epic file's `[CLOSEOUT]` and `Status: done` in the final commit | present | the files | final commit | — |
| 11 | `pnpm gate` locally and in CI | `pnpm format:check && pnpm gate` (`DATABASE_DRIVER=pg`, local `DATABASE_URL`); GitHub Actions on the PR | exit 0; DB tests not skipped; CI green | `test-results/hardening-f-gate/gate.txt`; `test-results/hardening-f-ci/runs.md` | end of wave 3 (first full gate) and wave 4 (final) | any change |
| 12 | Live refresh never discards an unsaved result (story 25) | `pnpm test src/components/bracket-results.test.tsx` | `BracketResultsView` renders the (mocked) `AutoRefresh` marker with `openSheet: null` and not with a Sheet open; the flow's Save of a typed location (criterion 6) is the real-browser proof that entry survives | gate.txt | wave 2 | `bracket-results.tsx`, `auto-refresh.tsx` |

Human-gated criteria: none. For the later `staging → main` PR: migration 0012
adds three nullable columns, an index and a foreign key; Instant Rollback to
a pre-0012 build is safe at any time (the old code selects explicit columns
and never reads the new ones).

Candidate evidence from planning: none exercised (no commands run against the
database during planning). Baseline: Epic E's final gate on `cf80839`
(`test-results/hardening-e-gate/gate.txt`: exit 0, e2e 23 passed) is the last
known green state of `staging`.

### Repository-specific considerations (`docs/agents/planning.md`)

- **Drizzle schema change (confirmed team policy):** red-teamed (record
  below); D1 ships the migration with its proof, and seeds (unchanged) are
  shown to load twice on it before wave 2 starts. Smoke on the seeded local
  Postgres is criteria 5 and 11.
- **Auth or access-control change (confirmed team policy):** a new
  `WarWeekAction` under the existing one rule (`can`'s default branch), no
  new role; red-teamed with the schema. Google-only, `@jahnelgroup.com`-only
  sign-in is preserved: nothing under `src/auth/` changes.
- **MCP tool change (discovered fact):** `get_bracket` is read-only, takes a
  session or the bearer token through the existing handler, and returns
  names only (criterion 3 asserts whitelisted keys and no "@").
- **Finale change (confirmed team policy):** the Bracket Finale plays engine
  placings and never touches Standings; `src/lib/finale.ts` timing is reused
  unchanged. Red-team not required for it alone; it rides along.
- **Any vertical slice:** the gate (typecheck, lint, vitest, build, smoke
  with `/xi`, `/xi/leaderboard`, `/xi/finale`, `/api/mcp`, e2e) is criterion
  11.
- **Showcase rule** (`docs/agents/testing.md` team rule): criterion 9.
- ADR 0001 layering: the new pure modules (`now-next.ts`, `heat-schedule.ts`,
  `seeding.ts`, `bracket/finale.ts`, `src/mcp/bracket.ts`) import no DB and
  no `next/*`; the lint rule enforces it. ADR 0003: `setHeatSchedule` and
  `generateBracket` take their War Week from the Competition row. ADR 0004:
  the Time & place form uses `useActionState` and the shared zod schema.

### Open decisions for Paul (defaults apply unless changed in the epic file)

**Paul, 2026-09-27: accepted every default below.**

- Decision 1: `on delete set null` for a Day with timed Heats, vs. refusing
  the Day delete with a count like Schedule Items. Default: set null.
- Decision 3: a re-draw with no Heat Results but timed Heats asks first
  ("This clears N Heat times."), vs. re-drawing silently as today. Default:
  ask.
- Decision 4: only `ready` Heats join Now/Next (a timed Final shows once
  both finalists are known), vs. also showing timed `pending` Heats with
  "TBD" opponents. A Heat reset by a corrected result and refilled with its
  new Entrants is `ready` and **shows**; Heats further on stay hidden until
  filled. The epic says "Reset Heats … drop out"; this reads that as the
  emptied ones. Default: `ready` only, refilled Heats shown.
- Small readings (red-team pass 2, M6): a decided Heat's time and place can
  still be edited; a Day needs a start time with it (and the reverse); a
  location can be set on its own. Default: as stated.
- Decision 7: `get_bracket` takes a Competition **name** (like the rest of
  the tools) rather than an id. Default: name.
- Decision 9: the Bracket Finale shows places and names only, not Placement
  Points totals. Default: no totals.

## [RED-TEAM]

2026-09-27, fresh `atlas-red-team-reviewer` on the first draft:
`ATLAS_RED_TEAM_BLOCKED`, 2 blocking, 7 warnings, 12 minors. Adjudicated by
the planner; every item resolved in the revision above:

- B1 (the component tests needed jsdom, which the repo doesn't have; the
  repo's component tests are `renderToStaticMarkup`): `BracketResults` and
  `BracketFinale` split into a state owner and a props-only view; the rules
  are tested by static render (decisions 6, 9; criterion 12); reduced motion
  and `done` are left to Playwright; no new test dependency (declared scope).
- B2 (the flow timed "Semifinal 1", which holds Ashley only half the time):
  D6 finds the Heat that holds her from the database and times that one.
- W1 (a re-draw with no results deleted times silently; editing
  `HAS_RESULTS_ERROR` would change test expectations): decision 3 puts the
  confirm in the builder with its own copy; the constant is out of scope.
- W2 (the button under the full-card overlay, unnamed): D3 names and
  positions it. W3 (D4 needed D3's `getDays` and a query edit): D1 delivers
  the shared pieces; `getSetupDays` is reused instead of a new `getDays`.
  W4 (a grep that could never match): criterion 9 greps the text as it is
  split. W5 (decision 4 narrows the contract): listed for Paul with the
  alternative. W6 (a `BracketView` per Competition every 10 s on the home
  page): decision 5's `getTimedHeats`, three light selects. W7 (no field for
  the opponents line): `ScheduleEntry.entrants`.
- Minors applied: `formatDayHeading` wording (M1), `HH:MM` prefill and the
  exported `clockTime`, `HH:MM:SS` fixtures (M2), an email-bearing MCP
  fixture with a key whitelist (M3), the exact-then-case-insensitive name
  rule (M4), `mode` loaded in the transaction (M5), `lockedCompetition` and
  the accepted Day-delete race (M6), a scratchpad script for the migration
  proof (M7), the e2e helpers moved and criterion 8's diff adjusted (M8),
  the 12 s wait dropped (M9), the garbled sentence (M10), the epic's status
  moves (M11), the `/xi/finale/<id>` smoke check (M12).

2026-09-27, fresh `atlas-red-team-reviewer`, second pass on the revision:
`ATLAS_RED_TEAM_BLOCKED`, 1 blocking, 4 warnings, 6 minors. It checked the
first pass's B1, B2, the access path, the code claims, wave-2 ownership and
rollback against the code, and they hold. Adjudicated and resolved:

- B1 (`finale/loading.tsx` would stream the Bracket Finale's `notFound()`
  as a 200 and fail the smoke check): decision 9 and D5 move the standings
  Finale into `finale/(standings)/` and put the 404 in
  `finale/[competition]/layout.tsx`.
- W1 (a reset Heat is refilled `ready`, not `pending`): decision 4
  corrected, the D3 test builds the reset through `applyResult`, and it is
  in open decision 4 for Paul. D6's CONTEXT.md line follows Paul's call.
- W2 (reduced motion never verified): D6 adds a `reducedMotion: "reduce"`
  check. W3 (D5 missing the two pages that pass the Finale link): added,
  with the `finaleHref` prop. W4 (the flow set the time as an Organizer):
  D6 adds an `e2e-host` session and `competition_host` row.
- Minors applied: XI's first Day is Sunday 2026-02-22 and the toast text is
  named (M1); the action's real `useActionState` signature and JSON smoke
  args (M2); the `setHeatSchedule` smoke rows move from D1 to D3 (M3); the
  static-render fixture note (M4); an action test for `seeding:
  "standings"` (M5); the small readings listed for Paul (M6).

2026-09-27, fresh `atlas-red-team-reviewer`, third pass:
`ATLAS_RED_TEAM_PASS`, 0 blocking, 0 warnings, 4 minors, all applied: the
moved Finale page's `war-week` import path (M1); `next/navigation` always
mocked in `bracket-results.test.tsx` (M2); the Day option label fixed to
`formatDayHeading` and matched without `exact` (M3); decision 4's wording
now records Paul's acceptance (M4).

## [PROGRESS]

(none yet)

## [CLOSEOUT]

(none yet)

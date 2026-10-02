# Execution record: Epic R13, Finale slides ("Wrapped")

Contract: [`R13-finale-slides.md`](./R13-finale-slides.md) and its tickets
[`72`](../issues/72-finale-slides.md), [`73`](../issues/73-built-in-finale-slides.md),
[`74`](../issues/74-custom-finale-slides.md); decisions from [`../grilling-2026-10-01.md`](../grilling-2026-10-01.md) (Q19, Q27).
No `/atlas-plan` ran; `/atlas-implement` derived this plan on 2026-10-02 against `staging` at `c16c727` (R12 merged, PR #120).
Red-team is **required** (`docs/agents/planning.md`): a new Drizzle table, two enums and a `war_week` column. The Finale policy row (red-team not required for Finale changes) is outranked by the schema row.
Branch: `feat/regression-r13-finale-slides`.

## [EXECUTION PLAN]

2026-10-02. Revised after red-team round 1 (FAIL: 1 blocker, 3 contract readings, 12 should-fix, 6 nits; all folded in below under **Red-team round 1**, which overrides the decisions it names).

### Run record

- Work package `regression-r13`; branch `feat/regression-r13-finale-slides` from `staging` at `c16c727`.
- Deliverables: **D72** the slideshow framework, schema, admin → Finale list and the Standings countdown slide (feature-branch checkout); then **D73** built-in slides ‖ **D74** Custom slides (worktrees `.claude/worktrees/regression-r13/war-weeker/d73` and `…/d74`, branched from the D72 integration); then **DX** docs, `/about` and stills, checklist (feature branch).
- Structure: wave. Wave 1: D72. Wave 2: D73 ‖ D74. Wave 3: DX. Edges: D72 → D73, D72 → D74; D73, D74 → DX.
- **Only D72 changes the schema** (one generated migration), so D73 and D74 never generate migrations and can't collide in `drizzle/`.
- Why parallel in wave 2: D73 owns the built-in slide components and their queries; D74 owns the Custom slide editor, its actions and its renderer. Predicted collisions, merged by the orchestrator: `src/components/finale-slides/index.tsx` or wherever D72 puts the `kind → component` switch (one line each), `src/app/admin/finale/page.tsx` (D73 adds the Awards layout control, D74 the Add custom slide button), `src/lib/access.ts` and its test (D74 adds actions; D73 adds `finale.awards-layout`), `scripts/smoke/finale.ts` (each adds checks), `e2e/` (separate spec files). D72 is expected to leave one placeholder component per built-in kind so each wave-2 worker fills its own files.
- Each worktree uses its **own local database** on the shared Postgres (`postgres://postgres:postgres@localhost:2345/war_weeker_r13_d73` and `…_d74`, `?sslmode=disable`, `DATABASE_DRIVER=pg`; names from `.env.example`), created and migrated by the worker. Workers run format, typecheck, lint and unit (`pnpm test`), and build + their e2e spec against their own DB when they can. The orchestrator runs `pnpm gate` on the integrated branch in the main checkout (shared `war_weeker` database, e2e on port 3200).
- `test-results/` cleared at the start (evidence policy); R13 evidence lives under `test-results/r13/` and `test-results/e2e/<test>/`.

### Intent

The closing ceremony becomes a "Wrapped": the Organizer steps through slides on the projector (Title, By the numbers, Awards, Champions, the Standings countdown, the Winner, plus their own Custom slides) in an order they set. The Standings countdown is today's Finale unchanged.

### Resolved decisions: the framework (72)

**F1. Schema.** New pgEnum `finale_slide_kind`: `title`, `numbers`, `awards`, `champions`, `standings`, `winner`, `custom`. New table `finale_slide`:
- `id` uuid pk (same id convention as `faq_item`), `war_week_id` fk → `war_week` `on delete cascade`, `kind finale_slide_kind not null`, `sort_order integer not null`, `hidden boolean not null default false`;
- Custom-only: `heading varchar(120)`, `body jsonb $type<Content>`, `background_color varchar(7)` (`#rrggbb`, lower-case, or null for the theme's background);
- `created_at`, `updated_at` as `faq_item` has them.
- CHECK `finale_slide_custom_columns`: `kind::text = 'custom'` ⇔ `heading is not null`; when `kind::text <> 'custom'`, `body` and `background_color` are null. CHECK `finale_slide_background_color_hex`: `background_color is null or background_color ~ '^#[0-9a-f]{6}$'`.
- Partial unique index `finale_slide_built_in_once` on `(war_week_id, kind)` where `kind::text <> 'custom'`.
- New pgEnum `finale_awards_layout`: `one-slide`, `per-category`; column `war_week.finale_awards_layout finale_awards_layout not null default 'one-slide'`.
- One `pnpm db:generate` migration (enum values created with their types, so no separate `ADD VALUE` migration). No hand-edited migrations.

**F2. Resolution (pure, `src/lib/finale-slides.ts`).** `resolveFinaleSlides(rows)`:
- No rows → the default order `title, numbers, awards, champions, standings, winner`, none hidden.
- Rows → sorted by `sort_order`; any built-in kind missing from the rows is appended in its default relative order (so a future built-in appears without a migration); hidden rows are kept in the admin list and dropped from the Finale (`visibleFinaleSlides`).
- The first write for a War Week (move, hide, show, add custom) **materializes** the default list into rows inside the same transaction (FAQ-style `sort_order` 0..n renumbering under one transaction; reuse `moveInOrder`).
- Unit tests: default; reordered; hidden; a missing built-in appended; custom slides kept in place.

**F3. The slideshow (`/[edition]/finale`).** The `(standings)` page becomes the slideshow page: server-reads the War Week, its slide rows and every slide's data once (`force-dynamic`, no AutoRefresh, as today), then renders a client `FinaleSlideshow`.
- One slide on screen at a time, full viewport, themed through the existing `ThemeRoot` / `warWeekThemeStyle`, at projector scale (text sized with `clamp()`/viewport units so 1920×1080 and 390×844 both fit; nothing scrolls at 1920×1080).
- **Keys:** `Space`, `→`, `PageDown` and a click on the stage: next; `←`, `PageUp`: back; `Escape`: back to the first slide. Keys are ignored while focus is on a button, link or form control, as today's `Space` handler does. Next on the last slide does nothing. **Nothing auto-advances.**
- **Steps within a slide:** a slide may declare steps (the Awards slide reveals one Award per step; the Standings slide's countdown is one step). Next finishes the current slide's next step before moving on.
- **Standings countdown slide:** today's `Finale` rows and `useFinale` clock, unchanged. Arriving on the slide by Next is the presenter's deliberate start, so the countdown **plays on arrival** (ticket 72: "playing when its slide starts"); there is no Start button on this slide. Next while it's playing jumps it to its final state; Next when done goes on. Replay stays (a button, which doesn't advance). Arriving by Back shows the final state. Under reduced motion it shows the final state on arrival and waits for Next.
- Back always shows the previous slide in its final state (every step revealed).
- **Never reorders or recomputes Standings:** the Standings and Winner slides read the same `getStandings(warWeek)` rows, called once on the page.
- Markup hooks for tests and scripts: the stage has `data-finale-slide="<kind>"` and `data-finale-slide-index="<n>"`; the Standings slide keeps `data-finale` (`playing`/`done`; the `ready` phase no longer appears on the slideshow) and `data-finale-started-at`. Each slide is a `<section aria-label="<slide name>">`; a visually hidden live region announces "Slide n of m: <name>". A small on-stage hint ("→ next · ← back") appears on the first slide only and never on the projector after that.
- **Bracket Finale unchanged:** `/[edition]/finale/[competition]` and `bracket-finale.tsx` keep their Start button and `Space` handler. Any refactor of the shared `useFinale` must keep the Bracket Finale's behavior and `e2e/bracket.spec.ts` green.
- Until D73/D74 land, the other built-ins render as placeholders with their names (D72 only).
- No sync between screens; any viewer just sees the slideshow.

**F4. Admin → Finale (`/admin/finale`).** The existing page keeps "Open Finale" and the Bracket Finale links, and gains the **slide list** in the one admin list pattern (`SetupListRow`-style rows): each row shows the slide's name (built-ins by name, Custom slides by heading), a Hidden badge, a Hide/Show toggle and Move up / Move down buttons (`aria-label` `Move "<name>" up`/`down`, as FAQ). **Drag:** native HTML5 drag-and-drop on the rows on pointer devices (no new dependency; the ↑/↓ buttons are the keyboard and touch alternative). Each change saves at once with a toast on refusal (sonner), then `router.refresh()`.
- Writes are **Organizer-only**: new `WarWeekAction`s `finale-slide.move`, `finale-slide.hide` (hide and show) in `ORGANIZER_ONLY` (`src/lib/access.ts`) with messages ("reorder Finale slides", "hide Finale slides"). Hosts still open `/admin/finale` and see the list read-only (no controls), and keep "Open Finale".
- Action → zod → mutation → `revalidateWarWeek(edition)` per ADR 0003; mutations in `src/mutations/finale-slides.ts`, queries in `src/queries/finale-slides.ts`.

**F5. Seed.** `warWeekSeedSchema` gains optional `finaleAwardsLayout` and `finaleSlides` (an ordered list of `{ kind, hidden?, heading?, body?, backgroundColor? }`). When a seed file has `finaleSlides`, the loader syncs them like `faqItems` (`upsertDeletingAbsent`, `sort_order: index`, idempotent on a second load); when it doesn't, existing rows are left alone. `finaleAwardsLayout` is insert-only, like `status`. `seeds/demo/xii.json` gets a short list (the defaults plus one Custom slide "Thank you" at the end, after Winner) so the demo and `/about` stills show a Custom slide; no other seed changes. Seed unit test for the sync and a second load. Smoke counts the demo's slides after two loads.
- Note: `localSeedFiles` doesn't load `demo/xii.json`; the seed path is exercised by the seed unit test and `pnpm seed:demo:xii` in DX's stills run.

**F6. CONTEXT.md (D72 for its own terms; DX finishes).** **Finale**: now a slideshow of Finale slides. **Finale slide**: one full-screen step of the Finale; built-in or Custom. Finale rules rewritten: keys, steps, plays-on-arrival, no auto-advance, reduced motion, never reorders or recomputes Standings, Bracket Finale unchanged.

### Resolved decisions: built-in slides (73)

- **Title:** "War Week", the edition (e.g. "War Week XII") and the Story Theme, with the War Week's logo/banner when set.
- **By the numbers:** Competitions run (Competitions with at least one Points Entry), Games logged (`game` rows), Heats played (`heat.status = 'played'`; a forfeit is not played), Points Entries (count), points awarded (sum of `points_entry.points`, formatted like the leaderboard), Participants (the War Week's roster rows). Only non-zero figures show; a War Week with all zeros skips the slide. Pure `byTheNumbers(counts)` in `src/lib/finale-slides.ts` (labels, order, zero filtering, formatting); one query `getFinaleCounts(warWeekId)`.
- **Awards:** `getAwards(warWeek)` grouped by `groupAwardsByCategory` (Categories by name, uncategorized last as "Other Awards", as the Awards page). Each Award is one step (revealed one at a time). Layout per War Week (`war_week.finale_awards_layout`): `one-slide` = one Awards slide with every group; `per-category` = the Awards slide expands into one slide per group at resolution time, each named "Awards: <Category>". The Organizer sets it on `/admin/finale` (a two-option toggle group, Organizer-only action `finale.awards-layout`, autosaves like Settings). No Awards → the slide is skipped.
- **Champions:** every finalized Bracket's champion (`getBracket(id).champion` / `finalPlacings`, or the existing finalized-Bracket query) and every closed `games` Competition's winner and every closed **team** `participation` Competition's winning Team, using the same winner rules as `shapeRecentResults` (ties listed together) but **uncapped** (new query, not `getRecentResults`'s 5). An individual-scoring Participation Competition has no winner and is left out (deviation-free: it has none to show). Ordered by close/finalize time. None → skipped. Pure `championsList(rows)`.
- **Winner:** the main Standings' first place from the page's single `getStandings` call (`main` team or individual); all rows tied at rank 1 are shown together as a tie ("Tie: A & B", the `defaultWinner` wording). No Standings rows → skipped.
- Skipping an empty slide is part of resolution (`visibleFinaleSlides(rows, data)`), unit-tested.
- **73-AC1 reading:** unit tests for `byTheNumbers` and `championsList` use the XII demo's figures as inputs (read from `seeds/demo/xii.json`: its Participants and Points Entries), plus a finalized Bracket, a closed `games` Competition with a tie and an individual Participation Competition; smoke asserts the By the numbers slide on the loaded XI demo shows the same figures SQL counts.
- **73-AC2 reading:** screenshots of each slide at 1920×1080 and 390×844 on the XII demo, captured by a script in the `scripts/about-media.ts` precedent (`pnpm build && pnpm seed:demo:xii`, own server, Organizer sign-in, fixtures it adds and tears down: two Awards in Categories, a finalized Bracket via the existing bracket demo helper, Ping Pong closed). Output `test-results/r13/slides/<kind>-<w>x<h>.png`, committed. The capture lives in `scripts/finale-stills.ts` (or as a mode of `about-media.ts`; worker's call) and is never part of CI.

### Resolved decisions: Custom slides (74)

- On `/admin/finale`, **Add custom slide** (the one admin list pattern's add button) opens a `ResponsiveSheetDialog` form: Heading (required, ≤120), Body (`RichTextEditor` from ticket 64: images and video by URL, as the editor is today; upload was descoped in 64), Background (`ColorField` with `themeSwatches(...)` plus custom, optional; none = the theme's background). New slides are added just before the Standings slide; the Organizer then moves them anywhere with the list's controls. Each Custom row has Edit (same form) and Delete (`ConfirmDialog`, toast).
- **Contrast:** the slide's text color is `readableOn(background, theme foreground)`; the form refuses a background where neither the theme foreground nor `readableOn`'s pick reaches `MIN_TEXT_CONTRAST` (4.5) against it ("Pick a background with more contrast."), shown as the field's error; the server checks it again. Unit test on the helper; e2e axe on the custom slide.
- Organizer-only actions `finale-slide.create`, `finale-slide.update`, `finale-slide.delete` (`ORGANIZER_ONLY`). zod: `contentInputSchema` for the body (`sanitizeContent` on write), heading trimmed and required, colour `^#[0-9a-f]{6}$`.
- Rendering: heading as the slide's `h1`/`h2`, body through `RichText` (re-sanitized, no raw HTML), videos as the editor renders them; the slide scrolls internally only if the body exceeds the viewport.
- Deleting a built-in is impossible (hide instead).

### Resolved decisions: docs (DX)

- CONTEXT.md glossary (**Finale**, **Finale slide**, **Custom slide**) and Finale rules final text; "Seed idempotence rules" for `finaleSlides` and `finaleAwardsLayout`.
- `/about`'s Finale block copy and the `finale-poster` still (`scripts/about-media.ts` `recordFinale` navigates to the Standings slide by `→` until `data-finale-slide="standings"`); stills rerecorded on the XII demo as the guide says.
- `docs/maintainers-guide.md` (Finale, slides, schema note, the stills script), `docs/regression-checklist.md` Finale lines (User Pages and Admin) at both viewports, `docs/agents/testing.md` smoke/e2e coverage text, `src/mcp/llms-txt.ts` Finale text, organizer guide copy if it mentions the Finale.

### Red-team round 1 (2026-10-02): amendments

Reviewer: fresh `atlas-red-team-reviewer` (opus), read-only. Verdict FAIL (1 blocker, 3 contract readings, 12 should-fix, 6 nits), all folded in here; this section **overrides** the decisions it names. The plan is PASS once these hold.

- **B1 → F1, F5.** No partial index. One full unique constraint `finale_slide_war_week_kind_heading` on `(war_week_id, kind, heading)` **nulls not distinct** (Postgres 17 locally and in CI): each built-in once per War Week (heading null), Custom slides unique by heading within a War Week. The D74 form refuses a duplicate heading ("There's already a Custom slide called <heading>.", the `duplicateFaqItemError` precedent). Seed upsert target `[warWeekId, kind, heading]`; the delete-absent step deletes the War Week's rows whose `id` isn't among the upserted ids (`scheduleItem` precedent, `src/seed/load.ts` ~388). Ids stay the same across loads.
- **C1 → 73-AC1.** Reading: pure tests for `byTheNumbers`/`championsList`, **plus** a DB-backed vitest inside `inRolledBackTransaction` (precedent `src/seed/load.test.ts`) that loads `seeds/demo/xi.json` (the repo's `DEMO_SEED`), asserts `getFinaleCounts` against SQL counts, then adds a closed `games` Competition with a tied top entry and a finalized Bracket and asserts the Champions query. The smoke figure check is dropped (SSR shows only slide 0).
- **C2 → 74-AC1.** Reading: the e2e asserts the Custom slide's index is greater than Awards' and less than Standings' (`data-finale-slide-index`), not exact adjacency.
- **C3 → F3.** D72 rewrites `src/components/finale.test.tsx`'s Start-button tests; the anti-spoiler property becomes "the SSR'd slideshow on slide 1 contains no Standings names or totals" (test it).
- **S1 → F2, F4.** Every finale-slide mutation: `select … from war_week where id = $1 for update` (precedent `src/mutations/brackets.ts:135`), then upserts the resolved list's missing built-ins with `onConflictDoNothing` on the B1 constraint (this is "materialize", and it also fills in a built-in missing from partial rows), then applies the change, all in one transaction. A race test in the `src/mutations/races.test.ts` style. **Addressing:** move and hide authorize against the `warWeek` target with the posted `warWeekId` (ADR 0003 order: authenticate, load the target War Week, check access, then parse); the slide is identified as `{ kind }` for a built-in or `{ id }` for a Custom slide. Custom update and delete add a `finaleSlide` entry to `TARGETS` and `src/queries/targets.ts`.
- **S2 → F2, F4.** Pure `moveToIndex(ids, id, index)` with unit tests; action `finale-slide.move` input `{ slide, toIndex }`; Up/Down send `i ± 1`. The 72 e2e uses Playwright `dragTo` once on the admin list and the ↑/↓ buttons once.
- **S3 → map.** No global-setup cleanup (`seed:load --reset` deletes the War Week, cascading). `e2e/db.ts` gains `resetXiFinaleSlides()`: deletes `finale_slide` rows for xi and sets `finale_awards_layout = 'one-slide'`, so xi resolves to the default list. Each R13 spec calls it in `beforeAll` and `afterAll` and asserts against the default order. (The XI demo's seeded list from S7 is therefore removed by the first R13 spec; later specs see defaults. `e2e/finale.spec.ts` navigates by `→` until Standings, so it doesn't depend on the list.)
- **S4 → F3.** Option (a): the stage is a `fixed inset-0 z-50` themed overlay inside `ThemeRoot`, so the edition nav, footer and bottom tab bar are covered; the slideshow's own Exit link (top corner, small) goes to `/<edition>`.
- **S5 → F3.** `Space` and `Enter` are left to a focused button/link/control (they activate it); `→`, `←`, `PageUp`, `PageDown` and `Escape` always work except inside a text field or the editor. Replay blurs itself after its click. A click on a link, button, image link or video inside a slide never advances; only a click on the stage background does.
- **S6 → D72, DX.** D72 rewrites `scripts/smoke/finale.ts`'s `/xi/finale` check to `data-finale-slide="title"`, `data-finale-slide-index="0"` and no `data-finale="ready"`; rewrites `e2e/finale.spec.ts` to press `→` until `[data-finale-slide="standings"]`, wait for Replay, then compare the leader as today (test title unchanged); updates `e2e/theme.spec.ts:240` if it reads the old stage. DX owns `/about`: the **poster is the Title slide** at the existing poster size (non-spoiling); `recordFinale` steps by `→` to the slide before Standings for the lead-in, the "pressed" moment is the `→` onto Standings, and the frames come from the countdown as today; `AboutFinaleDemo`'s description/figcaption and the `about-media.ts` header comment updated.
- **S7 → F5.** `seeds/demo/xi.json` **and** `seeds/demo/xii.json` get a `finaleSlides` list: the six defaults plus a Custom "Thank you" after Winner. Smoke asserts xi has 7 `finale_slide` rows after the second load, with the same ids as after the first.
- **S8 → F5.** `FINALE_SLIDE_KINDS` and `FINALE_AWARDS_LAYOUTS` in `src/lib/enums.ts`; `schema.ts` builds the pgEnums from them. Seed zod: each built-in kind at most once; `heading` required (trimmed, ≤120) iff `kind = custom`; `body` only for custom, through `sanitizeContent` (`faqItemSeedSchema` precedent); `backgroundColor` `#rrggbb` lower-cased, only for custom; Custom headings unique.
- **S9 → 74.** No unreachable refusal: the server only validates the hex. Within a Custom slide with a background, override `--foreground`, `--muted-foreground`, `--primary-text` and the link colour with values from `readableOn(bg, …)`/`contrastRatio` so every text token reaches 4.5:1 on that background (pure helper `customSlideColors(bg, palette)`, unit-tested for ≥4.5 on a light, a dark and a mid background). The e2e image carries a caption so axe checks muted text; axe `color-contrast` on the Custom slide passes.
- **S10 → 73.** Extract the winner loop from `shapeRecentResults` into a pure `finalWinners(competitions, entries)` used by both `shapeRecentResults` and `championsList`; one uncapped query of generated entries for every finalized non-`points` Competition. One rule, one source.
- **S11 → D72, wave 2.** D72 fixes and exports `FinaleSlideData` (a discriminated union per kind, built-ins as placeholders) and the step protocol (`steps(data)` per kind; components receive `{ data, step, final }`), and the `kind → component` switch, so D73/D74 add union members and cases only. D72 adds an `E2E_PORT` env override to `e2e/env.ts`/`playwright.config.ts`. Wave-2 workers use `SMOKE_PORT`/`E2E_PORT` 3210/3211 (D73) and 3220/3221 (D74), and their own DBs. Also expected to collide: `src/lib/finale-slides.ts` and its test, the finale page's data loader.
- **S12 → DX.** "Rolling out R13" in the maintainer's guide: the migration is additive; confirm the Migrate job succeeded before checking the deploy (every edition page reads `war_week` whole).
- **N1.** Moot (no partial index).
- **N2.** Run-record line on global-setup cleanup superseded by S3.
- **N3.** All slides hidden or skipped: the stage shows "Nothing to show yet." and, for an Organizer, a link "Set up the Finale" to `/admin/finale`.
- **N4.** New Custom slides go just before Standings even when Standings is hidden.
- **N5.** D72 owns `finale.test.tsx`, the `/admin/finale` intro copy and the smoke/e2e rewrites; DX owns `docs/regression-checklist.md`'s Finale lines.
- **N6.** The figure is labelled **"Points handed out"** (not a Standings total); CONTEXT says it sums every Points Entry.

### [SCOPE CHANGE] 2026-10-02: staging CI fix (Paul)

`staging`'s CI after #120 failed in `e2e/regression-r12-award-categories.spec.ts:70`: `getByRole("list", { name: "Award Categories" })` also matched the "Archived Award Categories" list (strict mode). Paul asked for the fix in this PR. Orchestrator fix: both unscoped locators (lines 41, 69) use `exact: true`. Proven by the final `pnpm gate` and the PR's CI.

### Criterion → verification map

Run surface: **local** (deploy is Paul's merge; no deployed criterion). Real dependencies: local Postgres (docker compose), Chromium. Fixtures: the demo seeds loaded by `pnpm smoke`/`pnpm e2e` (`--reset`); each R13 spec calls `resetXiFinaleSlides()` (`e2e/db.ts`) in `beforeAll`/`afterAll` (Red-team S3); the stills script tears down its own fixtures.

| ID | Criterion | Command / action | Evidence | Earliest checkpoint | Invalidated by |
|---|---|---|---|---|---|
| 72-AC1 | Unit tests: slide-list resolution (default, reordered, hidden) | `pnpm test src/lib/finale-slides.test.ts` | `test-results/r13/unit.txt` (final gate output) | D72 integrated | changes to `src/lib/finale-slides.ts` |
| 72-AC2 | e2e: Organizer moves the Standings slide and hides one; the Finale plays in that order; "the Finale plays from Start and ends on first place" passes through the slideshow | `pnpm e2e e2e/regression-r13-finale.spec.ts e2e/finale.spec.ts` | `test-results/e2e/<test>/` screenshots + gate output | D72 integrated | any Finale, admin finale, slide or seed change |
| 72-AC3 | `pnpm gate` passes | `pnpm gate` | `test-results/r13/gate.txt` | final | any change |
| 73-AC1 | Unit tests: By the numbers figures and Champions list on the demo seed | `pnpm test src/lib/finale-slides.test.ts` (+ smoke figure check) | `test-results/r13/unit.txt`, `test-results/r13/gate.txt` | D73 integrated | `src/lib/finale-slides.ts`, counts query |
| 73-AC2 | Screenshots of each slide at 1920×1080 and 390×844 on the XII demo | the stills script on `pnpm seed:demo:xii` | `test-results/r13/slides/*.png` (committed) | D73 and D74 integrated (Custom slide included) | any slide component or theme change |
| 73-AC3 | `pnpm gate` passes | as 72-AC3 | | final | |
| 74-AC1 | e2e: add a Custom slide with an image between Awards and Standings; the Finale shows it there | `pnpm e2e e2e/regression-r13-custom-slides.spec.ts` | `test-results/e2e/<test>/` | D74 integrated | Custom slide or admin finale change |
| 74-AC2 | Contrast of a custom background with text passes | unit test on the contrast helper + axe (`@axe-core/playwright`, color-contrast) on the Custom slide in that e2e | gate output, e2e screenshot | D74 integrated | colour/contrast code |
| 74-AC3 | `pnpm gate` passes | as 72-AC3 | | final | |
| E-AC1 | `/about` Finale block and stills, maintainer's guide, regression checklist updated | read the DX diff; `scripts/about-media.ts` run on the XII demo regenerates `public/about/finale-poster.png`; smoke `/about` check | committed stills; `test-results/r13/about-media.txt` | DX integrated | Finale UI change after DX |
| E-AC2 | Each ticket records its closeout and is `done` | read the ticket files at the closeout commit | the ticket files | closeout | — |
| SC-1 | Staging CI fix: the Award Categories e2e passes | `pnpm e2e e2e/regression-r12-award-categories.spec.ts` (in the gate) and PR CI | `test-results/r13/gate.txt`, PR checks | final | changes to that spec or the Award Categories page |
| E-AC3 | CI on the PR passes; `pnpm format:check && pnpm gate` passes | local run, then GitHub Actions on the PR | `test-results/r13/gate.txt`, PR checks | PR open | any push |

Human gates: none before dispatch. CI on the PR (E-AC3) is observed after the PR opens; merging stays Paul's.

## [PROGRESS]

- 2026-10-02, wave 1: **D72** (atlas-worker / opus) committed `dc9eab5` on the feature branch: schema + migration `0027`, pure resolution and stepper, Organizer-only move/hide with the `war_week` row lock, the slideshow overlay with the Standings countdown slide, the admin list (↑/↓, Hide/Show, native drag; Hosts read-only), seed sync (`finaleSlides` in both demos), smoke and e2e rewrites, `E2E_PORT`. Worker run: unit 3651 passed, smoke 245 ok, full e2e 87 passed (candidate; the orchestrator's final gate decides). Acceptance screen: accepted. Worker decisions recorded: a `data-finale-hydrated` hook; the countdown completing its step when it ends; Enter never bound; Replay leaves the step finished.
- Wave 2 dispatched: D73 (worktree `d73`, DB `war_weeker_r13_d73`, ports 3210/3211) ‖ D74 (worktree `d74`, DB `war_weeker_r13_d74`, ports 3220/3221).
- 2026-10-03, wave 2: **D74** (atlas-worker / sonnet) `0b72b2e`, merged `34ec6ce`; **D73** (atlas-worker / opus) `5fe725f`, merged `2531728` (conflicts with D74 resolved by the orchestrator: access, actions, mutations, and `finaleSlideData`, which D73 moved into the lib, now carrying D74's Custom slide colours). Orchestrator fixes: `6f8511c` (the e2e stage is the hydrated one, never React's hidden streaming copy, which D74 saw once), `66cb75a` (the integrated specs step through Awards' reveals, wait for the layout's save before reloading, and allow Champions once `bracket.spec` has finalized an XI Bracket). Integrated run: smoke 246 ok; the six Finale specs pass.
- Wave 3: **DX** (atlas-worker / sonnet) `fa6ff9d`: CONTEXT seed rules, `/about` copy and poster (the Title slide), `recordFinale` rewritten, Custom stills rerun, maintainer's guide ("Run the Finale", "Rolling out R13"), regression checklist, testing.md, llms.txt, organizer guide. Accepted.
- Review fixes: **RF** (atlas-worker / opus) `6096595` applied every finding below; accepted.

## [AI CODE REVIEW]

2026-10-03, over `c16c727..6b4cfe5` (before RF). Two fresh opus reviewers, one per axis, read the whole diff; the orchestrator adjudicated each candidate from the cited hunks (T1 confirmed by reading `renumber`). Coverage judged sufficient on both axes (each walked D72, D73, D74, DX, the merges and the orchestrator fixes).

### Axis 1: technical implementation and spec conformity

Every AC, resolved decision and Red-team amendment is implemented; the reviewer listed schema/migration 0027, resolution and stepper, keys, plays-on-arrival, the single `getStandings`, the unchanged Bracket Finale, auth and targets, the lock and materialize, sanitization, contrast, seed idempotence, counts and Champions, and the e2e mapping as checked.

| ID | Severity | Paths | Finding | Disposition |
|---|---|---|---|---|
| T1 | blocking | `src/mutations/finale-slides.ts` | `renumber` compared list positions, not stored `sort_order`; a Custom slide's delete left a gap, so a later move could tie two slides and play them in a random order. | fix (RF): compares stored order, renumbers after delete; tests for delete → move and delete → create |
| T2 | non-blocking | same | Materialize inserted at resolved index, able to tie a gapped list. | fix (RF): renumbers 0..n after materializing; test |
| T3 | non-blocking | `src/lib/finale-slides.ts` | Per-Category with no Categories played a lone "Other Awards". | fix (RF): falls back to one "Awards" slide; test |
| T4 | non-blocking | `CONTEXT.md` | Reduced-motion wording implied Awards reveal at once. | fix (RF) |
| T5 | non-blocking | `docs/regression-checklist.md` | Host sees the Awards layout disabled, not hidden. | fix (RF) |
| T6 | non-blocking | slide eyebrow | Raw `text-primary` on a projector slide. | fix (RF): `text-primary-text` |
| T7 | non-blocking | `src/components/finale.tsx` | Any image click refused to advance (avatars, logo). | fix (RF): only inside a link or a Custom slide's body |
| T8 | non-blocking | 390 stills | Exit crowded the eyebrow on phones. | fix (RF): top padding; 390 stills rerun |
| T9 | non-blocking | Custom slides e2e | A stage click advancing wasn't asserted. | fix (RF) |
| T10 | closeout | evidence, statuses | Gate evidence and closeouts pending. | orchestrator closeout |

### Axis 2: coding standards

| ID | Severity | Paths | Finding | Disposition |
|---|---|---|---|---|
| S1 | non-blocking | `src/actions/finale-slides.ts` | zod schemas in the action (ADR 0001). | fix (RF): parse functions in `src/lib/finale-slides.ts` |
| S2 | non-blocking | Custom slide input vs seed schema | Field rules copied. | fix (RF): one `customSlideFields`, input folded into `custom-finale-slide.ts` |
| S3 | non-blocking | `src/lib/custom-finale-slide.ts` | Local 4.5 constant. | fix (RF): `MIN_TEXT_CONTRAST` |
| S4 | non-blocking | Champions slide | Tie wording reimplemented in UI. | fix (RF): `tieTitle` shared with `defaultWinner`; `championsList` emits title and label |
| S5 | non-blocking | placeholder slide | Dead `PlaceholderSlide`. | fix (RF): removed; `slide-eyebrow.tsx` |
| S6 | non-blocking | Finale slide editor | Copied row plumbing, no failure catch. | fix (RF): shared `ROW_ACTION`, `MoveUpDownButtons` (FAQ too), `cn`, `SAVE_FAILED_ERROR` |
| S7 | non-blocking | UI, docs, e2e, llms.txt | "Add custom slide"; loose slide names. | fix (RF): "Add Custom slide"; built-in names |
| S8 | non-blocking | `scripts/finale-stills.ts` | Hard-coded R13 evidence folder. | fix (RF): `--out` (default `test-results/finale-stills`) |
| S9 | non-blocking | stills and about-media scripts | Duplicated server scaffolding. | fix (RF): `startDemoServer` and friends in `scripts/media/demo.ts`; about-media rerun by the orchestrator (poster byte-identical) |
| S10 | non-blocking | `scripts/about-media.ts` | Leftover work. | fix (RF) |
| S11 | non-blocking | e2e helpers | Duplicated walkers; styling selectors. | fix (RF): shared in `e2e/finale-slides.ts`; `data-finale-slide-name` |
| S12 | non-blocking | `e2e/finale.spec.ts`, testing.md | Stale "Start" title. | fix (RF): "the Finale's Standings countdown ends on first place" |
| S13 | non-blocking | comments | Wrapping. | fix (RF) |
| S14 | non-blocking | lib, editor, mutations, form | Sentinels and casts. | fix (RF) |
| S15 | closeout | `test-results/r13/` | Evidence not committed yet. | orchestrator closeout |

Remaining risks: the 12-row XII Standings slide scrolls a few pixels at 390×844 (phones aren't the projector; 1920×1080 fits); HTML5 drag is covered in Chromium only (↑/↓ are the alternative); the deploy window (Migrate before the deploy) is in "Rolling out R13".

## [CLOSEOUT]

2026-10-03. Work package `regression-r13` delivered on `feat/regression-r13-finale-slides` (one repository, `war-weeker`, base `staging` at `c16c727`; plan commit `18dae0b`).

### Deliverables

| ID | Worker / model | Commit | Notes |
|---|---|---|---|
| D72 the slideshow (72) | atlas-worker / opus | `dc9eab5` | feature-branch checkout; schema + migration 0027 |
| D74 Custom slides (74) | atlas-worker / sonnet | `0b72b2e` | worktree `d74`, own DB `war_weeker_r13_d74`; merged `34ec6ce` |
| D73 built-in slides (73) | atlas-worker / opus | `5fe725f` | worktree `d73`, own DB `war_weeker_r13_d73`; merged `2531728` with orchestrator conflict resolution |
| Orchestrator fixes | orchestrator / opus | `18dae0b` (staging CI locator), `6f8511c`, `66cb75a` | hydrated e2e stage; integrated specs step through Awards, wait for the layout save, allow Champions |
| DX docs | atlas-worker / sonnet | `fa6ff9d` | CONTEXT, `/about` + poster, maintainer's guide, checklist, testing.md, llms.txt, organizer guide |
| RF review fixes | atlas-worker / opus | `6096595` | every [AI CODE REVIEW] finding |

Red-team: one round (opus), FAIL → amended (1 blocker, 3 readings, 12 should-fix, 6 nits) before dispatch. Paul's scope change: the staging CI fix.

**Parallelism re-check.** Predicted wave-2 collisions: the `kind → component` switch, the admin Finale page, `access.ts` and its test, `scripts/smoke/finale.ts`, `src/lib/finale-slides.ts` and its test, the finale page's loader. Real conflicts at the D73 merge: `src/lib/access.ts`, `src/lib/access.test.ts`, `src/lib/finale-slides.ts`, `src/queries/finale-slides.ts`, the finale page, and (unpredicted) `src/actions/finale-slides.ts`, its test and `src/mutations/finale-slides.ts`, all additive both-sides hunks except `finaleSlideData`, which D73 moved into the lib while D74 added Custom slide colours to it. The admin page, smoke and the slide switch auto-merged. Running D73 ‖ D74 in parallel was right: one resolution pass, no rework. Not caught by either worker alone: three e2e specs whose assumptions the other deliverable changed (fixed in `66cb75a`).

### Verification (final)

Command: `pnpm format:check && pnpm gate` with `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`, at `6096595`: exit 0 (vitest 173 files / 3729 tests; smoke 246 ok; Playwright 91 passed) → `test-results/r13/gate.txt`. Run surface: local only (deploy is Paul's merge).

| Criterion | Verdict | Evidence |
|---|---|---|
| 72-AC1 resolution unit tests | PASS | gate vitest; `src/lib/finale-slides.test.ts` |
| 72-AC2 e2e reorder/hide/play; Finale e2e through the slideshow | PASS | gate Playwright; `test-results/e2e/regression-r13-finale-72-A-*/`, `test-results/e2e/finale-the-Finale-s-Standings-*/` |
| 72-AC3, 73-AC3, 74-AC3 `pnpm gate` | PASS | `test-results/r13/gate.txt` |
| 73-AC1 By the numbers and Champions on the demo seed | PASS | gate vitest; `src/lib/finale-slides.test.ts`, `src/queries/finale-slides.test.ts` |
| 73-AC2 stills at 1920×1080 and 390×844 on the XII demo | PASS | `test-results/r13/slides/*.png` (14) |
| 74-AC1 Custom slide between Awards and Standings | PASS | gate Playwright; `test-results/e2e/regression-r13-custom-slid-*/` |
| 74-AC2 contrast | PASS | axe in that e2e; `src/lib/custom-finale-slide.test.ts` |
| SC-1 staging CI fix | PASS (local) | `e2e/regression-r12-award-categories.spec.ts` passed in the gate; PR CI pending |
| E-AC1 `/about`, stills, maintainer's guide, checklist | PASS | DX `fa6ff9d`, RF `6096595`; `scripts/about-media.ts` rerun → `test-results/r13/about-media.txt` (poster byte-identical to DX's); smoke's `/about` check |
| E-AC2 closeouts, tickets `done` | PASS | ticket files 72–74 and the epic |
| E-AC3 PR CI; `pnpm format:check && pnpm gate` | local PASS; CI pending | gate.txt; PR checks |

Deviations: listed in each ticket's closeout and the Red-team amendments. PR: (linked after opening).

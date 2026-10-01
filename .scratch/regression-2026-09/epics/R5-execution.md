# Execution record — Epic R5: Admin on a phone

Contract: [`R5-admin-on-a-phone.md`](./R5-admin-on-a-phone.md) and its
tickets [`30`](../issues/30-admin-header-and-nav-on-a-phone.md),
[`31`](../issues/31-setup-rows-open-in-a-sheet.md),
[`32`](../issues/32-admin-lists-fit-a-phone.md),
[`33`](../issues/33-sticky-save-on-long-admin-forms.md),
[`34`](../issues/34-admin-touch-targets.md),
[`35`](../issues/35-pickers-on-a-phone.md),
[`36`](../issues/36-seed-warning-on-setup-index-only.md),
[`37`](../issues/37-pinned-announcement-card-spacing.md) and
[`38`](../issues/38-bracket-fixes-from-test-fixtures.md). Planned by
`/atlas-plan` on 2026-09-30 against `staging` at `50acefb`; every line
reference in the tickets was re-checked there and still holds. Red-team not
required: no Drizzle schema, auth or access-control change
(`docs/agents/planning.md`). Branch `feat/regression-r5-admin-on-a-phone`
from the latest `staging`. `/atlas-implement` work package `regression-r5`.

## [EXECUTION PLAN]

2026-09-30.

### Intent

Make `/admin` usable one-handed at 375x812 without changing it from `md`
(header/nav, lists) or `sm` (control sizes) up, plus four Bracket bugs.
The tickets carry the product decisions; this plan only resolves what they
leave open and orders the work. Nothing here amends a ticket.

### Resolved decisions

None changes the contract. Each names the ticket it serves.

1. **30: one shared section model, a client bar.** `SECTIONS` moves out of
   `admin-shell.tsx` into `src/lib/admin-sections.ts` (no `"use client"`,
   so the server shell and the client bar import the same list and icons).
   It also exports a pure `adminNavFor(isOrganizer, current)` returning
   `{ tabs, more, moreCurrent }`: tabs Overview, Points (label for Points
   Entries), Announcements, Setup; `more` = the rest after the
   `organizerOnly` filter (Organizer: Guide, Finale, Awards, Organizers;
   Host: Guide, Finale). The bar is a new client component
   `src/components/admin-bottom-bar.tsx` (`AdminBottomBar`), modelled on
   `BottomTabBar` (same close-on-route-change state adjustment, plus
   `onNavigate` on each Sheet link). It takes only serialisable props
   (`edition`, `storyTheme`, `email`, `isOrganizer`, `current`, `editions`)
   and highlights from `current`, not the pathname, so a page's own
   `current` stays the single source. The More Sheet reuses `MoreMenu`'s
   row classes by extracting its link row into an exported `MoreMenuLink`
   (or equivalent) in `more-menu.tsx`, not a hand-rolled list; Display,
   the edition switcher and "Signed in as … / Sign out" reuse the same
   bordered rows `MoreMenu` uses. Why: the AC wants unit tests of what a
   Host sees in the Sheet, and a closed Base UI Sheet renders no content
   in `renderToStaticMarkup`; the pure helper is testable, and the bar's
   tabs are tested by static render.
2. **30: the bar's height is a CSS variable.** The admin `ThemeRoot` sets
   `--admin-bar-height` (e.g. `4.5rem` below `md`, `0px` from `md`); the
   bar uses it for its height (plus `pb-[env(safe-area-inset-bottom)]`),
   the root gets bottom padding of
   `calc(var(--admin-bar-height) + env(safe-area-inset-bottom))` so `main`
   and the footer clear it, and ticket 33's sticky bar offsets by the same
   variable. Below `md` the header keeps only the "War Week <Edition>
   admin" link (`whitespace-nowrap truncate`); the Story Theme, switcher,
   back link, Display, email and Sign out get `hidden md:…`. The side
   column `nav` becomes `hidden md:block`; both navs keep
   `aria-label="Admin sections"` (smoke unchanged). Toasts: the shell's
   `Toaster` gets a bottom offset that clears the bar below `md`
   (`mobileOffset`, plus `offset` chosen with `useMediaQuery("(min-width:
   768px)")` from `src/hooks/use-media-query.ts` for 600–767px, where
   Sonner uses `offset`); from `md` the default offset, unchanged.
3. **31: rows live in the list, the form in a portal.** Each row is an
   `<li {...setupRowProps(id)}>` holding an "Edit <name>" button (first
   focusable in the row; the Competition's Bracket/Games link comes after
   it, outside the button) and that row's own `ResponsiveSheetDialog`
   (open state per row). The existing row component (form, fields,
   `useSetupRow`, `SetupRowButtons`) moves into the Sheet unchanged, its
   `<form aria-label=…>` kept, so `getByRole("form", { name: "New
   Competition" })` still resolves once the Sheet is open. `onSaved`
   closes the Sheet; a refusal keeps it open (today's `useSetupRow`).
   `SetupRowButtons` sits in a `ResponsiveSheetDialogFooter` made
   `sticky bottom-0` with the popover background. Because the Sheet is
   portalled, `SetupRowButtons` can no longer find its row with
   `closest()`: it takes the row id (new prop) and the editor element is
   found from the row in the list
   (`document.querySelector('[data-setup-row="<id>"]')?.closest('[data-setup-editor]')`).
   The focus target becomes the row's Edit button (still `FOCUSABLE`'s
   first match) and, for an emptied list, the Add button (marked with a
   new `data-setup-add` attribute instead of today's
   `button[type=submit]`). `setupRowFocusTarget` keeps its contract; its
   test gains a case for the Add marker and for ids read from list items
   only. If Base UI's dialog `finalFocus` wins the race against the
   frame-by-frame focus, add an optional `finalFocus` pass-through to
   `ResponsiveSheetDialog` (the one permitted edit outside 31's list) and
   record it.
4. **31: Sheet titles.** "Edit <name>" for an existing row (Team name,
   Participant display name, Competition name) and "Add <Team Label>" /
   "Add Participant" / "Add Competition" for the empty form. The list's
   add button uses the same label. Creating a Bracket or `games`
   Competition keeps today's `router.push` to its setup page.
5. **32: XII's free-for-all proof uses the admin edition switcher.** The
   e2e switches the Organizer to XII with "War Week to administer" (at
   1280, in the header) and switches back to XI in a `finally`. Seeds have
   no Awards, so the spec creates one on XI with a Team and deletes it in
   `finally`. `PointsEntryForm` gets a required `mode` prop; the unit
   render test (`src/components/points-entry-form.test.tsx`, new, static
   markup like the other component tests) renders both modes.
6. **33: `StickyFormActions`** in `src/components/sticky-form-actions.tsx`:
   a wrapper `div` that is `sticky bottom-[calc(var(--admin-bar-height)+env(safe-area-inset-bottom))]
   z-10 bg-background border-t py-3 md:static md:border-0 md:bg-transparent md:py-0`,
   children unchanged. The form using it gets `pb-*` for the bar's height
   below `md` and a `scroll-mb-*` on its fields (a class on the form that
   targets inputs, textareas, buttons and comboboxes) so a refused field
   isn't focused under the bar. Heights of the four named forms are
   measured at 375 on XI in the e2e (logged, recorded in the closeout);
   only those over 1,624px get the component.
7. **34: one pattern, one class per control kind.** Visible buttons:
   `min-h-11 min-w-11 sm:min-h-<today> sm:min-w-0` on top of today's
   `size`, the `<today>` read from the variant (xs = 6, sm = 7, icon-xs
   = 6) so the 1280 screenshot is unchanged. Icon buttons inside an input
   (combobox clear/trigger, email chip remove): the `after:absolute
   after:-inset-2.5 sm:after:hidden` hit area with `relative`, each with a
   "JG War Week edit" comment in `ui/combobox.tsx`.
8. **35: the color popover uses Base UI `initialFocus`.** `ColorField`
   passes `initialFocus` to `PopoverContent` (Base UI 1.8.0 Popover.Popup
   accepts a function): when `matchMedia("(pointer: coarse)").matches` it
   returns the popup element (a ref), else `true` (today's first-tabbable,
   the hex input). The e2e uses a context with `hasTouch: true, isMobile:
   true` at 375 for the touch case.
9. **37: reproduce through the real editor first.** The e2e creates a
   pinned one-line Announcement through `/admin/announcements/new` (typing
   one line, as an Organizer would) on XI, reads the stored `body` from
   the database, and measures the card on `/xi` at 375. Expected cause:
   empty paragraphs (the editor runs with `trailingNode: false`, so an
   Enter or a paste is the likely source); the fix trims leading and
   trailing empty paragraphs in `RichText` at render. If the reproduction
   shows no extra height, see human gate H1 before changing anything.
10. **38: Escape is filtered in `EntityCombobox`.** Base UI's
    `ComboboxInput` (1.8.0, `combobox/input/ComboboxInput.mjs:311`) on
    Escape with the popup closed sets the selection to `[]` with reason
    `"escape-key"`. `EntityCombobox`'s multiple branch ignores a value
    change whose `eventDetails.reason === "escape-key"` (the typed query
    still clears). The handler is a small exported function so it is
    unit-tested without a DOM; the repo has no jsdom or Testing Library,
    and adding them for one test is not worth a dependency. That function
    test plus the Bracket-builder Playwright check are the AC's "component
    test" and "Playwright check". Single mode is unchanged (out of scope).
    One fix covers `entrants-picker.tsx`, `squad-form.tsx` and
    `award-form.tsx`, which all use `EntityCombobox multiple`.
11. **38: Placement Points reach the Bracket results.** `BracketResults`
    doesn't receive the Competition's Placement Points today; thread
    `placementPoints` from `src/app/admin/brackets/[id]/page.tsx` (a
    permitted edit outside 38's list) and pick the copy from whether it is
    empty. `games-builder.tsx` already has `competition.placementPoints`.
    The Tree passes `days` to `BracketTree` and shows `formatHeatWhen` on
    each Heat box.
12. **One e2e file for the epic.** New `e2e/regression-r5.spec.ts`, one
    `test()` per ticket named `r5 <NN> …` (as `regression-r1.spec.ts`
    does), plus `r5 epic admin pages at 375 and 1280`. Screenshots go to
    `testInfo.outputPath(...)`, i.e. `test-results/e2e/<test>/`. Fixtures
    are created in the test and removed in `finally`: never edit or delete
    a seeded row other specs read (a throwaway Team/Participant is created
    for the delete-focus check; the changed Participant's Team is
    restored; the Host's `competition_host` row is deleted).
13. **Docs and `/about` (E-1).** Guide: the admin section bar and More
    Sheet, Setup rows opening in a Sheet (and "Assign Hosts" now inside
    the Competition's Sheet), and in "Add or change a form control" the
    44px-below-`sm` pattern, `StickyFormActions`, and the select trigger's
    new default height. `/about`: the `organizer-setup` card text gains one
    sentence on running Admin from a phone; the Brackets card says the
    Tree's Heat box shows its time and place. Media: run
    `pnpm tsx scripts/about-media.ts --stills`; only `standings-entry.png`
    (a 390px shot of `/admin/points`) is expected to change; commit it and
    restore any other rewritten still unless it shows an R5 change.

### Scope change: stabilise CI first (D0)

2026-09-30, approved by Paul with the plan: fix the CI failing on `staging`
in this epic. Three e2e tests flaked on docs-only changes the same day, so
none is a real regression, and R5's own CI criterion (E-4) can't be trusted
until they are fixed:

| Run | Test | Failure |
|---|---|---|
| [36792814336](https://github.com/paul-macfarlane/jg-war-week/actions/runs/36792814336) (`staging` push, #106) | `bracket-squads.spec.ts:188` | `addSquad` (`:169`): click on the Add Squad Sheet's **Team** combobox times out at 240s because an expanded sonner toast (bottom-center, from the previous Squad's save) intercepts the pointer, and stays expanded while the pointer is over it |
| [36784679113](https://github.com/paul-macfarlane/jg-war-week/actions/runs/36784679113) (#105) | `games.spec.ts:98` | `:262`: strict-mode violation, the "Closed — the leaderboard's Placement Points…" note (`games-view.tsx:315`) is rendered twice for a moment after `goto /xi/competitions/[id]` |
| [36779057036](https://github.com/paul-macfarlane/jg-war-week/actions/runs/36779057036) (#103) | `theme.spec.ts:331` | `:360`: `hex.fill` times out; the color picker's **Hex color** textbox never appears after `background.click()` |

Decisions:
- Find each cause before fixing (`mattpocock-skills:diagnosing-bugs`); fix
  it in the product where the product is wrong (a toast covering an open
  Sheet's controls, a note rendered twice), in the test only where the test
  races. No retries, longer timeouts or `force: true` clicks.
- The toast fix must stay compatible with D30's "toasts clear the bar below
  `md`"; D30 builds on it.
- Done when each fixed spec passes 5 consecutive local runs
  (`pnpm e2e e2e/<spec> --repeat-each=5`) and the slice gate passes.
  Evidence: the repeat output in `test-results/r5-gate/d0-repeat.txt`.
- D35 (color picker) must keep `theme.spec.ts:331` green.

### Structure: sequential, direct checkout

`pnpm e2e` binds port 3200 (`e2e/env.ts`, not configurable) and resets
every seeded War Week, and every deliverable needs a browser proof, so two
workers cannot prove at once (as in R4). The order honours the epic's
edges (33 after 30; 36 after 31 and 34; 32's screenshots after 34) and
puts 30 first so every later 375 screenshot already shows the new shell.

| Order | Deliverable | Ticket | Owns (predicted files) | Model |
|---|---|---|---|---|
| 0 | D0 Stabilise CI flakes | scope change | `e2e/bracket-squads.spec.ts`, `e2e/games.spec.ts`, `e2e/theme.spec.ts`, and per cause `src/components/ui/sonner.tsx` / `admin-shell.tsx`, `games-view.tsx` or its page, `color-field.tsx` | Opus |
| 1 | D30 Admin header and section bar | 30 | `src/lib/admin-sections.ts` (new), `src/components/admin-shell.tsx`, `src/components/admin-bottom-bar.tsx` (new), `src/components/more-menu.tsx` (extract the row), `src/components/admin-shell.test.tsx`, `src/lib/admin-sections.test.ts` (new), `e2e/regression-r5.spec.ts` (new) | Opus |
| 2 | D34 44px controls | 34 | `confirm-dialog.tsx`, `announcement-admin-buttons.tsx`, `setup-schedule-faq-buttons.tsx`, `src/app/admin/setup/{schedule,faq}/page.tsx` (Edit links), `rich-text-editor.tsx`, `ui/combobox.tsx`, `jg-email-chips.tsx`, `e2e/regression-r5.spec.ts` | Sonnet |
| 3 | D35 Selects and color picker | 35 | `ui/select.tsx`, `option-select.tsx`, `color-field.tsx`, `award-form.tsx` (drop its own trigger height only), `e2e/regression-r5.spec.ts` | Sonnet |
| 4 | D31 Setup rows in a Sheet | 31 | `teams-editor.tsx`, `competitions-editor.tsx`, `setup-row.tsx`, `src/lib/setup-row-focus.ts` (+ test), `e2e/regression-r1.spec.ts` ("r1 06 09"), `e2e/regression-r5.spec.ts`; `responsive-sheet-dialog.tsx` only per decision 3 | Opus |
| 5 | D32 Lists fit a phone; free-for-all drops Team | 32 | `src/app/admin/{points,announcements,awards}/page.tsx`, `points/[id]/page.tsx`, `points-entry-form.tsx` (+ new test), `award-form.tsx` (Team field rule), `e2e/regression-r5.spec.ts` | Sonnet |
| 6 | D33 Sticky Save | 33 | `sticky-form-actions.tsx` (new), `war-week-settings-form.tsx`, any of `announcement-form.tsx`, `schedule-item-form.tsx`, `next-war-week-form.tsx`, `award-form.tsx` over 1,624px, `e2e/regression-r5.spec.ts` | Sonnet |
| 7 | D36 Seed warning on Setup only | 36 | `src/app/admin/setup/{war-week,days,teams,competitions,schedule,faq}/page.tsx`, `scripts/smoke/setup.ts` | Haiku |
| 8 | D37 Pinned card fits its content | 37 | `rich-text.tsx` (+ `rich-text.test.tsx`) or `announcement-card.tsx`, per the cause; `e2e/regression-r5.spec.ts` | Sonnet |
| 9 | D38 Bracket fixes | 38 | `bracket-view.tsx`, `bracket-tree.tsx`, `entity-combobox.tsx` (+ new test), `bracket-builder.tsx` (help text), `bracket-results.tsx`, `src/app/admin/brackets/[id]/page.tsx` (prop), `games-builder.tsx` (closed note), the existing tests asserting the old copy (`bracket-builder.test.tsx`, `bracket-results.test.tsx`, `games-builder.test.tsx`, `bracket-view.test.tsx`), `e2e/regression-r5.spec.ts` | Sonnet |
| 10 | DE Epic visual check, docs, `/about` | epic | `e2e/regression-r5.spec.ts` (the epic test), `docs/maintainers-guide.md`, `src/lib/about.ts`, `src/app/about/page.test.tsx` if it asserts the card copy, `public/about/standings-entry.png` | Sonnet |

Predicted collisions, all serialised by the order: `e2e/regression-r5.spec.ts`
(every deliverable appends its own `test()`), `award-form.tsx` (D35 trigger
height, D32 Team rule, D33 only if over 1,624px), the Schedule and FAQ
pages (D34 Edit links, D36 warning removal). Each worker commits one
deliverable on `feat/regression-r5-admin-on-a-phone` against a clean tree.

Environment for every DB, smoke and e2e command (no `.env.local`):
`set -a; . ./.env.example; set +a`. Postgres: the `war-weeker-postgres`
container on `localhost:2345` (up at planning time). Run one spec with
`pnpm e2e e2e/regression-r5.spec.ts` (no `--`; `--` runs the whole suite).
Playwright empties `test-results/e2e/` on every run, so before each commit
restore other specs' committed screenshots with `git checkout --
test-results/e2e` for paths outside R5's.

Excluded: Days editor (stays inline), Schedule/FAQ row layout, Games
screens' layout, the participant side, single-mode Escape in
`EntityCombobox`, `games-view.tsx:242`, any schema or seed change.

### Verification map

Run surface: **local + deployed** (CI on the PR). Evidence policy per
`docs/agents/testing.md`, with Paul's standing R1 decision not to clear the
proof root: R5's `PASS` evidence is `test-results/e2e/regression-r5-*/`
(screenshots), `test-results/e2e/regression-r1-*/` for "r1 06 09", and
`test-results/r5-gate/gate.txt` (the final `pnpm format:check && pnpm
gate` output), all committed. Shorthand: **G** = `set -a; . ./.env.example;
set +a; pnpm format:check && pnpm gate > test-results/r5-gate/gate.txt 2>&1`
(exit 0; local Postgres, Chromium); **R5** = `pnpm e2e
e2e/regression-r5.spec.ts` (Chromium, local Postgres, seeded XI/XII).
Every ticket's "`pnpm gate` passes" row is G, earliest at DE, invalidated
by any change.

| Id | Criterion (short) | Command / action | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| 30-1 | Header one row ≤56px; with banner ≤96px | R5 `r5 30`: `boundingBox` of `header` at 375 on XI; then on XII (non-current → banner) header+banner | ≤56 / ≤96 | `regression-r5-r5-30-*/375*.png`, assertion in gate.txt | D30 | `admin-shell.tsx`, `editingBanner` |
| 30-2 | Fixed bar with safe-area padding on every page; current tab `aria-current`; in-More section highlights More and the row in the Sheet | `admin-sections.test.ts` (`adminNavFor` for each section); R5 `r5 30` asserts Setup tab `aria-current="page"` on `/admin/setup`, More current on `/admin/guide` with Guide highlighted in the open Sheet | as stated | gate.txt; screenshots | D30 | `admin-sections.ts`, `admin-bottom-bar.tsx` |
| 30-3 | Host sees no Awards/Organizers in bar or Sheet | `admin-sections.test.ts` (Host) + `admin-shell.test.tsx` static render; R5 Host at 375 opens More | absent | gate.txt; `…/host-more-375.png` | D30 | same |
| 30-4 | Sheet closes after a link navigates | R5: Organizer at 375 on `/admin/setup`, More → Awards, URL `/admin/awards`, dialog hidden | closed | gate.txt | D30 | `admin-bottom-bar.tsx` |
| 30-5 | Nothing under the bar; toasts above it | R5: scroll to bottom, footer's bottom ≤ bar's top; trigger a toast (e.g. save on `/admin/setup/days`) and assert its box is above the bar | no overlap | screenshot with toast | D30 | shell, Toaster offset |
| 30-6 | Both navs `aria-label="Admin sections"` | `pnpm smoke` (`admin.ts`, `hosts.ts` unchanged) | ok | gate.txt | D30 | shell |
| 30-7 | From `md` unchanged | 1280 screenshots of `/admin` and `/admin/setup` before (at `50acefb`, taken first by the D30 worker into `…/before-1280.png`) and after; visual compare by the orchestrator | identical layout | both PNGs | D30 | shell |
| 30-8 | Unit tests: Host hidden in bar and Sheet; More current for an in-More section | `pnpm test src/components/admin-shell.test.tsx src/lib/admin-sections.test.ts` | pass | gate.txt | D30 | those files |
| 30-9 | Playwright flow + screenshots 375/1280 | R5 `r5 30` | pass; PNGs present | `test-results/e2e/regression-r5-r5-30-*/` | D30 | as 30-2 |
| 31-1 | Compact rows; tap opens `ResponsiveSheetDialog` titled "Edit …" | R5 `r5 31`: Teams, Roster, Competitions rows are buttons "Edit <name>", ≥44px at 375; dialog name "Edit Ana P" etc. | as stated | gate.txt; list + sheet PNGs | D31 | editors, `setup-row.tsx` |
| 31-2 | Save: toast, closes, refreshes; refusal keeps Sheet, error under field, focused | R5: change a Participant's Team, save → toast, dialog hidden, row shows the new Team; refused save (blank name) → dialog visible, typed values kept, `toBeFocused()` on Name | as stated | gate.txt; PNG | D31 | same |
| 31-3 | Delete via `ConfirmDialog`; Sheet closes; focus to next/prev/Add; unit test | `pnpm test src/lib/setup-row-focus.test.ts`; R5: create throwaway Team, open, Delete, confirm → focus on the next row's Edit button | as stated | gate.txt | D31 | `setup-row.tsx`, `setup-row-focus.ts` |
| 31-4 | Creating Bracket/`games` Competition still goes to its setup page | `e2e/regression-r1.spec.ts` "r1 06 09" (Bracket); `e2e/games.spec.ts` unchanged pass | URL matches | gate.txt | D31 | `competitions-editor.tsx` |
| 31-5 | Teams <11,000px, Competitions <6,500px at 375 on XI | R5 measures `document.documentElement.scrollHeight` | under | logged in gate.txt | D31 | editors, shell |
| 31-6 | Smoke markers hold | `pnpm smoke` (`setup.ts`) | ok | gate.txt | D31 | editors |
| 31-7 | "r1 06 09" drives the form through the Sheet | `pnpm e2e e2e/regression-r1.spec.ts` | pass | gate.txt; `regression-r1-*/competition-form.png` | D31 | that spec, editor |
| 31-8 | Playwright at 375 + list/Sheet screenshots 375 and 1280 | R5 `r5 31` | PNGs | `regression-r5-r5-31-*/` | D31 | as above |
| 32-1 | No horizontal scroll at 375 on the three pages; actions visible | R5 `r5 32`: `scrollWidth <= clientWidth` for page and each list; each row's actions `toBeInViewport()` after scrolling the row into view vertically | as stated | gate.txt; PNGs | D32 (after D34) | the three pages |
| 32-2 | From `md` tables as today | 1280 screenshots, compare with `50acefb` shots taken first | same | PNGs | D32 | same |
| 32-3 | Edit links ≥44x44 below `sm` | R5 `boundingBox` at 375 | ≥44 | gate.txt | D32 | same |
| 32-4 | Free-for-all with no Award Team: no Team column/line or field; XI shows both | R5: on XII `/admin/awards` and `/admin/awards/new` (no "Team"); on XI with a created Award (Team column, form field) | as stated | PNGs | D32 | awards page, `award-form.tsx` |
| 32-5 | Points Entry label "Participant" in free-for-all before a Competition; Team Label on XI; unit test | `pnpm test src/components/points-entry-form.test.tsx`; R5 on XII and XI | as stated | gate.txt | D32 | `points-entry-form.tsx`, both callers |
| 32-6 | Screenshots 375/1280 of the three pages | R5 | PNGs | `regression-r5-r5-32-*/` | D32 | — |
| 33-1 | Save in viewport at top and after scrolling to any field; not over the bar | R5 `r5 33` at 375 on `/admin/setup/war-week`: Save `toBeInViewport()` at top, after `scrollIntoViewIfNeeded` on the first, a middle and the last field; Save's bottom ≤ bar's top | as stated | PNG | D33 | form, `sticky-form-actions.tsx`, `--admin-bar-height` |
| 33-2 | Last field and error line clear the bar; refused field not under it | R5: scroll to bottom, last field's bottom ≤ sticky bar's top; refused save focuses a field whose box is above the sticky bar | as stated | gate.txt | D33 | same |
| 33-3 | From `md` as today | 1280 screenshot compare | same | PNG | D33 | same |
| 33-4 | Other forms over 1,624px use it; heights recorded | R5 logs the four forms' `form` heights at 375 on XI | recorded; each >1,624 uses the component | gate.txt; closeout | D33 | those forms |
| 33-5 | "Reset to derived" ≥44px below `sm` | R5 `boundingBox` | ≥44 | gate.txt | D33 | settings form |
| 33-6 | `forms.spec.ts` settings-refused test passes; new 375 check | `pnpm e2e e2e/forms.spec.ts e2e/regression-r5.spec.ts` | pass | gate.txt; PNG | D33 | — |
| 34-1 | Each listed control ≥44x44 at 375 (box or `::after`) | R5 `r5 34`: `boundingBox` for visible buttons; for the `after:` ones, `getComputedStyle(el, "::after")` inset + element box ≥44 | ≥44 | gate.txt | D34 | the eight files |
| 34-2 | 1280 unchanged on `/admin/setup/faq` and `/admin/announcements/new` | screenshots at `50acefb` and after, compared | same | PNGs | D34 | same |
| 34-3 | Playwright measures one of each on the five pages; screenshots | R5 `r5 34` | pass; PNGs | `regression-r5-r5-34-*/` | D34 | same |
| 35-1 | Mode, Font, Team (Roster, Award), switcher 44px at 375, 36px at 1280, level with inputs | R5 `r5 35`: heights at both widths; `top` equal to the neighbouring input's within 1px where side by side | as stated | gate.txt | D35 | `ui/select.tsx`, `option-select.tsx` |
| 35-2 | Mode list opens below, not over the field above | R5: listbox `top` ≥ trigger `bottom` (or above with no room), and doesn't intersect the field above | as stated | PNG `mode-open-375.png` | D35 | `ui/select.tsx` |
| 35-3 | Touch: hex input not focused; mouse at 1280: focused | R5 with a `hasTouch/isMobile` context; second check at 1280 with mouse | as stated | gate.txt; PNG `color-open-375.png` | D35 | `color-field.tsx` |
| 36-1 | Warning on `/admin/setup`, none of the six | `pnpm smoke` (updated `setup.ts`) + `grep -rn SeedOverwriteWarning src/app` shows only `setup/page.tsx` | as stated | gate.txt | D36 | setup pages |
| 36-2 | Guide's seed-warning section unchanged | `git diff 50acefb -- src/components/organizer-guide.tsx` empty | empty | diff | D36 | the guide |
| 36-3 | Smoke checks presence on index, absence on war-week and days | read `scripts/smoke/setup.ts` diff; smoke passes | as stated | gate.txt | D36 | `setup.ts` |
| 37-1 | One-line pinned card <160px at 375 without video | R5 `r5 37`: create through the editor, measure the card on `/xi` | <160 (and failing before the fix, recorded as candidate evidence by the worker) | gate.txt; `home-pinned-375.png` | D37 | `rich-text.tsx`, card, editor |
| 37-2 | Unit test for the cause | `pnpm test src/components/rich-text.test.tsx` | leading/trailing empty paragraphs dropped, inner kept | gate.txt | D37 | `rich-text.tsx` |
| 37-3 | Screenshot at 375 | R5 | PNG | `regression-r5-r5-37-*/` | D37 | — |
| 38-1 | Tree shows `formatHeatWhen` at 375 and 1280; test | `pnpm test src/components/bracket-view.test.tsx` (Heat with Day, time, location in the Tree); R5 screenshot of the Tree at both widths | text present | gate.txt; PNGs | D38 | `bracket-view.tsx`, `bracket-tree.tsx` |
| 38-2 | Escape keeps chosen items; test + Playwright in the builder | `pnpm test src/components/entity-combobox.test.ts(x)`; R5: throwaway Bracket Competition, choose 3 Entrants, focus input, Escape → "3 chosen" | kept | gate.txt | D38 | `entity-combobox.tsx` |
| 38-3 | Format help text doesn't describe Points as chosen | `bracket-builder.test.tsx` asserts the new line and absence of "Points is Points Entries only" | as stated | gate.txt | D38 | `bracket-builder.tsx` |
| 38-4 | No Placement Points: Finalize confirm, finalized note, Games closed note don't claim Points Entries; with them unchanged | `bracket-results.test.tsx`, `games-builder.test.tsx` cover both cases | as stated | gate.txt | D38 | those components, the page prop |
| E-1 | `/about` and guide updated (bar, Setup Sheet at least) | diff read of `docs/maintainers-guide.md`, `src/lib/about.ts`; `public/about/standings-entry.png` regenerated by `pnpm tsx scripts/about-media.ts --stills` (needs `pnpm build`, a fresh seed `pnpm seed:load --reset seeds/*.json && pnpm seed:demo`, Google Chrome) | as decision 13 | diff | DE | the guide, about |
| E-2 | Playwright visual check: 7 pages × 375/1280 × Organizer and (where allowed) Host; no horizontal scroll at 375 | R5 `r5 epic`: for each page and role, assert shell or refusal; where shell, `scrollWidth <= innerWidth` at 375 and screenshot both widths | pass; 375 no overflow | `regression-r5-r5-epic-*/` | DE | any UI change |
| E-3 | Each ticket closeout recorded and `done` in this branch | `grep -n "Status" .scratch/regression-2026-09/issues/3[0-8]-*.md` | `**Status:** done` + `[CLOSEOUT]` comment, final commit | closeout commit | closeout | — |
| E-4 | CI runs smoke and e2e, passes | `gh pr checks <n>` | green | PR checks | after PR | any push |
| E-5 | `pnpm gate` locally | G | exit 0 | `test-results/r5-gate/gate.txt` | DE (final) | any change |

Candidate evidence gathered during planning (reuse unless invalidated):

- 38-2 cause, by source read at `50acefb`: `node_modules/@base-ui/react/combobox/input/ComboboxInput.mjs:311-320`
  (Base UI 1.8.0) sets the selection to `[]` for `multiple` on Escape
  with the popup closed, reason `"escape-key"`
  (`internals/reason-parts.js`). Invalidated by a `@base-ui/react`
  upgrade. Not a PASS: the behaviour still needs 38-2's tests.
- 36: the warning is on exactly the seven pages the ticket names (grep at
  `50acefb`); smoke's current check (`scripts/smoke/setup.ts:65-90`)
  requires "overwrites the setup" on `/admin/setup`, `/war-week` and
  `/days`, so it must change in D36. Invalidated by any edit to those
  pages.
- 35: `ui/select.tsx:45` has `data-[size=default]:h-8` and `:67`
  `alignItemWithTrigger = true`; `option-select.tsx:72` asks for
  `h-11 sm:h-9` (loses to the data variant's specificity).

### Fixtures and cleanup

All local: the seeded War Weeks that `e2e/global-setup.ts` reloads with
`--reset` before every run; stub JG sessions (`asOrganizer`, `asHost` from
`e2e/session.ts`; no Google). Created in tests and removed in `finally`:
an Award on XI (32), a pinned Announcement on XI (37), a throwaway Team
and Participant (31 delete-focus), a throwaway Bracket Competition (38,
`deleteXiCompetition`), the Host's `competition_host` row (30, epic), the
admin edition switched back to XI (32). The changed Participant's Team is
restored (31). Real employee data: none beyond seeded wiki names.

### Human gates

- **H1 (conditional, 37).** Only if the e2e reproduction of decision 9
  shows a one-line card already under 160px (no extra height locally).
  Prerequisite: the staging `/xii` pinned Announcement still shows the
  gap. Human action: Paul opens that Announcement's edit page on staging
  (or its row in the staging DB) and pastes its stored `body` JSON and
  `video_urls`, or a 375px screenshot with devtools showing the tall
  element. Expected: the element that takes the space is identified.
  Post-check: a local Announcement with that body reproduces the height
  before the fix and passes 37-1 after. Until then D37 is `BLOCKED`,
  not guessed.
- None other. CI (E-4) runs on push.

### Repository considerations (`planning.md`)

- No Drizzle schema, auth or access change; Host visibility still comes
  from `organizerOnly` (30) and the setup actions' own checks (31).
- No Finale or MCP change.
- Slice gate after each deliverable: `pnpm typecheck && pnpm lint && pnpm
  test` plus the deliverable's e2e spec(s); full G at DE. On a gate
  failure, stop and report.
- shadcn only: `Sheet`, `Card`, `Button`/`buttonVariants`,
  `ResponsiveSheetDialog`, `ConfirmDialog`, sonner; no new shadcn
  component and no new dependency is expected (decision 10 avoids jsdom).

## [PROGRESS]

- 2026-09-30: `/atlas-implement` started (work package `regression-r5`). Epic and tickets 30–38 claimed, `ready-for-agent` → `in-progress`. Direct checkout, sequential D0 → D30 → D34 → D35 → D31 → D32 → D33 → D36 → D37 → D38 → DE, one fresh worker per deliverable. Proof root `test-results/` not cleared (Paul's standing R1 decision; screenshots are committed evidence). Human gate H1 (37) announced for later; no gate actionable now.
- 2026-09-30: D0 accepted (`c8c2363`, Opus). Toast cause fixed in the product (`DismissToasts` in bottom `SheetContent` and `ResponsiveSheetDialog`); games and theme flakes were test races (Next's hidden streamed copy; the settings form remounting on refresh). `[SCOPE CHANGE]` deviation: `ui/sheet.tsx` and `responsive-sheet-dialog.tsx` edited (the shared primitives, where the cause is). `bracket-squads` leaves its Squads behind, so `--repeat-each` in one process fails on repeat 2; proven by 5 separate runs. Evidence `test-results/r5-gate/d0-repeat.txt`.
- 2026-09-30: D30 accepted (`6f7307a`, Opus). Deviations from decisions 1–2: icons are keys mapped by `AdminSectionIcon` (ADR 0001 lint forbids icons in `src/lib`); toast offset is CSS-only via `--admin-bar-inset` (no `useMediaQuery`). 1280 before/after byte-identical.
- 2026-09-30: D34 accepted (`0430954`, Sonnet). Combobox clear button has no live use (`showClear` unused), so it is class-only, unmeasured. FAQ Edit links became `buttonVariants` outline xs per the ticket, the only 1280 difference; `/admin/announcements/new` 1280 byte-identical.
- 2026-09-30: D35 accepted (`c6f89d5`, Sonnet). `SelectTrigger` default is now 44px / 36px from `sm` and `alignItemWithTrigger` defaults to false app-wide (ticket intent). Touch-focus assertion was not seen red first (test written before code but first run after).
- 2026-09-30: D31 accepted (`18c9c37`, Opus). Teams 6,807px (was 45,664), Competitions 2,629px at 375. No `finalFocus` needed; `responsive-sheet-dialog.tsx` untouched. Refusal proven with a whitespace-only name (browser `required` blocks a blank one). Competitions 1280 screenshots come from DE's epic test. Known cosmetic: the form unmounts on close, so the closing animation shows an empty Sheet (same as `GameForm`).
- 2026-09-30: D32 accepted (`8e814e8`, Sonnet). Below `md` the three lists are Card rows; from `md` the tables as before (each row rendered twice, one hidden by CSS). 32-2 before shots were taken at the D31 head (not `50acefb`) and the after shots after a full-suite run, so data differs; table structure compared by eye and unchanged apart from the outline Edit links. Full `pnpm e2e` 48 passed at `8e814e8`. The free-for-all `mode` rule is proven on XII, which also has no Teams, so the mode condition is not isolated in e2e (unit test covers `PointsEntryForm`).
- 2026-09-30: D33 accepted (`5bea652`, Sonnet; orchestrator fix amended in: removed an unused `eslint-disable`, moved `settings-1280-before.png` into the test's screenshot directory). Form heights at 375 on XI: Announcement 703, Schedule item 1,190, Next War Week 873, Award 509 — all under 1,624, so only the settings form uses `StickyFormActions` (offset `--admin-bar-inset`). 1280 before/after byte-identical. Noted for review: at 375 a refusal toast sits over the sticky Save row for its 4s.
- 2026-09-30: D36 accepted (`dd9afe9`, Haiku). Warning only on `/admin/setup`; smoke checks presence there and absence on war-week and days; `organizer-guide.tsx` unchanged since `50acefb`. The worker's cleanup reverted the orchestrator's uncommitted progress notes; restored and committed here.
- 2026-09-30: D37 `[BLOCKED]` at human gate H1. Reproduction through the real editor on XI at 375: stored body is one paragraph (`{"type":"doc","content":[{"type":"paragraph",…"Doors open at nine."}]}`), `video_urls` `[]`, card 112px on `/xi` and `/xi/news` (<160). The XII seed has no Announcements, so staging's was entered by hand. No code changed; draft spec kept in the orchestrator's scratchpad. Resume: Paul supplies staging `/xii`'s pinned Announcement `body` and `video_urls` (or a 375px devtools screenshot); a local Announcement with that body must reproduce ≥160px before any fix.
- 2026-09-30: D38 accepted (`e9a87d5`, Sonnet). Escape fix proven red with the fix disabled. Deviation: the un-finalize confirm title also drops "and delete its Points Entries" wording when there are no Placement Points (same copy bug, one line). Squad and Award pickers share the fix but were not driven in e2e.
- 2026-09-30: DE accepted (`623ee1c`, Sonnet). Epic test: Organizer shell on all 7 pages; Host shell on 4 and refusal on Teams, War Week settings and Awards; no horizontal scroll at 375. Guide and `/about` updated (37 not mentioned). Orchestrator follow-up: `organizer-setup.png` shows the shorter header (ticket 30), so per decision 13 it is regenerated and committed at verification.

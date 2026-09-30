# Execution record — Epic R4: Follow-ups from R3

Contract: [`R4-follow-ups-from-r3.md`](./R4-follow-ups-from-r3.md) and its
tickets [`21`](../issues/21-form-survives-sheet-dialog-switch.md),
[`23`](../issues/23-choice-groups-use-toggle-group.md) and
[`24`](../issues/24-end-war-week-warns-open-games.md). No `/atlas-plan` ran
(the epic says red-team is not required and the tickets are small); this
record derives the execution plan from the contract as it stands. Branch
`feat/regression-r4-follow-ups` from `staging` at `8c57be6` (R3 merged, PR
#92). `/atlas-implement` work package `regression-r4`.

## [EXECUTION PLAN]

2026-09-29.

### Resolved decisions

The choices the tickets leave open. None changes the contract.

1. **21 — one Base UI Dialog, styled per breakpoint with CSS.** The reset
   happens because `ResponsiveSheetDialog` renders `Dialog` below `lg` and
   `Sheet` at `lg`, two different component trees, so React remounts the
   children on the switch. shadcn's Sheet and Dialog are both Base UI
   `Dialog` underneath; the fix keeps *one* `Dialog` tree open and gives its
   popup the bottom-sheet classes below `lg` and the centered-dialog classes
   from `lg` up with Tailwind's `lg:` variants (the `data-[side=bottom]`
   slide-in below `lg`, the zoom/fade at `lg`). `useMediaQuery` leaves the
   wrapper. The exported `ResponsiveSheetDialog*` parts keep their names and
   their padding. If a single-tree implementation proves impossible with the
   shadcn primitives, the fallback is to keep both trees but hoist nothing:
   record the reason and stop for direction rather than lifting each form's
   state into its parent.
2. **21 — the e2e proof lives in `e2e/games.spec.ts`.** Fill the Game form
   at 375 (Player B, "Who won?"), resize to 1280, assert the values stay,
   then submit as today. The "shot before filling in" workaround and its
   comment go; `shoot(..., "log-form")` runs *after* filling in, which is
   the screenshot the ticket wants.
3. **23 — `ToggleGroup` with `ToggleGroupItem`, single-select.** Base UI's
   Toggle renders a `<button aria-pressed>` inside a `role="group"`, so the
   accessible shape the e2e specs query (`group` by name → `button` by name)
   stays. The "Who won?" group (`game-form.tsx`) and the `WinnerForm`'s
   "Winner" group (`heat-result-form.tsx`) become single-select toggle
   groups that cannot be deselected (a choice, not a toggle: the group's
   `value` is controlled and an empty change is ignored). The
   `FinishingOrderForm`'s "Finishing order" is *not* a choice group — a tap
   appends to an ordered list and only Undo removes — so it keeps its
   buttons; the ticket names "the Heat result form's choice", singular.
   Keep the 44px phone height and the existing labels (winner name + "won",
   "✓ Winner", the `EntrantMark`).
4. **24 — open `games` Competitions mirror the unfinalized-Bracket rule.**
   `getUnfinalizedBrackets` warns only about Brackets that were generated
   (at least one Heat). Its twin, `getOpenGamesCompetitions` in
   `src/queries/open-games-competitions.ts`, returns a War Week's `games`
   Competitions that are not closed (`finalized_at` null) and have at least
   one Game, by name, with the same DB-backed vitest pattern as
   `unfinalized-brackets.test.ts`. A Competition nobody logged in has no
   placings to lose, so it isn't listed. The dialog's `description` (already
   a `ReactNode` in `ConfirmDialog`) gains a second sentence after the
   Bracket one: "Still open: <Name>, <Name>. Their Placement Points aren't
   in the Standings until you close them." where each name is a `Link` to
   `/admin/setup/competitions/<id>/games`. The Bracket sentence is unchanged
   (`e2e/bracket-heats.spec.ts` asserts "Not finalized:").
5. **24 — proof in e2e.** The dialog copy exists only when the alert dialog
   is open, so `e2e/games.spec.ts` (which already has a Game logged and the
   Competition open before the Host closes it) opens End War Week on
   `/admin/setup`, asserts "Still open:" with the Competition's name and
   that the name is a link to its Games setup page, then Cancels — never
   confirming, as `bracket-heats.spec.ts` does.
6. **Docs.** `docs/maintainers-guide.md`: the End War Week step also names
   open Games Competitions (24); the "Add or change a form control" notes
   mention `ToggleGroup` for a single choice (23). `/about`: no copy change —
   none of the three is a showcase feature; the Games card's screenshot
   (`public/about/games.png`) shows the Competition page, not the form, so
   `scripts/about-media.ts` isn't re-run. Recorded here as the showcase-rule
   decision for E-1.

### Structure: sequential, direct checkout

| Order | Deliverable | Ticket | Owns (predicted files) | Model |
|---|---|---|---|---|
| 1 | D21 Forms survive the breakpoint | 21 | `src/components/responsive-sheet-dialog.tsx`, `e2e/games.spec.ts` | Opus |
| 2 | D24 End War Week warns about open Games | 24 | `src/queries/open-games-competitions.ts` (+ test), `src/app/admin/setup/page.tsx`, `src/components/war-week-lifecycle-controls.tsx`, `e2e/games.spec.ts`, `docs/maintainers-guide.md` | Sonnet |
| 3 | D23 Toggle groups | 23 | `src/components/ui/toggle-group.tsx`, `src/components/ui/toggle.tsx` (shadcn add; `package.json`/lockfile if it adds a dependency), `src/components/game-form.tsx`, `src/components/heat-result-form.tsx`, `docs/maintainers-guide.md`, e2e selectors only if the role shape changes | Sonnet |

Why sequential and no worktrees: `pnpm e2e` binds port 3200 and resets every
seeded War Week, so two workers cannot run it at once, and every deliverable
here needs an e2e run to prove itself. The two predicted file collisions are
`e2e/games.spec.ts` (D21 rewrites the log-form block at lines ~137–146,
D24 adds an End War Week block after the Host's edit, D23 touches the
"Who won?" selectors at ~144 and ~179 only if the role shape changes — D21's
and D23's hunks are five lines apart, inside one merge context) and
`docs/maintainers-guide.md` (D24 edits the End War Week step at ~187, D23
the form-control notes at ~403; far apart). Re-checked at closeout against
the real diffs. Each worker runs directly on `feat/regression-r4-follow-ups`
against a clean tree and commits one deliverable.

Environment: this checkout has no `.env.local`; DB, smoke and e2e commands
export the `.env.example` values first (`set -a; . ./.env.example; set +a`).
Postgres is the existing `war-weeker-postgres` container on `localhost:2345`.

### Verification map

Run surface: local + deployed (CI on the PR). Evidence policy per
`docs/agents/testing.md`: `PASS` artifacts are committed under
`test-results/`; the proof root is **not** cleared (Paul's R1 decision to
keep earlier epics' committed evidence, kept by R3); R4's evidence lives in
`test-results/e2e/games-*/` (reruns replace those directories) and
`test-results/r4-gate/gate.txt`. Human gates: none.

| Id | Criterion | Command / action | Real dependency | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|---|
| 21-1 | The wrapper keeps its children mounted across the switch | `pnpm e2e -- e2e/games.spec.ts` (the resize step) | Chromium, local Postgres | values typed at 375 are present at 1280 | `gate.txt`; `test-results/e2e/games-log-form/` | after D21 | any change to `responsive-sheet-dialog.tsx`, `ui/dialog.tsx`, `ui/sheet.tsx`, `game-form.tsx` |
| 21-2 | Playwright: fill at 375, resize to 1280, values stay; screenshots | same | same | spec passes; `games-log-form/375.png` and `1280.png` show the filled form | same | after D21 | same, or `e2e/games.spec.ts` |
| 21-3 | The screenshot-order workaround is removed | `grep -n "Shot before filling" e2e/games.spec.ts` returns nothing; diff read | none | no workaround comment; `shoot` after fill | diff against `8c57be6` | after D21 | `e2e/games.spec.ts` |
| 21-4 | `pnpm gate` passes | `set -a; . ./.env.example; set +a; pnpm gate` | local Postgres, Chromium | exit 0 | `test-results/r4-gate/gate.txt` | after D23 (final) | any change |
| 23-1 | `toggle-group` added; both forms use it | `ls src/components/ui/toggle-group.tsx`; `grep -n "ToggleGroup" src/components/game-form.tsx src/components/heat-result-form.tsx`; `grep -c 'aria-pressed' …` (only the Finishing order remains) | none | both forms import `ToggleGroup`; no hand-rolled `aria-pressed` outside `FinishingOrderForm` | diff against `8c57be6` | after D23 | either form |
| 23-2 | Keyboard and screen-reader behaviour at least as good; e2e selectors updated | `pnpm e2e -- e2e/games.spec.ts e2e/bracket-tree.spec.ts e2e/bracket-squads.spec.ts e2e/bracket-heats.spec.ts` plus an assertion in `games.spec.ts` that the chosen item is `aria-pressed=true` / focusable by keyboard (Tab to the group, arrow or Space to choose) | Chromium | specs pass | `gate.txt` | after D23 | either form, `ui/toggle*.tsx`, the specs |
| 23-3 | `pnpm gate` passes | as 21-4 | | | | | |
| 24-1 | End War Week lists each open `games` Competition with a link to its Games setup page, beside the Bracket warning | `pnpm e2e -- e2e/games.spec.ts` (the End War Week step) | Chromium, local Postgres | alertdialog contains "Still open:" and the Competition name as a link to `/admin/setup/competitions/<id>/games`; Cancel closes it | `gate.txt`; `test-results/e2e/games-end-warning/` | after D24 | `war-week-lifecycle-controls.tsx`, `setup/page.tsx`, the query |
| 24-2 | Unit test for the query; e2e check of the dialog copy | `pnpm test -- src/queries/open-games-competitions.test.ts` and 24-1 | local Postgres | open+has-Game listed; closed, empty, other-War-Week and Bracket Competitions not | `gate.txt` | after D24 | the query or its test |
| 24-3 | `pnpm gate` passes | as 21-4 | | | | | |
| E-1 | `/about` and the guide updated where user-visible | diff read of `docs/maintainers-guide.md` (24's warning, 23's ToggleGroup note); decision 6 for `/about` | none | guide names open Games Competitions in the End War Week step | diff against `8c57be6` | after D24 and D23 | the guide |
| E-2 | Each ticket records its closeout and is `done` in this branch | `grep -n "Status" .scratch/regression-2026-09/issues/2[134]-*.md` | none | `**Status:** done` and a `[CLOSEOUT]` comment in the final commit | the closeout commit | closeout | — |
| E-3 | CI on the PR runs smoke and e2e, and passes | `gh pr checks <n>` | GitHub Actions | all checks green | PR checks page | after the PR | any push |
| E-4 | `pnpm gate` passes locally | as 21-4 | | | | | |

## [PROGRESS]

- 2026-09-29 **D21 integrated** at `dd8d530` (Opus, direct checkout). One
  Base UI `Dialog` tree; the popup carries the bottom-Sheet classes below
  `lg` and the centered-Dialog classes from `lg` (Tailwind `lg:` variants,
  CSS transitions for both animations), the Sheet's close button in both.
  `ui/dialog.tsx` and `ui/sheet.tsx` unchanged. The worker's e2e assertion
  failed against the old wrapper (`aria-pressed` "false" after the resize)
  and passes after it. Orchestrator fix, amended in: the worker had kept
  `useMediaQuery` only to set `data-slot="dialog-content"`/`"sheet-content"`
  for `e2e/bracket-tree.spec.ts`; that spec already proves the geometry with
  `boundingBox` polls, so the popup is now `data-slot=
  "responsive-sheet-dialog-content"`, the hook is gone and the three
  attribute assertions were removed. Re-verified: typecheck, lint (8
  pre-existing `no-img-element` warnings), build, `pnpm e2e e2e/games.spec.ts
  e2e/bracket-tree.spec.ts` → 3 passed. Candidate evidence 21-1..21-3 at
  `dd8d530`: `test-results/e2e/games-log-form/{375,1280}.png` show the
  filled form in both layouts. Note for later runs: `pnpm e2e -- <spec>`
  runs the whole suite (the `--` reaches Playwright); use `pnpm e2e <spec>`.
  Playwright clears `test-results/e2e/` on every run, so other specs'
  committed screenshots are restored with `git checkout` before committing.
- 2026-09-29 **D24 integrated** at `dfeca12` (Sonnet, direct checkout).
  `getOpenGamesCompetitions` (`src/queries/open-games-competitions.ts`)
  mirrors `getUnfinalizedBrackets`: `games`, `finalized_at` null, at least
  one `game` row, by name; six DB-backed vitest cases (the fixture inserts
  an `organizer` row so `logGame` can build real Game rows). The End War
  Week description is now a fragment: the Winner sentence, the unchanged
  Bracket sentence, then "Still open: <links>. Their Placement Points
  aren't in the Standings until you close them." `e2e/games.spec.ts` opens
  it as an Organizer (a second context via `asOrganizer`), asserts the copy
  and the link's `href`, shoots `games-end-warning/{375,1280}.png`, Cancels.
  Guide's End War Week step names it. Accepted without changes. Candidate
  evidence 24-1, 24-2 at `dfeca12` (vitest 11 passed across both query
  suites; `pnpm e2e e2e/games.spec.ts e2e/bracket-heats.spec.ts` → 2 passed).
- 2026-09-29 **D23 integrated** at `b426892` (Sonnet, direct checkout).
  `pnpm dlx shadcn@latest add toggle-group` added `ui/toggle.tsx` and
  `ui/toggle-group.tsx` (no new dependency). "Who won?" and the
  `WinnerForm`'s "Winner" are `ToggleGroup`s, single-select and
  non-deselectable (an empty `onValueChange` is ignored); the pressed item
  is styled `bg-primary text-primary-foreground` via `aria-pressed:` /
  `data-pressed:` overrides on `variant="outline"`; `FinishingOrderForm`
  unchanged (decision 3). Base UI renders `role="group"` + `<button
  aria-pressed>`, so no Bracket spec selector changed. `games.spec.ts`'s
  Host edit now flips the winner by keyboard (focus, ArrowRight, Space),
  which failed against the hand-rolled buttons and passes now. Guide note
  added. Accepted without changes. Candidate evidence 23-1, 23-2 at
  `b426892` (`pnpm e2e` games + bracket-tree + bracket-squads +
  bracket-heats → 5 passed; `pnpm test src/components` 102 passed;
  `games-host-edit/*.png` and the bracket-tree `result-dialog-1280.png` /
  `result-sheet-375.png` committed as the visual proof).
- 2026-09-29 **All deliverables integrated**; aggregate code review and the
  full `pnpm gate` start from `b426892`.
- 2026-09-29 **Aggregate review fixes** at `ba3b657` (orchestrator, inline):
  see [AI CODE REVIEW]. Paused once on an auto-mode permission denial (a
  combined command that would have `git checkout` an uncommitted file);
  resumed on Paul's "continue".

## [AI CODE REVIEW]

2026-09-29. Two fresh Opus reviewers read `8c57be6..b426892`, one per
axis; the orchestrator judged each candidate against the cited hunks.

### Axis 1: technical implementation and spec conformity

| Id | Severity | Paths | Finding | Disposition |
|---|---|---|---|---|
| T1 | blocking | `heat-result-form.tsx`, `game-form.tsx` | The generated `ToggleGroup`'s `w-fit` survived the callers' `grid`, so the Heat Winner group shrank to its content (confirmed in `result-sheet-375.png`) | resolved: `w-full` on both groups; screenshots re-checked |
| T2 | non-blocking | `ui/toggle-group.tsx` | Roving focus is horizontal, so on the phone stack Up/Down don't move (Left/Right do) | deviation approved: no single orientation fits both breakpoints; `ui/` stays as generated |
| T3 | non-blocking | both forms | Tab enters the group on its first item, not the pressed one | deviation approved: one tab stop plus arrows is the standard ARIA toggle-group pattern |
| T4 | non-blocking | `open-games-competitions.test.ts` | The Bracket case would pass without the Format clause | resolved: that Competition gets a Game row, so only the Format excludes it |
| T5 | non-blocking | `war-week-lifecycle-controls.tsx` | No test renders both warnings together | deviation approved: independent conditionals, each proven alone (`bracket-heats`, `games` specs) |
| T6 | non-blocking | both forms | Pressed classes duplicated as `aria-pressed:` and `data-pressed:` | resolved: `aria-pressed:` only |
| T7 | — | `responsive-sheet-dialog.tsx` | Parity check: overlay, Escape, outside click, close, scroll, `ThemeRoot` portal, naming all kept | no finding |
| T8 | non-blocking | `e2e/games.spec.ts` | Keyboard proof starts from `.focus()`, Game form only | deviation approved: it fails against the old buttons; the Winner form is the same component |

The reviewer's gate "incomplete" note came from reading `gate.txt` mid-run; the finished run is exit 0.

### Axis 2: coding standards

| Id | Severity | Paths | Finding | Disposition |
|---|---|---|---|---|
| S1 | non-blocking | `open-games-competitions.ts` | JSDoc said `finalized_at` null means "closed" (inverted) | resolved |
| S2 | non-blocking | both forms | Pressed-look classes repeated in the two consumers | deviation approved: four classes, two sites; a shared wrapper waits for a third choice group |
| S3, S4 | non-blocking | both forms | `variant` per item instead of on the group; untyped `onValueChange` in the Heat form; the `Outcome` union written three times | resolved |
| S5 | non-blocking | new files | `format:check` (run by CI, not by the gate) unrecorded | resolved: in `test-results/r4-gate/gate.txt` |
| S6, S13 | non-blocking | `responsive-sheet-dialog.tsx` | `.join(" ")` instead of `cn`; JSDoc described history | resolved |
| S7 | non-blocking | `responsive-sheet-dialog.tsx` | Overlay and close button re-typed instead of `DialogOverlay`/`DialogClose` | deviation approved: they deliberately keep the Sheet's look at every width; only `Popup` lacks a shadcn wrapper |
| S8 | non-blocking | `war-week-lifecycle-controls.tsx` | Long JSDoc; `{id, name}[]` repeated | resolved: `OpenGamesCompetition` exported from the query |
| S9, S10, S11 | non-blocking | guide, `testing.md`, `games.spec.ts` | Guide sentence hard to read and mixed terms; e2e coverage row stale; ambiguous spec comment | resolved |
| S12 | non-blocking | `open-games-competitions.test.ts` | The same Competition insert repeated six times | resolved: `pong` fixture helper |

No blocking finding is open.

## [CLOSEOUT]

2026-09-29. `/atlas-implement` work package `regression-r4`, one repository delivery: `war-weeker`, branch `feat/regression-r4-follow-ups` from `staging` `8c57be6`, PR https://github.com/paul-macfarlane/jg-war-week/pull/93.

### Deliverables

| Deliverable | Ticket | Worker | Integrated |
|---|---|---|---|
| D21 Forms survive the breakpoint | 21 | Opus (direct checkout) | `dd8d530` (orchestrator fix amended in: no `useMediaQuery` attribute spoof; `bracket-tree.spec.ts` keeps its geometry assertions) |
| D24 End War Week warns about open Games | 24 | Sonnet (direct checkout) | `dfeca12` |
| D23 Toggle groups | 23 | Sonnet (direct checkout) | `b426892` |
| Review fixes | all | orchestrator | `ba3b657` |

### Verified run command

`set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate` returned **exit 0** at `ba3b657`: format clean; vitest 128 files, 2889 tests; smoke 198 ok; e2e 35 passed. Raw output: `test-results/r4-gate/gate.txt`. Its one `ELIFECYCLE … exit code 143` line is the smoke server being stopped, as in R3's `gate.txt`.

### Criteria

| Id | Verdict | Evidence |
|---|---|---|
| 21-1 The wrapper keeps its children mounted across the switch | PASS | `e2e/games.spec.ts` in `gate.txt` (fails against the old wrapper: `aria-pressed` "false" after the resize) |
| 21-2 Playwright: fill at 375, resize to 1280, values stay; screenshots | PASS | `gate.txt`; `test-results/e2e/games-log-form/{375,1280}.png` show the filled form |
| 21-3 Screenshot-order workaround removed | PASS | `grep "Shot before filling" e2e/games.spec.ts` → 0; `shoot` runs after the fill |
| 21-4 `pnpm gate` passes | PASS | `gate.txt` |
| 23-1 `toggle-group` added; both forms use it | PASS | `src/components/ui/toggle-group.tsx`; both forms import it; the only `aria-pressed` left is "Finishing order" (decision 3) |
| 23-2 Keyboard and screen reader at least as good; e2e selectors updated | PASS | the same `group` → `button[aria-pressed]` shape (no Bracket spec selector changed; all four specs pass); keyboard flip in `games.spec.ts` (fails against the old buttons); T2/T3 recorded |
| 23-3 `pnpm gate` passes | PASS | `gate.txt` |
| 24-1 Dialog lists each open `games` Competition with a link, beside the Bracket warning | PASS | `games.spec.ts` (copy and `href`, Cancel); `bracket-heats.spec.ts` still sees "Not finalized:"; `test-results/e2e/games-end-warning/{375,1280}.png` |
| 24-2 Unit test for the query; e2e of the dialog copy | PASS | `src/queries/open-games-competitions.test.ts` (6 cases) in `gate.txt`; 24-1 |
| 24-3 `pnpm gate` passes | PASS | `gate.txt` |
| E-1 `/about` and guide updated where user-visible | PASS | guide End War Week step (24) and ToggleGroup note (23); `/about` unchanged by decision 6 |
| E-2 Each ticket records its closeout and is `done` in this branch | PASS | this commit |
| E-3 CI on the PR runs smoke and e2e, and passes | pending at closeout | https://github.com/paul-macfarlane/jg-war-week/pull/93: checks start with this push |
| E-4 `pnpm gate` passes locally | PASS | `gate.txt` |

### Deviations

- D21: the popup is `data-slot="responsive-sheet-dialog-content"`; `bracket-tree.spec.ts` dropped its `data-slot`/`data-side` assertions and keeps its `boundingBox` geometry.
- Review deviations T2, T3, T5, T8, S2 and S7 above.

Proof root: not cleared, per Paul's R1 decision. R4's evidence is `test-results/r4-gate/` plus the regenerated `games-*` and `bracket-tree-*` screenshots. Other specs' screenshots re-rendered by local runs were restored, not committed.

### Isolation re-check

The plan predicted collisions in `e2e/games.spec.ts` and `docs/maintainers-guide.md`. The real hunks never overlapped:
- `games.spec.ts`: D21 at 134, D24 at 14 and 206, D23 at 181.
- The guide: D24 at 188, D23 at 413.

Worktrees would have merged cleanly. The sequential choice held for the other reason it gave: `pnpm e2e` binds port 3200 and resets the shared seeded database, so two workers can't prove their deliverables at once.

### Follow-ups (not in this PR)

None new. T2 (phone arrow keys) and S2 (a shared choice wrapper) would be revisited if a third choice group appears.

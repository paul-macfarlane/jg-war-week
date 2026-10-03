# Execution record: Epic R14, quick wins from the R8 checklist run

Contract: [`R14-quick-wins.md`](./R14-quick-wins.md) and its tickets
[`78`](../issues/78-admin-refusal-wears-war-week.md), [`79`](../issues/79-points-entry-form-first-on-phone.md),
[`80`](../issues/80-home-banner-placeholder-repeats-name.md), [`81`](../issues/81-guide-team-you-highlight.md),
[`82`](../issues/82-competition-group-tabs-cut-off-on-phone.md), with Paul's triage decisions in each ticket's Comments.
No `/atlas-plan` ran. On 2026-10-03, `/atlas-implement` derived this plan against `staging` at `40f63a7` (R13 merged, PR #121).
Red-team: not required (no schema, auth or access change).
Branch: `fix/regression-r14-quick-wins`.

## [EXECUTION PLAN]

2026-10-03.

### Run record

- Work package `regression-r14`; branch `fix/regression-r14-quick-wins` from `staging` at `40f63a7`.
- Structure: wave.
  - **Wave 1** runs D78 ‖ D79 ‖ D80 ‖ D81 ‖ D82, one worker each, in worktrees `.claude/worktrees/regression-r14/war-weeker/d<NN>`.
  - **Wave 2** is **DX**: docs, `/about` and the checklist, on the feature branch.
  - **Wave 3** is **EV**: evidence on the integrated build, by a fresh agent that implemented nothing.
  - Edges: every D → DX → EV.
- Why parallel in wave 1: each ticket owns disjoint source files.
  - D78: `src/components/admin-shell.tsx` and its test.
  - D79: `src/app/admin/points/page.tsx`.
  - D80: `src/components/war-week-hero.tsx`.
  - D81: `src/components/organizer-guide.tsx`.
  - D82: `src/app/[edition]/competitions/(list)/page.tsx`.
  - Predicted collisions: none in source. The shared prose (`docs/regression-checklist.md`, `docs/maintainers-guide.md`, `/about`) is held back for DX, so the workers can't collide there.
- Workers run `pnpm format`, `pnpm typecheck`, `pnpm lint` and `pnpm test` only. `pnpm build`, `smoke` and `e2e` share local Postgres and port 3200, so they run once, on the integrated branch.
- `test-results/` is cleared at the start, per the evidence policy. R14 evidence lives under `test-results/r14/<test>/`; `pnpm gate` regenerates `test-results/e2e/`.

### Resolved decisions

- **78:** wrap `AdminRefused` in `ThemeRoot` with `warWeekThemeStyle(warWeek)`, plus the shell's `bg-background text-foreground font-sans` and a full-height column, so the footer stays pinned. Every refusal call site renders through `AdminRefused`, so one change covers them all. Extend `admin-shell.test.tsx` to cover the `data-theme-root` and the War Week's `--font-sans`.
- **79:** move the Brackets, Games and Participation quick-link sections from above the form grid to below it, before the Ledger. The ticket names two lists; Participation is the third and shares the same failure. Their `mb-8` becomes `mt-8`. Desktop order: form and standings, then the quick links, then the Ledger.
- **80:**
  - With no `bannerUrl`, render no banner block.
  - Also drop the hero's eyebrow "War Week" span. It repeats the heading directly below it ("names the War Week once in its hero").
  - A War Week with a Banner URL is unchanged.
  - The hero is shared with the Archive (`archive.tsx`), so the Archive changes too, which is intended.
- **81:**
  - Rewrite the guide's "What a Participant email does" paragraph to say exactly where You and "Your Team" show today:
    - the Participant's own rows carry You;
    - a `games` Competition's leaderboard marks their enrolled Team "Your Team";
    - Team standings rows are not highlighted.
  - The worker confirms each surface in code before writing it.
  - No app behavior changes. Also update `CONTEXT.md` ("You") only if it disagrees.
- **82:** the Group `TabsList` on the Competitions page wraps (`flex-wrap`, auto height) instead of scrolling sideways. Change this page's classes only, not `src/components/ui/tabs.tsx`. The active indicator and keyboard arrows must keep working.
- **DX:** update `docs/regression-checklist.md` lines for the five pages; `docs/maintainers-guide.md` and `/about` copy and stills only where a change is visible in them.

### Verification map

| Criterion | Command / action | Surface | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| AC78 | Unit test in `admin-shell.test.tsx`. EV: as a Host on `/admin/organizers` and `/admin/brackets/<a Competition they don't host>`, and as the unlinked account on `/admin`, at 1440×900 and 390×844, read `[data-theme-root]` and its `--font-sans` / `--light-primary` | local build, seeded demo | `[data-theme-root]` present with the War Week's vars; themed colors visible | `test-results/r14/ac78-refusal-*/` (png + DOM json) | after wave 1 (unit); after DX (EV) | any change to `admin-shell.tsx` or theme code |
| AC79 | EV: Organizer at 390×844 on `/admin/points`, XII and XI demos; measure the "Add a Points Entry" heading and the Competition, Participant and Points fields' `getBoundingClientRect().bottom` against `innerHeight` minus the admin bar | local build | all ≤ the visible height | `test-results/r14/ac79-points-390/` | after DX | `points/page.tsx`, admin shell layout |
| AC80 | Unit or render check that no placeholder renders without `bannerUrl`. EV: linked Participant, XII demo, `/xii` at 390×844: count the War Week name in the hero, and the "Log a Game" heading's top is < the viewport's visible height | local build | name once in the hero; the Log a Game heading on the first screen | `test-results/r14/ac80-home-390/` | after DX | `war-week-hero.tsx`, the Home page |
| AC81 | EV: read `/admin/guide`'s paragraph. As the linked Participant on the XI teams demo, check Home and Leaderboard Team standings (no You), their own rows (You), and a `games` leaderboard ("Your Team") | local build | every sentence matches the app | `test-results/r14/ac81-guide/` | after DX | `organizer-guide.tsx`, any You logic |
| AC82 | EV: `/xi/competitions` at 390×844, linked and unlinked. Run the clipping check (no text element past the left or right edge); tablist `scrollWidth ≤ clientWidth`; every tab's rect is inside the viewport | local build, XI demo | passes; all 3 tabs visible | `test-results/r14/ac82-tabs-390/` | after DX | the competitions page, `ui/tabs.tsx` |
| DoD1 | Review: the DX diff updates the checklist lines for 78–82, and the guide and `/about` where affected | repo | updated | DX commit | after DX | any later user-visible change |
| DoD2 | Each ticket file has `[CLOSEOUT]` and `Status: done` on the branch | repo | present | ticket files | closeout | — |
| DoD3 | `pnpm format:check && pnpm gate` on the final integrated commit; PR CI | local + CI | exit 0; CI green | captured output in `test-results/r14/gate/` | after EV | any change |

Human gates: none. No deploy in this work package. CI on the PR runs automatically.

## [PROGRESS]

- 2026-10-03, wave 1 integrated into `fix/regression-r14-quick-wins`, in order D82, D81, D78, D79, D80.
  - D82 (Sonnet): `813e7da`.
  - D81 (Sonnet): `e6b5da6`. Orchestrator fix: the worker's paragraph left out the Bracket "You" mark and Participation lists, so it was reworded and amended.
  - D78 (Sonnet): `f26c08e`.
  - D79 (Haiku): `cf3cd34`.
  - D80 (Haiku): `2d8bbda`. Orchestrator fix: JSDoc wording, amended.
- Acceptance screens passed. Every worker ran format, typecheck, lint and unit green. The integrated typecheck and the focused tests pass. Visual criteria await EV.
- 2026-10-03, wave 2 (DX, Sonnet) `deecf4f`: the checklist lines for 78–82.
  - The worker found no change needed in the maintainers guide, `/about` copy or CONTEXT.md.
  - It could not regenerate the stills: its shell had no `DATABASE_URL`, so the scripts fell back to a non-local database and refused.
  - Orchestrator fix `745c34b`: regenerated `points*.png` and `standings-entry*.png` with the local URL from `.env.example`. The other stills differed only in bytes and were reverted.
- 2026-10-03, wave 3 (EV, Sonnet, an independent agent) at `745c34b`: all five checks PASS.
  - Setup: it linked the e2e participant by email and enrolled XI Teams in Tuesday Stairs to show "Your Team". The final reseed reset both.
  - Its ad-hoc sign-ins left 4 stub e2e users (normally removed by the e2e global teardown). These broke `src/mutations/account.test.ts`, which counts users and sessions across the whole database. The orchestrator deleted them and the test passed (3/3).

## [AI CODE REVIEW]

2026-10-03. Two independent Opus reviewers read `5e2b34b..356616e` (src, docs, public, CONTEXT.md); the orchestrator adjudicated.
The fixes are in `a1b7ba3`, and the stills were regenerated again in `26181c3`.

- **Both axes, blocking (resolved):** the guide's Points blurb still said Brackets and Games are "linked at the top". Ticket 79 made that false. It now reads "…the Brackets, Games and Participation Competitions waiting on results are linked under the form."
- **Spec conformity, non-blocking (all resolved):**
  - F2: on a phone, the quick links landed below the full Standings, an extra scroll for a Host who wants a Bracket (a need ticket 79 names). They now share the form's column: form, then links, then Standings on a phone; the form still opens the page.
  - F3: the You paragraph names team Brackets (their Squad or Team) and "Award recipients on the Awards page".
  - F4: CONTEXT.md's You entry is extended to match the guide.
  - F5: the `/about` "highlighted wherever you appear" now names the leaderboards, the roster and your Brackets.
  - F6: the checklist's Home line counts the name "in the hero" and checks Log a Game on the first screen at 390.
  - F7: the hero test fixture uses `bannerUrl: null` and `status`.
  - F8: a long Group tab name wraps (`max-w-full whitespace-normal text-left`).
  - F9: the refusal test asserts the footer sits inside the themed root.
- **Coding standards, non-blocking (all resolved):**
  - The checklist was re-wrapped to the file's width.
  - The hero test names use domain words.
  - `|| []` became `?? []`.
  - A guide test now pins the You copy ("Your Team"; "Squad standings rows are not highlighted").
- **Noted, not in scope:** `src/app/admin/error.tsx` (a `ThemeRoot` with no War Week style) and the root `not-found.tsx` aren't themed. Neither is the refusal page AC78 covers.
- No finding was rejected.

## [VERIFICATION]

2026-10-03. Every criterion has a final evidence-backed verdict. Evidence is committed under `test-results/r14/`.

| Criterion | Verdict | Proven at | Evidence |
|---|---|---|---|
| AC78 | PASS | `745c34b` (runtime unchanged through `26181c3`) | `ac78-refusal-{ffa,teams}-{1440,390}/`: 12 cases (Host on `/admin/organizers` and on a Competition they don't host, unlinked on `/admin`). Each has `[data-theme-root]`, the edition's `--light-primary` (XII `#c2185b`, XI `#0a7a1f`) and `--font-sans`, a themed link color, and the footer pinned. |
| AC79 | PASS | `26181c3` | `ac79-points-{ffa,teams}-390/`: at 390×844 the heading bottom is 101, and the Competition, Participant/Team and Points fields end at 182, 274 and 371, all at or above the bottom bar's top (771). The quick links sit above Current standings. 1440 screenshots too. |
| AC80 | PASS | `745c34b` (runtime unchanged) | `ac80-home-xii-{390,1440}/`: no banner block; "War Week XII" once in the hero; the Log a Game heading at 353 of 844 (390) and 393 of 900 (1440). The Archive `/x` hero has no block. |
| AC81 | PASS | `26181c3` (guide text); participant pages at `745c34b`, You logic unchanged | `ac81-guide/`: the paragraph text recorded. Team standings rows untagged on Home and the Leaderboard; You on the individual leaderboard, the roster and Awards; "Your Team" on a `games` leaderboard. The Bracket mark couldn't be checked on XI (the demo has no Bracket) and is proven by `e2e/bracket.spec.ts` ("Your next Heat" and the You mark). |
| AC82 | PASS | `26181c3` | `ac82-tabs-{linked,unlinked}-390/`: the tablist wraps, `scrollWidth` 358 = `clientWidth` 358, all 3 tabs inside 0–390, no clipped text, the third tab opens its panel, and arrow keys move focus. |
| DoD1 | PASS | `26181c3` | The checklist lines for 78–82, CONTEXT.md You, the `/about` copy, the guide, and the `points` and `standings-entry` stills (light and dark). The maintainers guide needed no change. |
| DoD2 | PASS | closeout commit | `[CLOSEOUT]` and `Status: done` in tickets 78–82 and the epic. |
| DoD3 | PASS (local); CI pending on the PR | `26181c3` | `pnpm format:check && pnpm gate` exit 0: 174 unit test files (3733 tests); build; smoke; e2e 91 passed. Log: `test-results/r14/gate/gate.log`. |

## [CLOSEOUT]

2026-10-03, `/atlas-implement`.

- **Repository:** `war-weeker`, branch `fix/regression-r14-quick-wins`, base `staging` at `40f63a7` (comparison point `5e2b34b`).
- **Deliverables:**
  - D78, D81, D82: Sonnet.
  - D79, D80: Haiku.
  - DX: Sonnet.
  - EV: Sonnet, independent.
  - Reviews: two Opus reviewers.
  - Orchestrator fixes: D81 wording, D80 JSDoc, the stills, and the review-fix batch `a1b7ba3`.
- **Parallelism:** wave 1 ran 5 workers in parallel worktrees, with no source conflicts. That matches the plan, which predicted none. `organizer-guide.tsx` was later touched by both D81 and the review fixes, in sequence, with no conflict.
- **Deviations (approved in the plan):**
  - 79 also moves the Participation links.
  - 80 also drops the hero's "War Week" eyebrow.
  - Review F2 placed the quick links in the form's column (form, links, Standings on a phone). This still meets AC79 and Paul's "below the form" decision.
- **Verified run command:** `pnpm format:check && pnpm gate`, with `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg` (the local values from `.env.example`). No deploy in this work package.
- **Remaining risks:**
  - `/admin` error and root 404 pages are unthemed (outside 78).
  - `src/mutations/account.test.ts` fails if stray `e2e-*` users remain in the local database. Ad-hoc browser runs that skip the e2e teardown leave them.
- **PR:** https://github.com/paul-macfarlane/jg-war-week/pull/122 into `staging`.

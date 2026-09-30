# Execution record — Epic R1: Fixes and quick wins

Contract: [`R1-fixes-and-quick-wins.md`](./R1-fixes-and-quick-wins.md) and its
tickets `01`–`10`, `16` under [`../issues/`](../issues/). Paul's triage
decisions of 2026-09-28 (02, 04, 05, 06) are recorded in each ticket's
Comments and are part of the contract. Branch `feat/regression-r1-quick-wins`
from `staging` at `c85d5e5`. `/atlas-implement` work package `regression-r1`.

## [EXECUTION PLAN]

### Structure: two waves, parallel worktrees

Wave 1 (parallel, one worktree each under
`.claude/worktrees/regression-r1/war-weeker/<D>`, branch
`feat/regression-r1-quick-wins-<D>`):

| Deliverable | Tickets | Owns (predicted files) |
|---|---|---|
| D1 Footer | 01 | `src/app/[edition]/layout.tsx`, `src/app/history/page.tsx`, `src/components/admin-shell.tsx`, `src/components/site-footer.tsx` |
| D2 Standings | 02, 10 | `src/components/standings.tsx`, `src/app/[edition]/(home)/page.tsx`, `src/app/[edition]/leaderboard/page.tsx`, `src/queries/standings.ts` / `points-entries.ts`, new `src/lib/points-breakdown.ts`, `src/components/ui/collapsible.tsx` (shadcn) |
| D3 End War Week | 05 | `src/components/war-week-lifecycle-controls.tsx`, `src/lib/war-week-lifecycle.ts`, `src/mutations/war-week-lifecycle.ts`, `src/actions/war-week-lifecycle.ts` |
| D4 Competition form | 06, 09 | `src/components/competitions-editor.tsx`, `src/lib/setup.ts`, `src/mutations/setup.ts`, `src/actions/setup.ts` |
| D5 Brackets | 07, 16 | `src/components/bracket-view.tsx`, `src/components/heat-result-form.tsx`, new `src/lib/bracket/tree.ts`, new `src/components/bracket-tree.tsx`, `src/app/[edition]/competitions/[id]/page.tsx`, `src/components/ui/dialog.tsx` (shadcn), new `e2e/bracket-tree.spec.ts` |
| D6 Schedule | 08 | `src/app/[edition]/schedule/page.tsx`, new `src/lib/schedule-filter.ts` or `src/lib/schedule.ts`, `src/components/scroll-to-today.tsx` |

Wave 2 (after wave 1 is integrated; direct on the work-package branch or a
single worktree):

| Deliverable | Tickets | Owns |
|---|---|---|
| D7 /about and docs | 03, 04, and the showcase rule for every R1 ticket | `src/app/about/page.tsx`, `src/lib/about.ts`, `src/components/about-finale-demo.tsx`, `scripts/about-media.ts`, `public/about/*`, `docs/maintainers-guide.md`, `src/queries/war-weeks.ts` (read) |

Why this shape: 02 and 10 collide on `standings.tsx`; 06 and 09 on
`competitions-editor.tsx`; 07 and 16 on `bracket-view.tsx` — each pair is one
deliverable. 03 and 04 both edit /about, in order. Every ticket's showcase
update (the team rule: `/about` + `docs/maintainers-guide.md`) is gathered
into D7 so wave-1 workers never touch those shared files; each wave-1 worker
returns a showcase note instead. Possible residual overlap: `package.json` /
`pnpm-lock.yaml` if `shadcn add` in D2 and D5 adds a dependency — resolved at
merge.

Shared mutable state: one local Postgres (`localhost:2345`). Vitest DB tests
roll back their transactions and tolerate parallel worktrees. `pnpm smoke`
and `pnpm e2e` reset every seeded War Week and use port 3200, so in wave 1
**only D5** runs `pnpm e2e` (its own spec). All other smoke/e2e runs happen
serially at integration by the orchestrator.

### Criterion → verification map

Run surface: local (+ CI on the PR). No deployed-target criteria in R1.
Evidence root: `test-results/` (committed). Wave-1 checks run in each
worktree; final evidence is taken on the integrated branch.

| Criterion | Command / action | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|
| 01-a short page footer at bottom (phone + desktop) | Playwright screenshot of an empty FAQ / short page at 375 and 1280 | footer bottom = viewport bottom | `test-results/e2e/r1-footer/` | after D1 integrated | layout changes |
| 01-b long page footer follows content | same spec, long page | footer below content | same | same | same |
| 02-a free-for-all heading "Standings" | vitest component test + e2e/driven check on a free-for-all edition (`/i`) | no "… standings" team heading | vitest output; `test-results/e2e/r1-standings/` | after D2 | standings.tsx, home page |
| 02-b test covers heading | `pnpm test` | test exists and passes | vitest output | after D2 | — |
| 10-a breakdown newest first (Participant + Team) | vitest (pure breakdown) + driven leaderboard on `/xi/leaderboard` | entries: Competition, points, when | vitest; screenshot `test-results/e2e/r1-points-breakdown/` | after D2 | standings/points queries |
| 10-b totals match row | vitest property on breakdown sum | sum == row total | vitest | after D2 | same |
| 03-a/b /about follows current War Week | vitest on resolver + page test | live → next → latest completed | vitest | after D7 | war-weeks query, about |
| 03-c /about updated | diff review | — | review | after D7 | — |
| 04-a hero shows Standings after Points Entry | `pnpm tsx scripts/about-media.ts` stills + /about screenshot | new hero stills | `public/about/*`, `test-results/28-splash/` | after D7 | about page/media |
| 05-a winner read-only | vitest + driven End dialog | no editable winner input | vitest; screenshot `test-results/e2e/r1-end-war-week/` | after D3 | lifecycle files |
| 05-b tie "Tie: A & B" recorded in Archive | vitest on winner + mutation DB test | archive winner = "Tie: A & B" | vitest | after D3 | same |
| 05-c unit tests single + tie | `pnpm test` | pass | vitest | after D3 | — |
| 06-a form explains Max points | component/driven check | help text present | screenshot `test-results/e2e/r1-competition-form/` | after D4 | editor |
| 09-a create form offers Format incl. Bracket | vitest parser + driven create | format select present | vitest; same screenshot dir | after D4 | editor, setup |
| 09-b Bracket-created Competition links to Bracket setup | driven create → link to `/admin/setup/competitions/<id>/bracket` | link present | same | after D4 | same |
| 07-a dialog at desktop, sheet at phone | Playwright at 1280 and 375 | dialog vs sheet role | `test-results/e2e/r1-bracket-result-dialog/` | after D5 | bracket-view, heat-result-form |
| 07-b Bracket Playwright flow passes | `pnpm e2e` (bracket, bracket-heats, bracket-squads) | pass | e2e output | after D5 integrated | any bracket UI |
| 08-a default All | driven `/xi/schedule` | all days shown | `test-results/e2e/r1-schedule-filter/` | after D6 | schedule |
| 08-b day filter in URL | driven `/xi/schedule?day=…` + vitest | one day only, URL has param | same | after D6 | same |
| 16-a view-model unit tests (2/5/8 SE with byes, 2-Round Heats) | `pnpm test src/lib/bracket/tree.test.ts` | pass | vitest | after D5 | tree.ts |
| 16-b screenshots desktop/phone, mid-way + finalized, SE + Heats; no h-scroll at 375 | `pnpm e2e e2e/bracket-tree.spec.ts` | screenshots; scrollWidth ≤ 375 | `test-results/e2e/bracket-tree*/` | after D5 | bracket UI |
| 16-c List toggle shows current list | same spec | list view visible | same | after D5 | same |
| 16-d /about + guide updated | diff review | — | review | after D7 | — |
| Every ticket: `pnpm gate` | `pnpm gate` on integrated branch | pass | `test-results/r1-gate/gate.txt` | after D7 | any change |
| Epic: each ticket closeout + `done` | tracker files | done + closeout | tracker files | closeout | — |
| Epic: CI on PR runs smoke + e2e and passes | `gh pr checks` | pass | PR checks | after PR | any push |

Human gates: none. CI on the PR is an automated post-PR check.

## [PROGRESS]

- 2026-09-28: tracker claimed (`272e9c5`). The proof-artifact root clear
  (removing Epic G's committed evidence) was refused by the local
  permission guard; R1's evidence goes into new, R1-named directories and
  the Epic G files are left for Paul to decide.

- 2026-09-29: wave 1 integrated (cherry-picked in order): D6 `067a729`, D1 `cb181ff`, D2 `34787a2` `748250e`, D3 `ac876eb` + orchestrator fix `4ab12f9` (no Winner when every Team is on 0 points — Teams at 0 all share rank 1), D4 `2c30575` `11410c4`, D5 `45a3441` `46d2115`. D5 ran its Bracket e2e flows (5/5) in its worktree.
- 2026-09-29: E1 (fresh agent, independent evidence) `b059496`: `e2e/regression-r1.spec.ts`, 6/6 pass; screenshots under `test-results/e2e/regression-r1-*/`.
- 2026-09-29: wave 2, D7 `86f4469` `b64f077` `7e97704`: /about follows `getCurrentWarWeek` (now dynamic), Standings-after-a-Points-Entry hero stills, showcase copy and guide for every R1 ticket, media regenerated. D7 installed ffmpeg via Homebrew on this machine to run the media script.
- 2026-09-29: aggregate AI code review started; records `in-progress → ai-review`.

## [AI CODE REVIEW]

Two fresh frontier-grade reviewers (Opus), one per axis, read `git diff 1b448f5..7e97704`; the orchestrator adjudicated each candidate against the cited hunks.

**Axis 1: technical implementation and spec conformity** (13 candidates)

| Id | Severity | Paths | Finding | Disposition |
|---|---|---|---|---|
| F1 | blocking | `src/app/[edition]/layout.tsx` | The ticket 01 flex-column wrapper shrank every edition page's `main` to content width at desktop (leaderboard ≈340px at 1280; confirmed on the committed screenshot) | resolved `83246ca` (block `flex-1` wrapper) + e2e guard: main ≥ 700px at 1280 |
| F2 | non-blocking | `war-week-settings-form.tsx` | Settings Winner still editable after End | approved deviation (Paul, 2026-09-29: keep as a correction path); help text now "Tie: Red & Blue" |
| F3 | non-blocking | `src/lib/war-week-lifecycle.ts` | The 0-points filter blanked a unique rank 1 with a total ≤ 0 | resolved `5dcaaf4`: blank only when every total is 0 |
| F4–F6 | non-blocking | lifecycle tests, `seed/load.test.ts`, `scripts/smoke/lifecycle.ts` | Winner coverage weakened by 05 | resolved: 0-point Teams case kept, reload preserves a computed Winner, smoke asserts it on /history |
| F7 | non-blocking | `src/app/admin/points/page.tsx` | Free-for-all admin list still "Individual leaderboard" | resolved: "Standings" |
| F8 | non-blocking | `e2e/db.ts` | Breakdown SQL lacked the app's id tie-break (flaky order) | resolved `d00bcf7` |
| F9 | non-blocking | `src/lib/setup.ts` | Non-string Format threw instead of a field error | resolved `1498a28` + unit test |
| F10 | non-blocking | `war-week-lifecycle-controls.tsx` | Winner label pointed at a `<p>` | resolved: read-only unnamed Input, "No Winner" |
| F11 | non-blocking | `src/components/standings.tsx` | `aria-label` hid rank and total | resolved: sr-only suffix |
| F12 | non-blocking | `public/about/finale.mp4`, about test | Dead video; per-still assertion dropped | resolved `0b6e502` |
| F13 | non-blocking | End dialog | Winner shown is computed at page render | approved deviation (orchestrator): the recorded Winner is always the server's value at End |

ACs judged met after fixes: every ticket's; the epic's closeout and CI items were pending at review time.

**Axis 2: coding standards** (18 candidates)

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| S1 | non-blocking | `CONTEXT.md` End Winner stale | resolved `7357b39` |
| S2, S3 | non-blocking | Tautological /about install check; lost ABOUT_THEME ↔ seed sync test | resolved: assert on html; `STATIC_PAGE_THEME` + `src/lib/about.test.ts` |
| S4, S17 | non-blocking | Stale comment; weakened reload/smoke Winner tests | resolved (with F4–F6) |
| S5, S9, S10 | non-blocking | Default bracket config in two layers; "each round" casing; Format rule in component | resolved: mutation owns defaulting; "each Round"; `isBracketFormat` in `src/lib/bracket/view.ts` |
| S6 | non-blocking | Unchecked cast in `refusingDuplicate` | approved deviation (local helper; callers typecheck) |
| S7 | non-blocking | `defaultWinner`/`suggestedWinner` names | approved deviation (deferred rename) |
| S8 | non-blocking | Label association, "No Winner" casing | resolved (with F10) |
| S11 | non-blocking | New `ui/dialog` and `ResponsiveSheetDialog` undocumented | resolved: guide + CLAUDE.md wrapper list |
| S12 | non-blocking | Orphaned mp4 | resolved (with F12) |
| S13, S15, S16 | non-blocking | Inline breakdown type; misplaced `YouMark`; comment wrapping | resolved |
| S14 | non-blocking | `openRound`/"out" rule in `bracket-tree.tsx` | approved deviation (display-only, covered by e2e) |
| S18 | non-blocking | `067a729` trailer lacks blank line; mixed ticket-number style | approved deviation (no history rewrite) |

Remaining risks: the tree/List choice isn't remembered across reloads; the result popup switches between Dialog and Sheet if the window crosses `lg` mid-entry.

## [CLOSEOUT]

PR: https://github.com/paul-macfarlane/jg-war-week/pull/91 (`feat/regression-r1-quick-wins` → `staging`). One repository delivery, `war-weeker`; base `staging` at `c85d5e5`, comparison point `1b448f5`.

### Deliverables

| Deliverable | Tickets | Worker model | Commits on the branch |
|---|---|---|---|
| D1 Footer | 01 | Sonnet (worktree) | `cb181ff` |
| D2 Standings | 02, 10 | Sonnet (worktree) | `34787a2` `748250e` |
| D3 End War Week | 05 | Sonnet (worktree) | `ac876eb` + orchestrator fix `4ab12f9` |
| D4 Competition form | 06, 09 | Sonnet (worktree) | `2c30575` `11410c4` |
| D5 Brackets | 07, 16 | Opus (worktree) | `45a3441` `46d2115` |
| D6 Schedule | 08 | Sonnet (worktree) | `067a729` |
| E1 Independent browser evidence | 01, 02, 05, 06, 08, 09, 10 | Sonnet | `b059496` |
| D7 /about and showcase | 03, 04, showcase for all | Sonnet | `86f4469` `b64f077` `7e97704` |
| R1-fix Review findings + Time & place dialog | review | Sonnet | `83246ca`…`42cfa66` |
| Orchestrator | gate test fixes | Opus (orchestrator) | `968c733` |

Isolation: the predicted file collisions (`standings.tsx` 02/10, `competitions-editor.tsx` 06/09, `bracket-view.tsx` 07/16) were real and stayed inside single deliverables; the predicted `package.json` overlap from `shadcn add` never happened (no dependency change). Wave 1 cherry-picked without conflicts.

### Verification (verified run command: `pnpm gate`, local Postgres, at `968c733`, exit 0)

| Criterion | Verdict | Evidence |
|---|---|---|
| 01 footer at bottom (phone, desktop) / follows long pages | PASS | `test-results/e2e/regression-r1-r1-01-*/` (+ main width guard) |
| 02 free-for-all reads "Standings"; test covers it | PASS | e2e r1 02; `src/components/standings.test.tsx` |
| 03 /about follows live → next → latest completed | PASS | `src/app/about/page.test.tsx`; smoke anonymous /about |
| 04 hero shows Standings after a Points Entry | PASS | `public/about/standings-*.png`, `test-results/28-splash/about-desktop.png`; smoke |
| 05 Winner read-only; tie recorded "Tie: A & B"; unit tests | PASS | `test-results/e2e/regression-r1-r1-05-*/`; lifecycle lib and DB tests |
| 06 form explains Max points | PASS | `test-results/e2e/regression-r1-r1-06-09-*/competition-form.png` |
| 07 dialog at desktop, sheet at phone; Bracket flows pass | PASS | `test-results/e2e/bracket-tree-*/result-*.png`; gate e2e |
| 08 All default; day in URL | PASS | `test-results/e2e/regression-r1-r1-08-*/`; `src/lib/schedule.test.ts` |
| 09 Format at create; Bracket links to setup | PASS | `test-results/e2e/regression-r1-r1-06-09-*/`; setup tests |
| 10 breakdown newest first; totals match | PASS | `test-results/e2e/regression-r1-r1-10-*/`; `src/lib/points-breakdown.test.ts` |
| 16 view-model tests; screenshots; no h-scroll at 375; List toggle; /about + guide | PASS | `src/lib/bracket/tree.test.ts`; `test-results/e2e/bracket-tree-*/`; guide and about diff |
| Every ticket: `pnpm gate` / epic: gate passes locally | PASS | `test-results/r1-gate/gate.txt` |
| Epic: each ticket closeout + `done` | PASS | this commit |
| Epic: CI on the PR runs smoke and e2e and passes | pending at closeout | https://github.com/paul-macfarlane/jg-war-week/pull/91 checks |

The first two gate runs failed on e2e only: `finale` and `points-entry` read the new sr-only breakdown text in `innerText`, and then `r1 08` hit Next's hidden streamed copy of the page. Both were fixed in the tests (`968c733`); no app code changed. No deploy in this epic.

### Deviations

- Proof root not cleared: the local permission guard refused removing Epic G's committed evidence; Paul chose to keep it. R1's evidence sits in R1-named directories.
- Settings Winner stays editable (Paul); End never takes an override.
- Ticket 07 extended to the Host's Time & place popup (Paul, 2026-09-29).
- D7 installed `ffmpeg` with Homebrew on this machine to run the media script; the final script no longer needs it.

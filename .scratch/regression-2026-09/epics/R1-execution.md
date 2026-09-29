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

## [CLOSEOUT]

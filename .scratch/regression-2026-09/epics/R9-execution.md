# Execution record — Epic R9: Navigation

Contract: [`R9-navigation.md`](./R9-navigation.md) and its tickets
[`54`](../issues/54-competitions-in-the-main-nav.md),
[`55`](../issues/55-account-menu.md),
[`56`](../issues/56-home-recent-results.md),
[`57`](../issues/57-flat-admin-nav.md),
[`58`](../issues/58-one-admin-list-pattern.md) and
[`59`](../issues/59-settings-autosave.md). No `/atlas-plan` run; this plan
was derived by `/atlas-implement` (work package `regression-r9`) on
2026-10-02 against `staging` at `0e19fa6` (R8 merged). Red-team not
required (epic). Branch `feat/regression-r9-navigation`.

## [EXECUTION PLAN]

2026-10-02.

### Structure

Three waves, following the epic's order (54 → 55, 56 alone, 57 → 58 and
57 → 59). Waves 1 and 2 run in parallel worktrees under
`.claude/worktrees/regression-r9/war-weeker/d<NN>`, each branched from the
feature branch's head at dispatch and merged back in ticket order.

- **Wave 1:** D57 (flat admin nav), D54 (participant nav order), D56 (Home
  Recent results).
- **Wave 2:** D55 (account menu), D58 (one admin list pattern), D59
  (Settings autosave). Branched after wave 1 is integrated.
- **Wave 3:** DX, on the feature branch directly: `docs/regression-checklist.md`
  User Pages and Admin sections, `/about` nav-order cards and stills
  (`scripts/about-media.ts`), `docs/maintainers-guide.md`, and the ticket
  screenshots under `test-results/r9-navigation/`.

Predicted collisions that set the waves:
- 54 → 55: `src/components/primary-nav.tsx`, `src/components/more-menu.tsx`,
  `src/lib/more-links.ts`.
- 57 → 55: `src/components/admin-shell.tsx` (57's nav, 55's header).
- 56 → 55: `src/app/[edition]/(home)/page.tsx` (56 adds Recent results,
  55 removes the Slack button).
- 57 → 58: the admin list pages 57 moves (Schedule, Roster) and
  `src/components/setup-row.tsx`.
- 57 → 59: the Settings page 57 moves.
- Wave-mates share no code file. Prose docs (checklist, maintainers'
  guide, `/about`) all collide, so wave 3 owns them.

Workers run format, typecheck, lint and unit tests only. `pnpm build`,
`smoke`, `e2e` and `scripts/about-media.ts` share the one local Postgres
and port 3200, so they run on the integrated branch after each wave
(orchestrator), as in R8.

### Resolved decisions

1. **URLs.** New admin homes: `/admin/points`, `/admin/competitions`
   (and `/admin/competitions/[id]/bracket`, `/[id]/games`),
   `/admin/schedule`, `/admin/roster`, `/admin/announcements`,
   `/admin/awards`, `/admin/faq`, `/admin/finale`, `/admin/settings`,
   `/admin/organizers`, `/admin/guide`. Old paths redirect permanently in
   `next.config.ts`: `/admin` → `/admin/points` (in the page or config),
   `/admin/setup` → `/admin/settings`, `/admin/setup/war-week` and
   `/admin/setup/next` → `/admin/settings`, `/admin/setup/days` and
   `/admin/setup/schedule/**` → `/admin/schedule`, `/admin/setup/teams` →
   `/admin/roster`, `/admin/setup/competitions/**` →
   `/admin/competitions/**`, `/admin/setup/faq/**` → `/admin/faq`,
   `/admin/standings` → `/admin/finale`. 58 adds the `/new` and `/[id]`
   redirects for Schedule, FAQ and Awards. Every caller and `revalidatePath`
   follows the move.
2. **Labels.** Nav labels exactly as ticket 57 lists (Points, not "Points
   Entries"; Finale page's route becomes `/admin/finale`).
3. **Host trimming** is unchanged in substance: a Host sees Points,
   Competitions, Schedule, Announcements, Finale, Guide; the pages a Host
   can't open still refuse them.
4. **Docs.** 57's worker rewrites the in-app Guide (`/admin/guide`,
   `organizer-guide.tsx`); `docs/maintainers-guide.md`, the regression
   checklist and `/about` are wave 3's.
5. **Account menu** uses shadcn `dropdown-menu`, portaled into the themed
   root like the other popups; initials avatar; no Profile item (ticket 60
   isn't built).
6. **Recent results** for Participation is out of scope until ticket 69;
   the shaping leaves room for it but adds no kind.
7. **Screenshots** for every ticket AC are taken once, in wave 3, against
   the integrated build on the XII demo, into
   `test-results/r9-navigation/<name>-<width>/`.

### Verification map

Run surface: local (production build + local Postgres). No deployed target.
Evidence: `docs/agents/testing.md` (committed under `test-results/`; proof
root cleared at the start of this work package). Every `pnpm gate` row
runs as `set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate`.

| Criterion | Command / action | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|
| 54-AC1 tabs and top nav order, Competitions highlighted | unit test on `destinationsFor`; Playwright screenshots at 390×844 and 1440×900 on `/xii/competitions` and a Competition page | 5 tabs / 6 items in order, Competitions current | vitest; `r9-navigation/nav-*` | wave 1 (unit), wave 3 (shots) | primary-nav, more-links |
| 54-AC2 Announcements in More, More highlighted | unit + e2e/screenshot | More current on `/xii/announcements` at 390 | vitest; e2e; shot | wave 1 | same |
| 54-AC3 e2e updated; gate | `pnpm gate` | exit 0 | `r9-navigation/gate.txt` | wave 1 | any |
| 55-AC1 avatar only; menu items by role | e2e + screenshots of the open menu, participant and admin, both widths, Organizer and Participant | items as listed; no Admin for a Participant | e2e; `account-menu-*` | wave 2 | header, menu |
| 55-AC2 Display from the menu updates themed pages | `e2e/theme.spec.ts` adjusted | passes | e2e | wave 2 | menu, display |
| 55-AC3 keyboard | e2e: Enter opens, arrows move, Escape closes | passes | e2e | wave 2 | menu |
| 55-AC4 gate | `pnpm gate` | exit 0 | gate.txt | wave 2 | any |
| 56-AC1 shaping tests | `pnpm test` on the shaping module | ordering, grouping, limit 5 pass | vitest | wave 1 | shaping |
| 56-AC2 XII demo shows results newest first | e2e or driven run on XII demo with a finalized Bracket and Points Entries; screenshots at both widths | rows newest first | `recent-results-*` | wave 1 (e2e), wave 3 (shots) | home, query, seed |
| 56-AC3 gate | `pnpm gate` | exit 0 | gate.txt | wave 1 | any |
| 57-AC1 admin nav per role and width | unit on `admin-sections.ts`; screenshots Organizer and Host at both widths | lists match the ticket | vitest; `admin-nav-*` | wave 1 / wave 3 | admin nav |
| 57-AC2 `/admin` and old `/admin/setup/*` redirect | smoke checks over HTTP | each redirect to its new home | smoke output | wave 1 | next.config, routes |
| 57-AC3 Schedule one page; Settings has Lifecycle | e2e/smoke + screenshots | Days and Items together; Lifecycle box | `admin-schedule-*`, `admin-settings-*` | wave 1 | pages |
| 57-AC4 gate | `pnpm gate` | exit 0 | gate.txt | wave 1 | any |
| 58-AC1 Edit and Delete per row, every list | screenshots of roster and Schedule at both widths; review of the other lists | visible Edit and Delete | `admin-list-*` | wave 2 / wave 3 | list rows |
| 58-AC2 e2e edit/delete Participant and Schedule Item | new e2e spec | passes | e2e | wave 2 | rows, forms |
| 58-AC3 no `/admin/**/new` or `/[id]` page but Announcements; redirects | `find src/app/admin -path '*new*' -o -path '*\[id\]*'`; smoke redirects | only announcements (plus points/brackets/competitions detail pages that aren't list editors); redirects ok | output; smoke | wave 2 | routes |
| 58-AC4 gate | `pnpm gate` | exit 0 | gate.txt | wave 2 | any |
| 59-AC1 Story Theme autosaves; no Save button | new e2e | persists after reload; no Save | e2e | wave 2 | settings form |
| 59-AC2 invalid Slack URL errors at field, not saved | new e2e | error shown; reload shows old value | e2e | wave 2 | settings form, action |
| 59-AC3 gate | `pnpm gate` | exit 0 | gate.txt | wave 2 | any |
| E-AC1 checklist User Pages and Admin updated | read `docs/regression-checklist.md` | lines match the new nav | file | wave 3 | the doc |
| E-AC2 `/about` and maintainers' guide updated | read; `pnpm tsx scripts/about-media.ts` exit 0 | cards in nav order; stills show new nav | `test-results/about-media/`; diff | wave 3 | about, script |
| E-AC3 tickets closed out, `done` | read ticket files | closeout + `done` | files | closeout | — |
| E-AC4 CI and gate | `pnpm format:check && pnpm gate`; `gh pr checks` | exit 0; green | gate.txt; PR | after wave 3 / PR | any |
| DoD checklist current (team rule) | review | changed pages have lines | diff | wave 3 | — |

Human gates: none. CI on the PR is read after it opens.

## [PROGRESS]

## [AI CODE REVIEW]

## [CLOSEOUT]

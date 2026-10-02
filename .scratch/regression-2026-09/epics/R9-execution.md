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

- Wave 1 integrated at `2c2d110`: D57 (`182a319`, Opus), D54 (`4f53a55`, Sonnet), D56 (`0c12d50`, Sonnet), merged in that order without conflicts.
- Candidate gate at `2c2d110`: format, typecheck, lint, unit (3213), build and smoke (221 ok) pass; e2e 54 passed, 3 failed. All three were test-side:
  - r8 50: two Dates pickers on Settings.
  - r5 35: Mode measured below the fold after the Lifecycle box moved above the form.
  - r9 56: the spec didn't sign in.
- Orchestrator fix `62acabf`; the four affected specs rerun green.
- D56 decision accepted: the pure shaper lives in `src/lib/recent-results.ts`, the loader in `src/queries/`. Entries of one Competition group within 10 minutes of each other.
- D57 decisions accepted:
  - `/admin` redirects in `next.config.ts`.
  - The Days editor sits above the Items on Schedule.
  - Create next War Week is inline on Settings.
- Wave 2 integrated: D55 (`9b6d277`, Sonnet) at `08657d6`, D59 (`ef1b9bd`, Opus) at `54b5368`, and D58 (`690a8dd`, Opus) at `b20beaa`. All merged cleanly.
  - D55 orchestrator fix `a814715`: with the avatar, the admin phone header was 57px against r5 30's 56px limit; the avatar margin is now `-my-2`.
  - D58 orchestrator fix: r5 31 filtered rows by a list-scoped locator, and r5 35 measured the Award field mid-zoom. The full r5 spec reruns green.
  - Candidate gate at `b20beaa`: unit (3243), build and smoke (225 ok) pass; e2e 66 passed, and the 2 r5 failures above are fixed.
- D59 decisions accepted:
  - no toast on autosave;
  - the form's key is `${id}:${status}`;
  - r6 39 now refuses a Points Entry for its toast check.
- Loose end for the review: `StickyFormActions` is now unused.
- D58 decisions accepted:
  - Organizer Edit adds the new email, then removes the old one;
  - Delete lives only on the row;
  - the Add buttons sit below each list.
- Wave 3: DX (Sonnet) committed `a51a10f` (docs, checklist, `/about` card `organizer-admin` with its still on `/admin/schedule`, stills regenerated) and `9a6897e` (ticket screenshots). The orchestrator looked at `account-menu-plain-390` and `admin-nav-organizer-1440`.

## [AI CODE REVIEW]

2026-10-02. Two fresh Opus reviewers, one per axis, read `0e19fa6..d7c4096` (code; docs came after). The orchestrator adjudicated each candidate against the cited hunks and checked F2 in `src/lib/autosave.ts` and `src/mutations/setup.ts` itself.

### Axis 1 — technical implementation and spec conformity

- **F2 (blocking, resolved in `aae6856`, `6360357`).** Each autosave wrote the whole settings row from the form's mount-time snapshot, including the Winner and highlights. So a newer server value was silently reverted: another tab's edit, or the Winner End War Week had just written.
  - Now each save sends only its group's fields.
  - `updateWarWeekSettingsFields` locks the row, merges the fields over it, validates the whole, and writes only the changed columns.
  - The full-save action is retired, and smoke posts the partial one.
  - e2e r9 59-3 proves a later Winner survives.
- **F1 (resolved).** Navigating in-app with a refused field dropped it silently. A capture-phase link guard now opens `ConfirmDialog` (`src/lib/leave-guard.ts`; e2e r9 59-4).
- **F3 (resolved).** `StickyFormActions` and `--admin-sticky-height` were dead code; both are deleted, and r5 33 is reduced to what still exists.
- **F4 (resolved).** The in-app Guide said Display was under More.
- **F5 (resolved).** `CONTEXT.md` had stale routes; a **Recent results** row is added.
- **F6 (resolved).** Stale comments.
- **F7 (resolved).** Recent results merged same-name targets; they are now compared by id.
- **F8 (resolved).** The Home query loaded every Points Entry; it is now bounded.
- **F9 (resolved).** Organizer Edit's partial failure left a stale list.
- **F10 (resolved / deviation).** The Admin item now links `/admin/points`. Deviation approved: the admin menu shows the email's local part until ticket 60.
- **F11 (deviation approved).** 58-AC3 keeps `points/[id]`, `brackets/[id]` and `competitions/[id]/bracket|games`, which aren't list editors.
- Conformant: 54–59 ACs and Decisions as listed in each ticket's closeout; Host trimming and Organizer-only gating unchanged.

### Axis 2 — coding standards

- **S1–S5 (resolved, with F3–F6):** dead sticky code, the Guide line, `CONTEXT.md`, the `DisplayMenu` comments and the `MoreMenu` JSDoc.
- **S6 (resolved).** Unused exports dropped; tests import their constants.
- **S7 (resolved).** The Points title is "Points".
- **S8 (resolved).**
  - shadcn `Badge` for Pinned.
  - A shared `useSignOut()` with a pending guard.
  - The keyboard e2e uses retrying assertions.
- **S8 tail (deviation approved).** The redirect table appears in next.config, the unit test and smoke, as the verification map asks. Per-spec `shoot()` helpers follow the suite's idiom.
- Conformant:
  - shadcn `dropdown-menu`, portaled via `useThemeContainer`;
  - `ConfirmDialog`, `ResponsiveSheetDialog` and sonner throughout;
  - ADR 0001 (pure `src/lib`) and ADR 0003/0004 (authorize, zod, never throw);
  - no banned terms; no `.env` reads.

Review fix commits:
- `aae6856`: DR, Opus.
- `6360357`: DR2, Sonnet. The first final gate's smoke failed because no client referenced the old action, so Next dropped it from the action manifest.
- `f34ce58`: orchestrator, maintainers' guide.

## [CLOSEOUT]

2026-10-02. Repository `war-weeker`, branch `feat/regression-r9-navigation` from `staging` `0e19fa6`. PR: https://github.com/paul-macfarlane/jg-war-week/pull/114.

| Deliverable | Commit | Worker model | Result |
|---|---|---|---|
| D57 Flat admin nav | `182a319` | Opus | accepted (orchestrator e2e fix `62acabf`) |
| D54 Competitions in the main nav | `4f53a55` | Sonnet | accepted |
| D56 Home Recent results | `0c12d50` | Sonnet | accepted (orchestrator e2e fix `62acabf`) |
| D55 Account menu | `9b6d277` | Sonnet | accepted (orchestrator fix `a814715`) |
| D59 Settings autosave | `ef1b9bd` | Opus | accepted |
| D58 One admin list pattern | `690a8dd` | Opus | accepted (orchestrator e2e fix `d7c4096`) |
| DX Checklist, /about, maintainers' guide, screenshots | `a51a10f`, `9a6897e` | Sonnet | accepted |
| DR Aggregate review fixes | `aae6856` | Opus | accepted |
| DR2 Retire the full-save settings action | `6360357` | Sonnet | accepted (DR retry 1: final-gate smoke failure) |
| Guide line on partial saves | `f34ce58` | orchestrator | — |

**Verified run command.** `set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate` exits 0 at `6360357`. Unit: 3261 tests in 141 files. Smoke: 225 `ok`, 0 `FAIL`. e2e: 70 passed. Evidence:
- `test-results/r9-navigation/gate.txt`
- the ticket screenshots under `test-results/r9-navigation/<name>-<width>/` (index in `screenshots.txt`)
- `test-results/e2e/`
- `test-results/about-media/`

No deployed target in scope.

**Verdicts.**
- PASS: 54-AC1–3, 55-AC1–4, 56-AC1–3, 57-AC1–4, 58-AC1–4 (AC3 with the F11 deviation), 59-AC1–3, E-AC1 (checklist), E-AC2 (`/about` and maintainers' guide), E-AC3 (tickets closed out, `done`), DoD checklist current.
- E-AC4: `pnpm format:check && pnpm gate` PASS; CI on the PR is pending at closeout (check with `gh pr checks`).
- The screenshots were taken at `9a6897e`, before the review fixes. Those fixes changed no page the shots show, apart from the Admin item's link target.

**Deviations**
- Review deviations F10 (admin menu name until ticket 60), F11 (58-AC3's non-list pages) and S8-tail.
- D59's `updateWarWeekSettings` was replaced by `updateWarWeekSettingsFields` (partial saves), beyond the ticket's "existing action or a per-field variant", which allowed it.
- `/about`'s `organizer-setup` card became `organizer-admin`.
- Tracker: tickets went `ready-for-agent` → `in-progress` → `done`. `planning` was skipped (no `/atlas-plan`), and `ai-review` wasn't written to the files; the review ran between DX and closeout.
- The regression checklist was updated, not run; running it is on demand per `CLAUDE.md`.

**Isolation re-check.** The predicted collisions all materialised:
- 54 and 55: `primary-nav.tsx`, `more-menu.tsx`, `more-links.ts`, `more/page.tsx`.
- 57 and 55: `admin-shell.tsx`.
- 56 and 55: the Home page.
- 57 and 58: the moved Schedule and FAQ pages, `days-editor.tsx`, `next.config.ts`.
- 57 and 59: `settings/page.tsx`, `src/lib/setup.ts`.

Wave-mates shared only e2e and smoke files: D58/D59 `regression-r5.spec.ts`, D55/D58 `smoke/admin.ts`, D55/D59 `theme.spec.ts`. Git merged these without conflict, so the waves were right.

**Follow-up candidates**
- The admin account menu shows the email's local part (ticket 60 brings Profile names).
- Recent results can get tall when one batch scores many Participants. A cap on names per row, with "+N more", could help.
- The phone tab labels "Competitions" and "Leaderboard" sit close at 390px.
- `pnpm smoke` prints `ELIFECYCLE … 143` from killing its server even when it passes.

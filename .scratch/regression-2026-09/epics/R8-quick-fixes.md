# Epic R8: Quick fixes from the October regression

**What to build:** Small, independent fixes from Paul's 2026-10-01 regression feedback: one word for Announcements, names instead of emails, free-for-all without Team settings, better date pickers, sheets only on phones, no more "Which one is you?", and a regression checklist that covers User Pages and Admin.

**Tickets:** `46`, `47`, `48`, `49`, `50`, `51`, `52`, `53` (files under `../issues/`)

**Branch:** `feat/regression-r8-quick-fixes`

**Blocked by:** none

**Status:** done

**Red-team:** not required (no Drizzle schema, auth or access change).

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

All independent. Run 53 last so its first checklist run sees the other fixes. Can run in parallel with R9, but R9 touches the same nav files as 46: merge R8 first.

## Acceptance criteria

Each ticket's own, plus:

- [x] `/about`, `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where a change is user-visible (team rules).
- [x] Each ticket file records its closeout and is `done` in this branch.
- [x] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-02 [EXECUTION PLAN] (atlas-implement): Wave 1 runs 46–52 in parallel, one worker each, in worktrees under `.claude/worktrees/R8-quick-fixes/war-weeker/d<NN>`. The tickets share no code dependency. The worktrees isolate concurrent edits. Shared files are expected to collide in prose: `docs/maintainers-guide.md`, `docs/regression-checklist.md`, `CONTEXT.md`, `/about` copy, and `src/app/admin/setup/teams/page.tsx` (48 and 52). Workers run format, typecheck, lint and unit tests only. `pnpm build`/`smoke`/`e2e` share local Postgres and port 3200, so they run once on the integrated branch. Integration order is 46→52, merged into `feat/regression-r8-quick-fixes`. Wave 2: one evidence agent captures the ticket screenshots (47, 48, 49, 51, 52) on the integrated build under `test-results/r8-quick-fixes/`. Wave 3: 53 runs the Admin and User Pages checklist in both passes at both viewports. Verification map: each ticket AC maps to its unit test, grep, smoke/e2e (in `pnpm gate` on the integrated commit) or screenshot. The epic's `pnpm format:check && pnpm gate` runs on the final commit, and PR CI runs after push. No human gates.
- 2026-10-02 [AI CODE REVIEW] (atlas-implement): Two independent Opus reviewers read `e18280c..d60af36`; the orchestrator adjudicated.
  - Spec conformity: blocking items were fixed. These were the smoke check still expecting the removed picker (589482c) and the r8-50 e2e reading mixed `data-day` cells (b74876b).
  - Spec conformity, non-blocking fixes (b74876b):
    - The hidden Team fields now post their saved values.
    - The admin edit page shows the author's name.
    - Checklist lines were added for 47 and 52.
    - The e2e helper restores the email it sets.
  - Coding standards, blocking: the `/about` stills showed "News", so they were regenerated (0d05487).
  - Coding standards, non-blocking fixes (b74876b):
    - The Organizer Guide contradiction.
    - ADR 0005 and 0006 dated notes. The worker's edit wiped both ADRs; the orchestrator restored them in 4ad2531.
    - Stale "unlinked You" and pick comments and test names.
    - Dead `rosterParticipants`.
    - `DatePicker` `disabled` renamed to `disabledDates`.
    - A comment on the roster's Teams check.
    - The setup-row colour drift reverted.
    - The smoke `news` variable renamed.
  - Rejected, with reasons:
    - Redundant min/max in the Day picker. AC 49 has the matcher disable dates outside the War Week, and min/max bound navigation.
    - Prose wrap. Prettier is the formatter of record and passes.
    - Done discarding a refused or half range. Ticket 50 specifies it.
  - "Announcements" overflowing the 390 tab bar was checked and does not overflow (`test-results/r8-quick-fixes/nav-390/`); placement belongs to ticket 54.
- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/113 into `staging`. Repository `war-weeker`, branch `feat/regression-r8-quick-fixes`, base `e18280c`.
  - Deliverables and workers:
    - D46, D47, D48, D49, D50, D51, D52: Sonnet, in parallel worktrees, merged in the order 47, 46, 49, 51, 48, 52, 50.
    - RF (review fixes): Sonnet.
    - EV (screenshots and `/about` stills): Sonnet.
    - D53a (free-for-all pass) and D53b (teams pass): Opus.
  - Predicted collisions, rechecked against the real diffs:
    - Shared docs (maintainers guide, regression checklist, CONTEXT.md) auto-merged.
    - The only real conflict was `src/lib/day-range.test.ts` imports, between 49 and 50.
    - The predicted `admin/setup/teams/page.tsx` overlap between 48 and 52 never happened; both edited `teams-editor.tsx`, and it auto-merged.
    - `/about` copy needed no edits; only its stills changed.
  - Epic AC1 PASS: `/about` stills, `docs/maintainers-guide.md` and `docs/regression-checklist.md` were updated for each user-visible change.
  - Epic AC2 PASS: tickets 46–53 carry their closeouts and are `done`.
  - Epic AC3: `pnpm format:check && pnpm gate` PASS at 23c3d15 (`test-results/r8-quick-fixes/gate.txt`: 3170 unit tests, 202 smoke checks, 54 e2e). Verified run command: `DATABASE_URL=<.env.example value> DATABASE_DRIVER=pg pnpm gate`. PR CI is reported on the PR.
  - Deviations:
    - Gate `build`/`smoke`/`e2e` ran on the integrated branch, not per worker (shared Postgres and port 3200).
    - The `test-results/` proof root was cleared at the start, under the evidence policy.
  - Open for Paul: the Finale's 8047 ms against `FINALE_MAX_MS` 8000. The checklist line now reads "within 8 s"; see ticket 53.


# 36: Seed warning only on the Setup page

**What to build:** Remove the "Heads up: reloading this War Week's seed file…" box from the Setup sub-pages. It stays once on `/admin/setup`, and in the Organizer Guide.

**Blocked by:** none (runs after 31 and 34 in Epic R5: they edit some of the same pages and smoke file)

**Status:** done

**Source:** mobile regression pass 2026-09-30 (ticket 18)

## Need

- **Organizer:** `SeedOverwriteWarning` (`src/components/seed-overwrite-warning.tsx`) shows on seven Setup pages: `/admin/setup` and War Week, Days, Teams, Competitions, Schedule and FAQ. It names `pnpm seed:load`, a maintainer command most Organizers never run, and on a phone it pushes each page's content down by several lines. The Organizer Guide already explains it ("The seed warning", `src/components/organizer-guide.tsx:258`).

## Decisions

- Remove, don't collapse: no show-once state to store. Keep the one on `/admin/setup` (`src/app/admin/setup/page.tsx:94`); remove it from `src/app/admin/setup/{war-week,days,teams,competitions,schedule,faq}/page.tsx`.

## Acceptance criteria

- [ ] The warning renders on `/admin/setup` and on none of the six sub-pages.
- [ ] The Organizer Guide's seed-warning section is unchanged.
- [ ] `scripts/smoke/setup.ts:80` checks the warning on `/admin/setup` only, and its absence on `/admin/setup/war-week` and `/admin/setup/days`.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-30: claimed by `/atlas-implement` (work package `regression-r5`), `ready-for-agent` → `in-progress`; branch `feat/regression-r5-admin-on-a-phone` from `staging` `50acefb`. Execution record: `../epics/R5-execution.md`.
- 2026-09-30 [AI CODE REVIEW]: S11 (smoke comments and messages) resolved. Full tables: `../epics/R5-execution.md` [AI CODE REVIEW].
- 2026-09-30 [CLOSEOUT]: D36 `dd9afe9` (Haiku); review fixes `f79549c`. Criteria 36-1 … 36-3 PASS; `pnpm format:check && pnpm gate` exit 0 at `4bee992` (`test-results/r5-gate/gate.txt`); screenshots `test-results/e2e/regression-r5-r5-36-*/`. PR https://github.com/paul-macfarlane/jg-war-week/pull/107. `in-progress` → `ai-review` → `done`. Details: `../epics/R5-execution.md` [CLOSEOUT].

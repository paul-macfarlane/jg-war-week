# 36: Seed warning only on the Setup page

**What to build:** Remove the "Heads up: reloading this War Week's seed file…" box from the Setup sub-pages. It stays once on `/admin/setup`, and in the Organizer Guide.

**Blocked by:** none (runs after 31 and 34 in Epic R5: they edit some of the same pages and smoke file)

**Status:** ready-for-agent

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

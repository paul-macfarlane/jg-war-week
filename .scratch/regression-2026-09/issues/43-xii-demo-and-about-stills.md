# 43: A XII demo, and About's stills taken from the current War Week

**What to build:** A free-for-all `seeds/demo/xii.json` and `pnpm seed:demo:xii`, and make `scripts/about-media.ts` capture the About media (hero Standings stills, Finale poster, one still per feature card) from the *current* War Week instead of hardcoded `/xi`, then regenerate them from the XII demo.

**Blocked by:** 42 (settles the six feature cards and their slugs)

**Status:** ready-for-agent

**Source:** Paul's public-pages review, 2026-10-01, item 3; regression checklist "About page has the theme of the latest war week, including the screenshots/video"

## Need

- **Participant / Organizer:** About's stills show XI's Matrix theme while the app wears XII's; the page looks stale. XII is upcoming with no data to capture, so the stills need a demo XII.
- **Maintainer, next year:** refreshing the stills should be "write the next demo seed, rerun the script", not editing `/xi` paths.

## Decisions

- **`seeds/demo/xii.json`**: `status: live`, `mode: free-for-all`, XII's Story Theme, colors and font from `seeds/xii.json` (no logo or banner until XII has them). About 12 Participants with **clearly fictional names** (no real colleague names next to invented results); a few Days with placeholder Day Themes and schedule; about 4 Competitions: one Bracket, one Games, two points-only; one pinned Announcement; enough Points Entries for the Standings and the Finale to look real.
- **`pnpm seed:demo:xii`** loads the history seeds plus the XII demo with `--reset` (XI stays `complete` from `seeds/xi.json`, so XII is the one live War Week).
- **The XI demo stays the e2e and smoke fixture.** Smoke and e2e never load the XII demo (it would be a second live War Week); `src/seed/seeds.test.ts` validates it.
- **`about-media.ts`** resolves the current War Week (`getCurrentWarWeek` or equivalent) and uses its edition everywhere it now says `/xi`; it captures one still per `ABOUT_FEATURES` card plus the hero and Finale poster; its header comment and `docs/maintainers-guide.md` name `pnpm seed:demo:xii` as the prerequisite. It still signs in as the made-up `about-demo@jahnelgroup.com` and restores what it changes.
- Free-for-all stills: Standings by Participant, Brackets with Participant Entrants.

## Acceptance criteria

- [ ] `seeds/demo/xii.json` validates, is free-for-all, uses only fictional names, and passes the Archive contrast checks in both color schemes.
- [ ] After `pnpm build && pnpm seed:demo:xii`, `pnpm tsx scripts/about-media.ts` writes every still in XII's theme with no `/xi` path left in the script; `public/about/` holds exactly the hero, Finale poster and six card stills.
- [ ] `/about` screenshots at 390×844 and 1440×900 under `test-results/r7-public-pages/about-stills-*/` show XII's colors in every still.
- [ ] `pnpm smoke` and `pnpm e2e` still run on the XI demo and pass.
- [ ] `pnpm gate` passes.

## Comments

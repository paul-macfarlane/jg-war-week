# 29: Tentative War Week XII in the seeds

**What to build:** A `seeds/xii.json` for War Week XII from what's known so far (the teaser poster): upcoming, free-for-all, Story Theme "No Teams. Just You."

**Blocked by:** none

**Status:** done

**Source:** Paul, 2026-09-30, from the War Week XII teaser poster ("No teams. Just you. War Week XII.", black on white, JG logo)

## Need

- **Organizer:** XII's known shape (no Teams, individual play) is set up ahead of time so Setup starts from it rather than from a copy of XI's Teams mode, and the Seed workflow can bootstrap it on staging/production.

## Decisions (tentative; Organizers can change any of these in Setup)

- `status: upcoming`, `mode: free-for-all` ("No teams. Just you."), no Teams, Days or Competitions yet.
- Story Theme: `No Teams. Just You.` until the real theme is announced.
- Dates `2027-02-21` → `2027-02-26` (Sunday to Friday, matching XI's late-February shape); a placeholder.
- Appearance Theme after the poster: white background, near-black text, JG logo magenta `#c2185b` primary and blue `#2f4fd8` accent, `sans` font. No logo or banner yet.
- Slack URL follows the past pattern (`archives/war-week-xii`); no wiki URL until the page exists.
- Loading it on a deployed database makes XII the current War Week there (current = live, else next upcoming, else latest complete), so `/` shows XII's upcoming page while XI stays in the Archive. Local test databases are unaffected: the XI demo is `live`.

## Acceptance criteria

- [x] `seeds/xii.json` validates and passes the Archive contrast checks in both color schemes.
- [x] `src/seed/seeds.test.ts` keeps its history checks on the complete seeds and asserts XII is the only non-history seed, upcoming.
- [x] `pnpm gate` passes.
- [ ] **Human, after merge:** run the Seed workflow with `xii.json` (no `confirm_reset`) on staging, then production; `/` opens XII.

## Comments

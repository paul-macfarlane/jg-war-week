# 54: Competitions in the main nav

**What to build:** Reorder the participant nav (`destinationsFor` in `src/components/primary-nav.tsx`, `src/lib/more-links.ts`):

- **Phone tab bar:** Home, Schedule, Competitions, Leaderboard, More. Announcements moves into More (first item); Home's pinned Announcement card stays.
- **Desktop top nav:** Home, Schedule, Competitions, Leaderboard, Announcements, More.
- More keeps Teams/roster, Awards, FAQ, War Week history, Install app, About; Competitions leaves it.

**Blocked by:** 46

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P1, P6; grilling Q1

## Need

- **Participant / Host:** Competitions is where people go to record and see results; it's buried under More.

## Acceptance criteria

- [ ] At 390×844 the tab bar shows the five tabs in order and Competitions is highlighted on `/xii/competitions` and on a Competition page; at 1440×900 the top nav shows the six items. Screenshots.
- [ ] Announcements is reachable from More on a phone and highlights More on its page.
- [ ] e2e flows that went through More → Competitions updated; `pnpm gate` passes.

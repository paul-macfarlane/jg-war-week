# 53: Regression checklist covers User Pages and Admin

**What to build:** Add **User Pages** and **Admin** sections to `docs/regression-checklist.md`, written so an agent can run them line by line at 1440×900 and 390×844, derived from the app's expected functionality (CONTEXT.md, the maintainer's guide, the e2e flows). Each section also checks "no display that isn't needed, no information overload".

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, regression checklist

## Decisions

- User Pages: every War Week page (Home, Schedule, Competitions, a Competition of each Format, Leaderboard, Announcements, Teams/roster, Awards, FAQ, History, Finale) as a linked Participant and as an unlinked signed-in user: themed, no horizontal scroll or clipping, You highlighted where it should be, each page's primary job reachable in one tap.
- Admin: every admin page as an Organizer and as a Host: the Host sees only their Competitions; create, edit and delete work on each list; nothing duplicated or unexplained on screen.
- Lines name the seed (`pnpm seed:demo:<edition>`) and accounts (e2e stub sessions, or Test sign-in once ticket 62 ships).
- Later epics (R9–R13) update these sections when they change a page; say so in the checklist's intro.

## Acceptance criteria

- [ ] Both sections exist; each line says how to check it.
- [ ] One run of the new sections against the XII demo is recorded in the closeout with a screenshot per page per viewport under `test-results/r8-quick-fixes/checklist/`; failures become tickets.
- [ ] `pnpm format:check` passes.

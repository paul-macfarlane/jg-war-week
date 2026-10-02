# 54: Competitions in the main nav

**What to build:** Reorder the participant nav (`destinationsFor` in `src/components/primary-nav.tsx`, `src/lib/more-links.ts`):

- **Phone tab bar:** Home, Schedule, Competitions, Leaderboard, More. Announcements moves into More (first item); Home's pinned Announcement card stays.
- **Desktop top nav:** Home, Schedule, Competitions, Leaderboard, Announcements, More.
- More keeps Teams/roster, Awards, FAQ, War Week history, Install app, About; Competitions leaves it.

**Blocked by:** 46

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P1, P6; grilling Q1

## Need

- **Participant / Host:** Competitions is where people go to record and see results; it's buried under More.

## Acceptance criteria

- [ ] At 390×844 the tab bar shows the five tabs in order and Competitions is highlighted on `/xii/competitions` and on a Competition page; at 1440×900 the top nav shows the six items. Screenshots.
- [ ] Announcements is reachable from More on a phone and highlights More on its page.
- [ ] e2e flows that went through More → Competitions updated; `pnpm gate` passes.

## Comments

- 2026-10-02 [AI CODE REVIEW] (atlas-implement): Two fresh Opus reviewers read `0e19fa6..d7c4096`, one per axis. The orchestrator adjudicated each finding against the cited hunks; the full record is in `../epics/R9-execution.md` [AI CODE REVIEW]. One blocking finding: F2, settings autosave wrote the whole row and could revert a newer Winner. It was fixed in `aae6856`/`6360357` with partial saves merged over the locked row. Every non-blocking finding was fixed or approved as a deviation.
- 2026-10-02 [CLOSEOUT] (atlas-implement): Branch `feat/regression-r9-navigation`; worker D54 (Sonnet), commit `4f53a55`.
  - AC1 PASS: `src/lib/primary-nav.ts` (unit-tested) gives phone Home, Schedule, Competitions, Leaderboard, More and desktop + Announcements. `e2e/regression-r9-nav.spec.ts` asserts order and Competitions current on `/xii/competitions` and a Competition page at 390×844 and 1440×900. Screenshots: `test-results/r9-navigation/nav-competitions-*`, `nav-competition-page-*`.
  - AC2 PASS: Announcements is the first More item on a phone and More is current on its page (e2e; `nav-announcements-390`, `nav-more-sheet-390`).
  - AC3 PASS: no spec went through More → Competitions. `pnpm format:check && pnpm gate` passes at `6360357` (`test-results/r9-navigation/gate.txt`).

# 57: A flat admin nav

**What to build:** Replace the Overview page and the Setup hub with one flat admin nav (`src/lib/admin-sections.ts`, `admin-shell.tsx`, the admin bottom bar):

**Points · Competitions · Schedule · Roster · Announcements · Awards · FAQ · Finale · Settings · Organizers · Guide**

- **Schedule** is one page: the War Week's Days (with Day Themes) and each Day's Schedule Items together.
- **Roster** is Teams & Participants.
- **Settings** is today's War Week settings plus the Lifecycle box and Create next War Week.
- `/admin` redirects to `/admin/points`. Old `/admin/setup/*` URLs redirect to their new homes.
- Phone bottom bar: Points, Competitions, Schedule, Announcements, More.
- Hosts see Points, Competitions, Schedule, Announcements, Finale, Guide (as today's trimming).

**Blocked by:** none (merge R8 first; both touch nav files)

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A3, A14, A15; grilling Q9

## Decisions

- The seed warning that showed on the Setup index (ticket 36) moves to Settings.
- The Guide (`/admin/guide`) and `docs/maintainers-guide.md` are rewritten for the new nav.

## Acceptance criteria

- [ ] Admin nav at 1440×900 and 390×844 for an Organizer and a Host matches the lists above; screenshots.
- [ ] `/admin` → `/admin/points`; each old `/admin/setup/...` path redirects (smoke).
- [ ] Schedule shows Days and their Items on one page; Settings shows the Lifecycle box.
- [ ] `pnpm gate` passes.

## Comments

- 2026-10-02 [AI CODE REVIEW] (atlas-implement): Two fresh Opus reviewers read `0e19fa6..d7c4096`, one per axis. The orchestrator adjudicated each finding against the cited hunks; the full record is in `../epics/R9-execution.md` [AI CODE REVIEW]. One blocking finding: F2, settings autosave wrote the whole row and could revert a newer Winner. It was fixed in `aae6856`/`6360357` with partial saves merged over the locked row. Every non-blocking finding was fixed or approved as a deviation.
- 2026-10-02 [CLOSEOUT] (atlas-implement): Branch `feat/regression-r9-navigation`; worker D57 (Opus), commit `182a319`; orchestrator e2e fix `62acabf`.
  - AC1 PASS: `src/lib/admin-sections.ts` (unit-tested) has the 11 sections in order; a Host sees Points, Competitions, Schedule, Announcements, Finale, Guide; the phone bar is Points, Competitions, Schedule, Announcements, More. Screenshots `admin-nav-organizer-*`, `admin-nav-host-*`, `admin-more-*-390`; smoke checks the Host's nav.
  - AC2 PASS: permanent redirects in `next.config.ts` (`src/lib/admin-redirects.test.ts`); smoke checks each 308 including `/admin` → `/admin/points`.
  - AC3 PASS: `/admin/schedule` has Days (Organizers) above Items grouped by Day; `/admin/settings` has the Lifecycle box, the seed warning and Create next War Week (smoke markers; `admin-schedule-*`, `admin-settings-*`).
  - AC4 PASS: gate at `6360357`.
  - The in-app Guide was rewritten; the maintainers' guide by DX (`a51a10f`).

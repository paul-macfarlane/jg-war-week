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

**Status:** in-progress

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

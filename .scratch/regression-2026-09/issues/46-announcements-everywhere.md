# 46: Say "Announcements", never "News"

**What to build:** Rename every participant-facing "News" to **Announcements**: the nav label, the page heading, Home's "All news" link, and the route (`/[edition]/news` → `/[edition]/announcements`, with a permanent redirect from the old path). Add "News" to CONTEXT.md's banned terms for this concept.

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P1; `grilling-2026-10-01.md`

## Need

- **Participant:** the nav says "News" but the page and admin call the same thing Announcements; one word for one thing.

## Decisions

- Where Announcements sits in the nav is ticket 54's; this ticket only renames.
- Update `primary-nav.tsx`, `more-links.ts`, the page, Home, `docs/maintainers-guide.md`, `/about` copy ("Announcements (News)" → "Announcements") and any MCP or `llms.txt` copy.

## Acceptance criteria

- [x] No user-visible "News" remains in `src/` (grep for `>News<`, `"News"`, `All news`); the page heading is "Announcements".
- [x] `/xii/news` redirects (308) to `/xii/announcements`; covered by smoke.
- [x] CONTEXT.md bans "News" for Announcements.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/113.

  Branch `feat/regression-r8-quick-fixes`, worker D46 (Sonnet), commit 6f80ff7.
  - AC1 PASS: `grep -rnE '>News<|"News"|All news' src` finds nothing; the page heading is "Announcements" and Home links "All announcements". The nav label is renamed but not moved (ticket 54 owns placement).
  - AC2 PASS: `next.config.ts` redirects `/:edition/news` to `/:edition/announcements` (`permanent: true`, 308). Smoke `ok - GET /xi/news permanently redirects (308) to /xi/announcements` in test-results/r8-quick-fixes/gate.txt.
  - AC3 PASS: CONTEXT.md Banned terms: `News` → Announcement.
  - AC4 PASS: `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).
  - `/about` had no "News" copy. Its stills showed the old nav, so they were regenerated with `scripts/about-media.ts --stills` (commit 0d05487). `llms.txt`, smoke and the r5 e2e paths are updated.

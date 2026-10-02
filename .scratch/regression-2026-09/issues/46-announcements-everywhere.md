# 46: Say "Announcements", never "News"

**What to build:** Rename every participant-facing "News" to **Announcements**: the nav label, the page heading, Home's "All news" link, and the route (`/[edition]/news` → `/[edition]/announcements`, with a permanent redirect from the old path). Add "News" to CONTEXT.md's banned terms for this concept.

**Blocked by:** none

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P1; `grilling-2026-10-01.md`

## Need

- **Participant:** the nav says "News" but the page and admin call the same thing Announcements; one word for one thing.

## Decisions

- Where Announcements sits in the nav is ticket 54's; this ticket only renames.
- Update `primary-nav.tsx`, `more-links.ts`, the page, Home, `docs/maintainers-guide.md`, `/about` copy ("Announcements (News)" → "Announcements") and any MCP or `llms.txt` copy.

## Acceptance criteria

- [ ] No user-visible "News" remains in `src/` (grep for `>News<`, `"News"`, `All news`); the page heading is "Announcements".
- [ ] `/xii/news` redirects (308) to `/xii/announcements`; covered by smoke.
- [ ] CONTEXT.md bans "News" for Announcements.
- [ ] `pnpm gate` passes.

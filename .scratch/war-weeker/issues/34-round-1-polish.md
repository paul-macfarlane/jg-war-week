# 34: Post-hackathon polish from regression round 1

**What to build:** The `post-hackathon` findings from ticket 29 round 1, bundled. Each is small; none blocks the demo. Split into separate tickets if someone picks one up alone.

**Blocked by:** none

**Status:** wontfix (superseded by `.scratch/hardening/issues/08`, `09`, `14`)

## Findings

- `/history`, `/x`, `/i` — axe color-contrast (serious): `text-foreground/60` labels on light edition cards (16 nodes on `/history`), the Survivor `.tracking-wide` label, War Week I's orange `text-primary` links. Expected ≥ 4.5:1. Consider `text-muted-foreground` once ticket 32 themes it.
- `/about` — the top bar shows "Sign in" to a signed-in user. Expected: hide it or show "Open War Week XI".
- `/xi/teams` — the team card shows a bare "50" (member count) with no label; while standings are hidden it reads like points. Expected: "50 members" or a `title`.
- `/admin/announcements` — the "Videos" column counts only the Video links list, so a post whose body embeds a video shows 0. Expected: count body embeds too, or rename the column "Video links".
- Points Entry delete confirm — "Delete 1 pts to Abby Rivera…". Expected: "1 pt".
- `/admin/setup/war-week` and `/admin/setup/days` — no visible confirmation after Save (Points Entry shows "Saved."). Expected: the same status line.
- README deploy section — names only production. The staging URL that accepts sign-in is `https://staging-war-weeker.vercel.app` (its Preview `BETTER_AUTH_URL`); the `war-weeker-git-staging-pauls-team.vercel.app` alias and per-deployment URLs answer 403 `INVALID_ORIGIN`. Expected: README names the staging URL; optionally `trustedOrigins` in `src/auth/server.ts` includes `VERCEL_BRANCH_URL` and `VERCEL_URL` so every alias signs in.
- ~~`/about` hero video — paused on load in the desktop app's browser pane.~~ Closed: it plays on production (production smoke, 2026-09-24).
- Native scrollbars render light grey/white on dark editions (admin tab bar, table scrollers). Expected: set `color-scheme: dark` on dark Appearance Themes.
- Rich-text editor toolbar (Announcements, FAQ) shows no active state: after Cmd+B the "B" button looks the same. Expected: highlight active marks.
- `/xi`, `/xi/news` — Announcements show the author's full email ("pmacfarlane@jahnelgroup.com"). Expected: the author's display name, or the handle before the `@` as MCP already does.

## Comments

**2026-09-24, Claude (implement, ticket 29):** Filed from the round 1 findings record in ticket 29. Evidence and per-page scan: `test-results/29-regression-round-1/round-1-notes.md`.

**2026-09-24, Claude (production smoke):** Walked every public and admin page on https://war-weeker.vercel.app signed in as an Organizer. Checked end to end: add, edit and delete a Points Entry (standings updated, over-max warning, placement presets, required-field validation); post and delete an Announcement (bold renders on `/xi/news`); Reveal then Hide (an open, visible leaderboard tab showed the Standings within ~10s). All test data removed; Standings are hidden again. No console errors. The fix-before-submission finding went to ticket 35; the post-hackathon ones are the last three bullets above. Production `/api/mcp` answers 401 without auth, so `MCP_PUBLIC=true` still has to be set before judging (ticket 28, step 5).

**2026-09-24, Claude (production regression round 2):** Re-walked https://war-weeker.vercel.app after PR #49 deployed, signed in as an Organizer. Iframe overflow sweep at 375, 768, 812, 1024 and 1280px across 78 routes: every public page (`/xi/*`, all ten past editions, `/history`, `/about`, `/install`) and every admin page, including the new/edit pages. Ticket 35's pages (`/admin/points`, `/admin/announcements`, `/admin/awards/new`) now measure 0px at every width. The only overflow left is the Schedule Item form at 375px, filed as ticket 36 (fix-before-submission). End to end: add, edit and delete a Points Entry (Blue 20 → 22 → 23.5 → 20, "edited" marker); post and delete an Announcement (bold renders on `/xi/news`); give and delete an Award (shows on `/xi/awards`, then gone); Reveal then Hide (a visible leaderboard tab showed the Standings within ~13s and went back to hidden after Hide). All test data removed; Standings are hidden again. No console errors on any page; the only warnings are the `/about` poster preload and the video iframe's `allowfullscreen`. `MCP_PUBLIC` is on: an unauthenticated `tools/list` returns the tools, and `get_leaderboard` answers "hidden" while Standings are hidden. No new post-hackathon findings.

- 2026-09-26: Superseded. Preview-alias sign-in → `.scratch/hardening/issues/08`; contrast and the Videos column → `09`; the rest → `14`.

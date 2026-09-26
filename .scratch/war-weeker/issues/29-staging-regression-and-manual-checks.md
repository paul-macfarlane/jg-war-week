# 29: Staging regression pass and Paul's manual checks

**What to build:** No code. First, Paul's manual steps that make staging and production demo-ready. Then a regression walk of staging in the desktop app's browser pane, which produces findings tickets. Modeled on journeys ticket 56. Run it twice to match Paul's checklist (round 1, apply feedback, round 2, apply feedback).

**Blocked by:** none for the manual steps. The regression rounds run after the hackathon batch (16, 20–28) has merged to `staging`. Round 1 can start at 17:00 on 2026-09-24 on whatever has merged.

**Status:** done

## Manual steps (Paul)

- [ ] **Reset the seed on staging and production.** Run the Seed workflow with reset (`confirm_reset` = the environment name) once all seed-changing tickets (04 leftovers, 20's demo email, 22's Placement Points) have merged. The old keyed Awards (`mvp`, `spirit`) survive a plain reload. Warning: after ticket 25 lands, a reseed wipes any UI setup edits.
- [ ] **Check the guessed links.** Open a few past editions on staging and click the wiki link (`https://sites.google.com/jahnelgroup.com/jahnel-group-wiki/war-week-<year>` is an unverified pattern). Past years' Slack links go to the workspace root, so decide whether that's acceptable. Record broken years in Comments. The fix is a seed edit plus a reseed.
- [x] **Set `MCP_TOKEN`** (ticket 21) in Vercel for staging and production and redeploy.
- [ ] Sign in inside the browser pane when the regression thread asks. The agent never enters credentials.

## Regression walk (agent, in the browser pane)

1. Signed in as Paul, both color schemes if the theme supports them, desktop and 375px: `/`, `/xi` home, Schedule, Leaderboard (team and individual), Competitions and one detail, Teams, News, Awards, FAQ, More, `/history` and two past editions, `/install`, `/llms.txt`, the splash/About (28).
2. Organizer flow: enter a Points Entry with a placement preset, edit it, delete it; hide standings, confirm hidden everywhere including MCP, run the Reveal, unhide; post an Announcement with an embedded video, pin it, delete it; create and delete an Award; one save on each setup screen, reverted afterwards; the "You" highlight and picker.
3. MCP: connect Claude Code with the token and call each tool once.
4. Every page: console errors, an axe scan (`axe-core` from a CDN via `javascript_tool`), text overflow at 375px.

**Deliverables:** a `[FINDINGS round N]` record in Comments, with each finding written as `severity — page — what happened — what was expected` and a screenshot under `test-results/29-regression-round-N/`. `blocks-promotion` covers anything a judge hits in the first two minutes, or data loss. `fix-tonight` covers visible copy and layout faults. `post-hackathon` covers the rest. Each finding in the top two severities becomes its own ticket numbered from 31. The thread fixes nothing itself. Everything created during the walk is deleted afterwards.

## Acceptance criteria

- [ ] The manual steps above are checked off by Paul.
- [ ] Round 1 findings are recorded and their tickets filed. Round 2 is the same, after round 1 fixes merge.
- [ ] Paul promotes `staging` → `main` and smokes production before 10:00 ET on 2026-09-25.

## Comments

**2026-09-24 15:55 ET, Claude (implement) — [PROGRESS]:** Claimed the regression walk. Branch `docs/29-regression-round-1` off `staging` 14693a7. Every hackathon ticket (16, 20–28) is `done` and merged to `staging`, and `main` already carries the same commits (PR #44), so round 1 starts early. Staging preview: `https://war-weeker-git-staging-pauls-team.vercel.app` (Vercel deployment 6646615147, commit 14693a7), behind Vercel team login; Paul signs in inside the browser pane, the agent never enters credentials. Findings tickets will be numbered from **32**, since 30 (code cleanup) and 31 (maintainers guide) already exist. Manual steps stay with Paul; the `MCP_TOKEN` step gates walk step 3.

**2026-09-24 17:00 ET, Claude (implement) — [FINDINGS round 1]:** Staging is `https://staging-war-weeker.vercel.app` (the `war-weeker-git-staging-pauls-team.vercel.app` alias and the per-deployment URL both answer 403 `INVALID_ORIGIN` on sign-in, because Preview `BETTER_AUTH_URL` is the `staging-war-weeker` domain). Walked every participant page at 812px and 375px, the organizer flow end to end, and all 8 MCP tools through the browser session. Full per-page scan, flow log and dialog copy: `test-results/29-regression-round-1/round-1-notes.md`. Screenshots (reproduced locally by `scripts/regression-29-evidence.ts`, since the browser pane cannot write files) are in the same directory. Nothing was fixed; everything created was deleted and every setup edit reverted; standings are hidden again.

No `blocks-promotion` findings. No app console errors, no axe violations on the XI pages, no text clipping at 375px, every CRUD flow and the Reveal worked.

- fix-tonight — every themed page (toolbar buttons, "Sign out", ghost/outline hovers) — hovering a ghost or outline button turns it near-white with pale text, so the label vanishes (seen on the rich-text "Video" button while its popover was open) — expected: readable hover state. Cause: `src/lib/theme.ts` sets primary/accent/background/foreground/card/border/ring but leaves `--muted`, `--muted-foreground`, `--popover`, `--secondary` and `--input` at the light defaults (`oklch(0.97 0 0)`), and the ghost variant hovers with `bg-muted`. Screenshot: `03-toolbar-active-button-contrast.png` (unhovered state for reference; the pane showed the white pill). → ticket 32.
- fix-tonight — `/admin/setup/teams` — at an 812px viewport the page scrolls 400px sideways; Save, Delete, Team and Captain sit past the right edge of every roster row — expected: rows wrap or the grid collapses below ~1000px. 0px at 1280. Screenshot: `02-setup-teams-overflow-812.png`. → ticket 33.
- fix-tonight — every `/xi/*` page — at ~812px the desktop top nav overflows 20px ("Sign out" clipped) and the page scrolls sideways; `/history`, `/x`, `/i` do not — expected: the nav fits or the mobile bar takes over before it overflows. Screenshot: `01-nav-overflow-812-schedule.png`. → ticket 33.
- post-hackathon — `/history`, `/x`, `/i` — axe color-contrast (serious): `text-foreground/60` labels on light edition cards (16 nodes), Survivor `.tracking-wide` label, War Week I orange links — expected ≥ 4.5:1. → ticket 34.
- post-hackathon — `/about` — top bar says "Sign in" while signed in — expected: hide it or show "Open War Week XI". → ticket 34.
- post-hackathon — `/xi/teams` — team card shows a bare "50" (member count) with no label; while standings are hidden it reads like points — expected: "50 members" or a title. → ticket 34.
- post-hackathon — `/admin/announcements` — "Videos" column counts only the Video links list, so a post with a video embedded in the body shows 0 — expected: count embeds too or rename the column. → ticket 34.
- post-hackathon — Points Entry delete confirm — "Delete 1 pts to Abby Rivera…" — expected "1 pt". → ticket 34.
- post-hackathon — `/admin/setup/war-week`, `/admin/setup/days` — no visible confirmation after Save (Points Entry shows "Saved.") — expected: consistent feedback. → ticket 34.
- post-hackathon — README deploy section — names only production; the staging URL that accepts sign-in is `staging-war-weeker.vercel.app`, and the other Preview aliases 403 — expected: README names it, or `trustedOrigins` includes `VERCEL_BRANCH_URL`. → ticket 34.
- unverifiable in the pane — `/about` hero video is paused on load (autoplay+muted+loop set, `readyState` 4, plays on `.play()`); check autoplay in a normal browser during Paul's production smoke.

Not exercised: the "Which one is you?" picker (Paul's email matches the roster, so the highlight path was taken instead), the Claude Code bearer-token MCP connection (`MCP_TOKEN` is Paul's Vercel step), the guessed wiki links (they redirect to a Google login; Paul checks them signed in).

Round 2 runs after the round 1 fixes (32, 33) merge to `staging`.

**2026-09-24 17:10 ET, Claude (implement):** Round 1 PR: https://github.com/paul-macfarlane/war-weeker/pull/46 (base `staging`). Ticket stays `in-progress` until round 2 and Paul's manual steps.

- 2026-09-26: Closed. Both regression rounds ran (round 2 is recorded in ticket 34's comments). Paul's remaining manual steps, including the seed reset and the staging → main promotion, moved to `.scratch/hardening/issues/01`.

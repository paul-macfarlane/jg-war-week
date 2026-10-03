# 80: Home's banner placeholder repeats the War Week's name

**What to build:** When a War Week has no Banner URL, `WarWeekHero` (`src/components/war-week-hero.tsx`) draws a 192 px accent block reading "War Week XII", directly above an eyebrow "WAR WEEK" and the heading "War Week XII 2027", under a header that already says "War Week XII". Drop the placeholder (or make it carry something the hero doesn't), so the name is said once.

**Blocked by:** none

**Status:** ai-review

**Source:** regression checklist run, ticket 53 (free-for-all pass, `pnpm seed:demo:xii`, 2026-10-02)

## Need

- **Participant:** open Home on a phone and see what's on now and next, and the Log a Game shortcut, without scrolling.

## Finding

- **Checklist line:** User Pages → "No page carries more than it needs." *(judgment)*
- **Viewports:** 390×844 first (also visible at 1440×900).
- **Roles:** linked Participant (`e2e-participant@jahnelgroup.com`, Cass Comet) and the unlinked account.
- **Screenshots:** `test-results/r8-quick-fixes/checklist/xii-ffa-390/home-at.png`, `.../xii-ffa-1440/home-at.png`, `.../xii-ffa-unlinked-390/home-at.png`.
- **Sections and the need each serves:** banner placeholder (none: repeats the heading), hero (Participant: which War Week, its Story Theme and dates), Slack button (Participant: join the channel), Today / On now / Up next (Participant: where to be), Log a Game (linked Participant: log from a phone), Pinned (Participant: the Organizers' headline), Standings (Participant: where they stand).
- **Expected:** each section serves one need and none repeats another; on a phone, Up next and the Log a Game shortcut are on the first screen.
- **Observed:** the War Week's name appears four times above the fold at 390 (header, placeholder block, eyebrow, heading); the placeholder alone takes 192 px, and the Log a Game list starts below the first screen.

## Acceptance criteria

- [ ] With no Banner URL, Home names the War Week once in its hero; at 390×844 the Log a Game heading is on the first screen for the linked Participant with the XII demo.

## Comments

- **2026-10-02, triage (Paul):** Decided: drop the placeholder; with no Banner URL there is no banner block. Batched into epic R14 (`../epics/R14-quick-wins.md`).
- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r14`): claimed; `ready-for-agent` → `in-progress`. Execution record: `../epics/R14-execution.md`.

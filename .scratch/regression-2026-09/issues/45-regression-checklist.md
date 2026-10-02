# 45: A regression checklist agents can run

**What to build:** `docs/regression-checklist.md`, linked from `CLAUDE.md`, starting with a Public Pages section an agent can run line by line, each with how to check it.

**Blocked by:** none

**Status:** done

**Source:** Paul, 2026-10-01 (draft checklist alongside the public-pages review)

## Need

- **Maintainer, each year before War Week:** a repeatable pass that catches stale themes, stale copy and phone overflow without re-discovering what to look at.

## Decisions

- Viewports pinned: laptop **1440×900**, iPhone **390×844**; every line runs at both.
- Each line says how to verify it (e.g. "no horizontal scroll" = `document.documentElement.scrollWidth <= clientWidth` on each public page; theme lines compare against the current War Week's colors and font).
- Starting section, from Paul's draft:
  - Sign in reflects the latest War Week's theme.
  - About has the theme of the latest War Week, including the stills and the Finale poster (refresh: `pnpm seed:demo:<edition>` then `scripts/about-media.ts`).
  - About is up to date with features, with no redundancy or salesy copy.
  - Privacy and Terms are up to date with features, avoid redundancy, and refer to the Jahnel Group admins.
  - Footer shows the current year.
  - All content on every public page (`/sign-in`, `/about`, `/privacy`, `/terms`) is readable and not cut off on a phone; no horizontal scrolling.
- Later sections (Admin, Competitions, …) are added as they come; the doc says so.
- `CLAUDE.md` gets a short pointer so agents find it.

## Acceptance criteria

- [ ] `docs/regression-checklist.md` exists with the viewports, the Public Pages section above, and a check per line.
- [ ] `CLAUDE.md` links it.
- [ ] Running it after 42–44 passes every line; results recorded in this ticket's closeout.

## Comments
- 2026-10-01: claimed, `ready-for-agent` → `in-progress` (Epic R7).
- 2026-10-01 [CLOSEOUT]: `2cde4ba` (orchestrator) + review fixes `d434462` (theme check computed from `warWeekThemeStyle`, since `/<edition>` isn't public; mechanical clipped-text check, since `/about`'s `overflow-hidden` hides overflow from scrollWidth). `CLAUDE.md` links it. Run after 42–44 against `pnpm seed:demo:xii` at 1440×900 and 390×844 (`test-results/r7-public-pages/checklist.txt`, 46/46 PASS): Sign-in wears XII — PASS; About wears XII incl. stills and Finale poster — PASS (tokens + 10/10 stills load + screenshots); About up to date, no redundancy — PASS (AI review, axis 1); Privacy and Terms up to date and name the admins — PASS; footer current year — PASS (© 2026); nothing cut off on a phone — PASS. All ACs PASS. `in-progress` → `done`. PR https://github.com/paul-macfarlane/jg-war-week/pull/110.

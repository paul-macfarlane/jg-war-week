# 12: Appearance Themes in light and dark

**What to build:** Every Appearance Theme renders in light and dark. Viewers pick Light, Dark or System (default System) in the header menu. Decisions: `../grilling-2026-09-28.md` (Q29–Q31, Q36).

**Blocked by:** none

**Status:** ready-for-agent

**Source:** regression feedback item 3

## Scope

- The palette for the other mode is derived from the Organizer's one (background and text swap; primary and accent adjusted until they pass contrast). The Organizer can override any derived color in Setup.
- Every seed theme, past ones included, gets both modes.
- Light / Dark / System in the header menu, saved in `localStorage` on the device across War Weeks, read with try/catch; System follows `prefers-color-scheme`. No flash of the wrong mode on load.
- The Finale, the Archive and `/about` follow the viewer's choice.

## Acceptance criteria

- [ ] Unit tests: the derivation for every seed theme passes the contrast checks in both modes; an Organizer override wins.
- [ ] Playwright: switching Light/Dark/System changes the page and survives reload; System follows emulated `prefers-color-scheme`. Screenshots of `/xi` in both modes under `test-results/e2e/<test>/`.
- [ ] axe reports no contrast violations on `/xi`, `/history` and `/about` in both modes.
- [ ] Schema change (overrides) and demo seed updated together; plan red-teamed.
- [ ] `/about` and `docs/maintainers-guide.md` updated.
- [ ] `pnpm gate` passes.

## Comments

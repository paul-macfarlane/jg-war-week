# 12: Appearance Themes support light and dark mode

**What to build:** A War Week theme is one palette, so a user who prefers light or dark mode is stuck with whichever the theme is. Themes should have both variants so users can follow the War Week's theme in their preferred mode.

**Blocked by:** none

**Status:** needs-triage

**Source:** regression feedback item 3

## Notes

Today `backgroundColorScheme()` infers light/dark from the background (`src/lib/theme.ts:33`). Likely a schema change (second palette) and needs a design for deriving the other variant; red-team if the schema changes.

## Acceptance criteria

- [ ] Each Appearance Theme renders in light and dark, following the OS setting with a user toggle.
- [ ] Contrast checks pass in both modes for every seed theme.
- [ ] `pnpm gate` passes.

## Comments

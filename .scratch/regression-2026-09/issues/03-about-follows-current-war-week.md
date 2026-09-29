# 03: /about follows the current War Week

**What to build:** /about is hardcoded to War Week XI (`ABOUT_THEME`, `CURRENT_EDITION`). It should use the theme of, and link to, the live War Week, or the next one if none is live, falling back to the latest completed one.

**Blocked by:** none

**Status:** needs-triage

**Source:** regression feedback item 19

## Notes

Same resolution the root page uses to pick the current edition. /about stays readable when no War Week exists.

## Acceptance criteria

- [ ] With a live War Week, /about uses its Appearance Theme and its "Open War Week" button links to it.
- [ ] With none live, it uses the next upcoming one, else the most recent completed one.
- [ ] `/about` updated per the scope rule; `pnpm gate` passes.

## Comments

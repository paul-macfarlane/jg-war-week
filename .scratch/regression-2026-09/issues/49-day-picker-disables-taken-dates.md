# 49: The Day picker greys out dates that already have a Day

**What to build:** When adding or editing a Day, dates that already have a Day in this War Week are disabled in the `DatePicker` (except the Day's own date when editing). The server's "There's already a Day on {date}." stays as the backstop.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A18

## Acceptance criteria

- [ ] Unit test: the disabled-date matcher disables taken dates and dates outside the War Week, and not the edited Day's own date.
- [ ] Screenshot of the picker with a taken date disabled at 390×844.
- [ ] `pnpm gate` passes.

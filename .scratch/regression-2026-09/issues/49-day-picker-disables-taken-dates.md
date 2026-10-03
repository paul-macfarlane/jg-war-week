# 49: The Day picker greys out dates that already have a Day

**What to build:** When adding or editing a Day, dates that already have a Day in this War Week are disabled in the `DatePicker` (except the Day's own date when editing). The server's "There's already a Day on {date}." stays as the backstop.

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A18

## Acceptance criteria

- [x] Unit test: the disabled-date matcher disables taken dates and dates outside the War Week, and not the edited Day's own date.
- [x] Screenshot of the picker with a taken date disabled at 390×844.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/113.

  Worker D49 (Sonnet), commit 5b403cf.
  - AC1 PASS: `dayDateDisabled` unit tests in `src/lib/day-range.test.ts` cover taken dates, dates outside the War Week, and the edited Day's own date.
  - AC2 PASS: test-results/r8-quick-fixes/day-picker-390/. XII: Feb 21–24 2027 are disabled (taken), Feb 25–26 are enabled, and dates outside the War Week are disabled.
  - AC3 PASS: `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).
  - `DatePicker` gains a `disabledDates` matcher prop. The server's duplicate-Day refusal is unchanged.

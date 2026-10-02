# 50: The date range picker stays open until Done

**What to build:** `DateRangePicker` no longer closes when the end date is picked. It stays open showing the selected range, with a **Done** button that commits and closes; an outside click or Escape also commits a complete range and discards a half-picked one (as today). Existing-Day dots and the "Day outside range" error keep working.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A12; grilling Q14

## Acceptance criteria

- [ ] Unit test for `nextRangeSelection` (or its replacement): a third tap after a complete range starts a new range; Done commits.
- [ ] e2e or Playwright check: pick start and end, picker still open, adjust start, Done, the field shows the new range.
- [ ] `pnpm gate` passes.

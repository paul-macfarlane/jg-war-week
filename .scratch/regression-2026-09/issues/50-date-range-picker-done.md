# 50: The date range picker stays open until Done

**What to build:** `DateRangePicker` no longer closes when the end date is picked. It stays open showing the selected range, with a **Done** button that commits and closes; an outside click or Escape also commits a complete range and discards a half-picked one (as today). Existing-Day dots and the "Day outside range" error keep working.

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A12; grilling Q14

## Acceptance criteria

- [x] Unit test for `nextRangeSelection` (or its replacement): a third tap after a complete range starts a new range; Done commits.
- [x] e2e or Playwright check: pick start and end, picker still open, adjust start, Done, the field shows the new range.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/113.

  Worker D50 (Sonnet), commit eb23e6c, plus review fix b74876b (e2e selectors).
  - AC1 PASS: `nextRangeSelection` / `rangeToCommit` unit tests: the second tap holds the range, a third tap starts a new range, and Done commits only a complete, allowed range.
  - AC2 PASS: e2e `r8 50 the date range picker stays open until Done` (`e2e/regression-r8.spec.ts`) is in `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).
  - AC3 PASS: `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).
  - "Adjust start" is a third tap that starts a new range, as the ticket's unit AC specifies. Done, outside click and Escape all commit a complete range and drop a half-picked or refused one.

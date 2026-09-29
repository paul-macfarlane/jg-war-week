# 08: Filter the Schedule by day

**What to build:** The Schedule shows every day. Keep "All" as the default and add a way to filter to one day.

**Blocked by:** none

**Status:** ai-review

**Source:** regression feedback item 5

## Notes

Day chips above the list; the existing day anchors and scroll-to-today stay.

## Acceptance criteria

- [ ] The Schedule defaults to All.
- [ ] Choosing a day shows only that day; the choice is reflected in the URL.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul, via `/atlas-implement` of Epic R1): `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).
- 2026-09-29: `in-progress → ai-review` — implementation integrated on `feat/regression-r1-quick-wins`; aggregate AI code review and verification started.

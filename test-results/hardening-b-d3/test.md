# D3 evidence (ticket 04, criteria 1 and 2), worker commit 25968c9, integrated as 31f7a6e

- `pnpm vitest run` (worktree database `war_weeker_d3`, migration-copy test excluded): Test Files 74 passed, Tests 1328 passed.
- Criterion 1: `src/actions/*.test.ts`, one test per family (setup, setup-schedule-faq, points-entries, brackets, announcements, awards, war-week-lifecycle, organizers). Each is a thrown mutation returning `{ ok: false, error: "Something went wrong. Try again." }`. Plus redirect and not-found propagation tests in awards. All eight were red before the change.
- Criterion 2: malformed-call tests for every parser in `src/lib/*` and `src/lib/bracket/input.ts`. Before the fix, 11 `parseCompetitionInput` cases threw TypeErrors.
- Not covered here: build and smoke, which run in the integrated gate.

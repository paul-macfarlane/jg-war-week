# 68: Unstart a War Week

**What to build:** A lifecycle action **Unstart** (`live → upcoming`), Organizer-only, behind a confirm, allowed only while the War Week has no Points Entries, no Heat results and no Games. The Lifecycle box (Settings, after ticket 57) adds one line on what Live changes: "Live makes this the War Week everyone lands on. Nothing is hidden before then."

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A1; grilling Q7

## Decisions

- `lifecycleActionError` gains the Unstart rule with its refusal ("Points have been entered; Unstart isn't available."); re-checked in the action, under a lock like the other lifecycle actions.
- CONTEXT.md lifecycle rules: replace "There's no way back to `upcoming`" with the Unstart rule.

## Acceptance criteria

- [x] Unit tests: Unstart allowed with nothing scored; refused with a Points Entry, a Heat result or a Game; refused for non-Organizers and for non-live editions.
- [x] e2e: Start then Unstart a fresh edition; it shows Upcoming again.
- [x] `pnpm gate` passes.

## Comments

## [AI CODE REVIEW]

See `../epics/R11-execution.md` [AI CODE REVIEW] (one review for the epic, both axes; no open blocking findings).

## [CLOSEOUT]

2026-10-02, branch `feat/regression-r11-content`. AC1 PASS (`src/lib/war-week-lifecycle.test.ts`, `src/lib/access.test.ts`, `src/mutations/war-week-lifecycle.test.ts`); AC2 PASS (`e2e/regression-r11-unstart.spec.ts`); AC3 PASS (gate). Added in review: an edition with a Winner (ended before) can't be unstarted. Residual: one ended with no Winner can still be Reopened then Unstarted. Commits `c61e47f`, `dc5a3b8`, `de713eb`. Full record: `../epics/R11-execution.md` [CLOSEOUT]. PR: https://github.com/paul-macfarlane/jg-war-week/pull/118

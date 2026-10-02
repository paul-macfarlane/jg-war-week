# 66: A Day can have a short description

**What to build:** An optional **description** on a Day (plain text, up to 280 characters), edited with the Day Theme, shown under the Day's heading on the Schedule (and on Home's Now/Next day header if there is one). Seeds and `Create next War Week` unaffected (Days aren't copied).

**Blocked by:** none (lands in the Days/Schedule form from ticket 58 if R9 has merged)

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A16

## Acceptance criteria

- [x] Migration adds a nullable column; seed schema accepts an optional `description`; seeds load twice.
- [x] e2e or smoke: a Day saved with a description shows it on `/[edition]/schedule`; screenshot at both viewports.
- [x] `pnpm gate` passes.

## Comments

## [AI CODE REVIEW]

See `../epics/R11-execution.md` [AI CODE REVIEW] (one review for the epic, both axes; no open blocking findings).

## [CLOSEOUT]

2026-10-02, branch `feat/regression-r11-content`. AC1 PASS (`drizzle/0020_wild_speed.sql`; seed schema and loader tests; smoke, seeds twice); AC2 PASS (`e2e/regression-r11-day-description.spec.ts`, Schedule and Home's Today header at both viewports); AC3 PASS (gate). Commits `0d44855`, `de713eb`, `b3cfdb3`. Full record: `../epics/R11-execution.md` [CLOSEOUT]. PR: https://github.com/paul-macfarlane/jg-war-week/pull/118

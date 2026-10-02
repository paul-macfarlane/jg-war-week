# 53: First run of the User Pages and Admin checklist

**What to build:** Run the Admin (Organizer and Host) and User Pages sections of `docs/regression-checklist.md` for the first time, in both passes (free-for-all on `pnpm seed:demo:xii`, teams on `pnpm seed:demo`) at 1440×900 and 390×844. Fix the checklist wherever a line is wrong, vague or can't be exercised. File every real `FAIL` as a `needs-triage` ticket.

**Blocked by:** 46–52 (run last in R8, so it checks the fixed app)

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, regression checklist. The sections and the checklist's purpose were written into `docs/regression-checklist.md` in PR #112. This ticket proves them by running them.

## Decisions

- The checklist is the agent-run regression suite (see its intro). A line an agent can't run without a human is a checklist bug: rewrite it, or mark it `BLOCKED` with the reason.
- R8's own changes update their lines first. For example, ticket 46 renames the Announcements line's `/news` and ticket 52 removes any mention of the pick.
- Sign-in uses `e2e/session.ts` from a Playwright script against `pnpm start -p 3200`. If that proves awkward, add a small committed runner (e.g. `scripts/regression/sign-in.ts`) and document it in the checklist's Setup.

## Acceptance criteria

- [ ] Every Admin and User Pages line has a verdict in both passes at both viewports, recorded in the closeout, with screenshots under `test-results/r8-quick-fixes/checklist/<page>-<width>/`.
- [ ] Each `FAIL` has a `needs-triage` ticket, listed in the closeout.
- [ ] Each checklist correction from the run is committed; `pnpm format:check` passes.

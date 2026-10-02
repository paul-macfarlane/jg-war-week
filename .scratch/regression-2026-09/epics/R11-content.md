# Epic R11: Content

**What to build:** The Announcement editor reaches journeys parity with image upload, videos live only in the post body, Days get a short description, the roster imports from a spreadsheet, and a live War Week can be Unstarted.

**Tickets:** `64`, `65`, `66`, `67`, `68` (files under `../issues/`)

**Branch:** `feat/regression-r11-content`

**Blocked by:** R10 merged into `staging` (Blob storage for image upload).

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Red-team:** **required** (Drizzle schema changes: drop `videoUrls`, add Day description). Plan with `/atlas-plan`, red-team, then implement.

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

64 → 65. 66, 67, 68 independent.

## Acceptance criteria

Each ticket's own, plus:

- [x] Demo seeds and migrations change together; smoke passes on seeded local Postgres.
- [x] `/about`, `docs/maintainers-guide.md` and the regression checklist updated.
- [x] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-02 (/atlas-plan): technical plan written to `R11-execution.md`. Red-team round 1 passed (0 blocking, 5 should-fix, 13 nits, all folded in). Paul answered: H0 images by URL only (scope change below); H1 accept the column-drop window, with merge and promotion timed outside War Week; H2 an empty roster cell clears the field. Next: `/atlas-implement`.
- 2026-10-02 [SCOPE CHANGE] (Paul): no image upload and no Blob in R11. Ticket 64's images are added by URL with a caption; upload returns with Blob in a later ticket. The "Blocked by: R10 (Blob storage)" line no longer applies (R10 shipped without Blob).
- 2026-10-02 (atlas-implement): claimed epic and tickets 64–68 on `feat/regression-r11-content`; `test-results/` cleared. Execution in `R11-execution.md`.
- 2026-10-02 (atlas-implement): delivered on `feat/regression-r11-content`; closeout in `R11-execution.md`. Human gate still open: after the merge (outside War Week), check staging Announcements show their moved videos. PR: https://github.com/paul-macfarlane/jg-war-week/pull/118

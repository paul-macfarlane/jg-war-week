# 71: An Award Category through the years

**What to build:** On History, a view per Award Category listing every War Week's recipients newest first ("War Week MVP: XII …, XI …, …, IV MVP 1st Place …"), reachable from the Archive and from a Category on any Awards page.

**Blocked by:** 70

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** grilling Q26

## Acceptance criteria

- [ ] `/history/awards/<category>` (or the plan's route) lists recipients by War Week, newest first, with Profile names where linked (ticket 60) else roster names.
- [ ] Screenshots at both viewports; smoke covers the route.
- [ ] `pnpm gate` passes.

## [CLOSEOUT]

2026-10-02, atlas-implement (Claude Opus 5.5). Deliverable D71 (worker: atlas-worker, sonnet; commit `a4a5f0e`), the orchestrator's 404 fix in `3233c5f` and the review fixes in `2b06e18`. Verified on `feat/regression-r12-participation-awards` at `2b06e18` (code; the closeout commit adds only `.scratch/` and `test-results/`), local Postgres `war-weeker-postgres` :2345, `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`. Final gate: `pnpm format:check && pnpm gate` exit 0 (format clean; lint 0 errors, 7 existing `<img>` warnings; vitest 167 files / 3604 tests; build; smoke 243 ok; Playwright 86 passed) → `test-results/r12/gate.txt`. PR: _(added after it opens)_.

| AC | Verdict | Evidence |
|---|---|---|
| `/history/awards/<category>` lists recipients by War Week, newest first, with Profile names where linked else roster names | PASS | Route is `/history/awards/[id]` (the Category's id, so a rename never breaks a link; plan A10). `e2e/regression-r12-award-history.spec.ts` asserts newest first, a Profile name for a linked recipient and a roster name for another; `src/queries/award-category-history.test.ts` |
| Screenshots at both viewports; smoke covers the route | PASS | `test-results/e2e/regression-r12-award-histo-6b63f--its-War-Weeks-newest-first-chromium/category-1440.png`, `category-390.png`; smoke: 200 newest first, linked from `/history`, unknown and malformed ids 404 → `test-results/r12/gate.txt` |
| `pnpm gate` passes | PASS | `test-results/r12/gate.txt` |

Deviations: the Archive detail's Awards section doesn't link to Categories (approved review deviation N-3; reachable from `/history` and every edition's Awards page).

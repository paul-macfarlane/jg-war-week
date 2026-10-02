# 74: Custom Finale slides

**What to build:** In admin → Finale, an Organizer adds **Custom slides** (heading, rich text with the ticket 64 editor including images and video, optional background color from the War Week's palette or a custom color that passes contrast) and places them anywhere in the order, edits and deletes them.

**Blocked by:** 72, 64 (editor)

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** grilling Q19, Q27

## Acceptance criteria

- [ ] e2e: add a custom slide with an image between Awards and Standings; the Finale shows it there.
- [ ] Contrast of a custom background with text passes (axe or the theme contrast helper).
- [ ] `pnpm gate` passes.

## [CLOSEOUT]

2026-10-03, atlas-implement (Claude Opus 5.5). Deliverable D74 (worker: atlas-worker, sonnet; commit `0b72b2e`, merged `34ec6ce`), plus the review fixes `6096595` (RF). Verified on `feat/regression-r13-finale-slides` at `6096595` (code; the closeout commits add only `.scratch/` and `test-results/`), local Postgres `war-weeker-postgres` :2345, `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`. Final gate: `pnpm format:check && pnpm gate` exit 0 (format clean; lint 0 errors, 11 existing-pattern `<img>` warnings; vitest 173 files / 3729 tests; build; smoke 246 ok; Playwright 91 passed) → `test-results/r13/gate.txt`. PR: [paul-macfarlane/jg-war-week#121](https://github.com/paul-macfarlane/jg-war-week/pull/121).

| AC | Verdict | Evidence |
|---|---|---|
| e2e: add a Custom slide with an image between Awards and Standings; the Finale shows it there | PASS | `e2e/regression-r13-custom-slides.spec.ts`: heading, image with caption, background; index Awards < Custom < Standings (Red-team C2 reading); an image click doesn't advance, a stage click does; edit and delete; duplicate heading refused. Passed in the gate; screenshots `test-results/e2e/regression-r13-custom-slid-*/` |
| Contrast of a custom background with text passes | PASS | axe `color-contrast` on the Custom slide at 1440×900 and 390×844 in that e2e (no violations), and `src/lib/custom-finale-slide.test.ts` (`customSlideColors` ≥ 4.5:1 for every token on light, dark, mid and primary backgrounds) in the gate |
| `pnpm gate` passes | PASS | `test-results/r13/gate.txt` |

Deviations: images and video by URL only (ticket 64's editor; upload was descoped there); no eyebrow on a Custom slide; new Custom slides go just before Standings, even when hidden (N4).

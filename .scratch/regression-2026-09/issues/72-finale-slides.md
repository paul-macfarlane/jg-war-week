# 72: The Finale becomes a slideshow

**What to build:** `/[edition]/finale` becomes a sequence of full-screen **Finale slides** the Organizer steps through on the projector (Space, →, click: next; ←: back; Escape: exit to the first slide). Each War Week has an ordered slide list the Organizer reorders (drag, with keyboard alternatives) and hides in admin → Finale. This ticket ships the framework and one slide: the **Standings countdown** (today's Finale, unchanged, playing when its slide starts). Tickets 73 and 74 add the rest.

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A4; grilling Q19, Q27

## Decisions

- The Finale rules hold: it never reorders or recomputes Standings; nothing auto-advances; reduced motion skips animations but still waits for the presenter.
- Slide order and hidden flags stored per War Week (schema); a War Week with no saved list uses the default order: Title, By the numbers, Awards, Champions, Standings countdown, Winner.
- The Bracket Finale is unchanged.
- Viewers other than the presenter just see the slideshow; no sync between screens.
- CONTEXT.md: **Finale** and **Finale slide**; Finale rules updated.

## Acceptance criteria

- [ ] Unit tests for the slide-list resolution (default, reordered, hidden).
- [ ] e2e: an Organizer moves the Standings slide and hides one; the Finale plays in that order; the existing "Finale plays to first place" e2e passes through the slideshow.
- [ ] `pnpm gate` passes.

## [CLOSEOUT]

2026-10-03, atlas-implement (Claude Opus 5.5). Deliverable D72 (worker: atlas-worker, opus; commit `dc9eab5`), with the integration fixes `6f8511c`, `66cb75a` and the review fixes `6096595` (RF). Verified on `feat/regression-r13-finale-slides` at `6096595` (code; the closeout commits add only `.scratch/` and `test-results/`), local Postgres `war-weeker-postgres` :2345, `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`. Final gate: `pnpm format:check && pnpm gate` exit 0 (format clean; lint 0 errors, 11 existing-pattern `<img>` warnings; vitest 173 files / 3729 tests; build; smoke 246 ok; Playwright 91 passed) → `test-results/r13/gate.txt`. PR: (linked after opening).

| AC | Verdict | Evidence |
|---|---|---|
| Unit tests for the slide-list resolution (default, reordered, hidden) | PASS | `src/lib/finale-slides.test.ts` (default, reordered, hidden, missing built-in appended, Custom kept in place, `moveToIndex`, stepper) and `src/mutations/finale-slides.test.ts` (lock, materialize, delete → move/create order) in the gate's vitest run → `test-results/r13/gate.txt` |
| e2e: an Organizer moves the Standings slide and hides one; the Finale plays in that order; the existing Finale e2e passes through the slideshow | PASS | `e2e/regression-r13-finale.spec.ts` (drag once, ↑ once, Hide, then the Finale plays Standings, Title, Awards, Winner [Champions after Winner when an XI Bracket is finalized]; → on the last slide, ←, Escape) and `e2e/finale.spec.ts` ("the Finale's Standings countdown ends on first place", renamed from "…plays from Start…" in review S12) passed in the gate; screenshots `test-results/e2e/regression-r13-finale-72-A-*/`, `test-results/e2e/finale-the-Finale-s-Standings-*/` |
| `pnpm gate` passes | PASS | `test-results/r13/gate.txt` |

Deviations (recorded in the execution record): the Standings countdown plays on arrival (no Start on the slideshow); keys per Red-team S5 (Enter never bound); `data-finale-hydrated` hook; the slideshow is a full-screen overlay (S4). The Bracket Finale is unchanged.

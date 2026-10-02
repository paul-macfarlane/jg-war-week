# Execution record — Epic R7: Public pages

Contract: [`R7-public-pages.md`](./R7-public-pages.md) and its tickets
[`42`](../issues/42-about-copy-and-mobile-wrap.md),
[`43`](../issues/43-xii-demo-and-about-stills.md),
[`44`](../issues/44-privacy-terms-current-theme-and-contact.md) and
[`45`](../issues/45-regression-checklist.md). No `/atlas-plan` run; this
plan was derived by `/atlas-implement` (work package `regression-r7`) on
2026-10-01 against `staging` at `ab28972`. Red-team not required (epic).
Branch `feat/regression-r7-public-pages`.

## [EXECUTION PLAN]

2026-10-01.

### Structure

Sequential, direct checkout: **D45 → D42 → D43 → D44**, one worker at a
time. Nothing here amends a ticket.

- **D45** (ticket 45): `docs/regression-checklist.md` and the `CLAUDE.md`
  pointer. Docs only; written by the orchestrator.
- **D42** (ticket 42): `/about` copy, the six cards in `ABOUT_FEATURES`,
  the 390px overflow fix, `page.test.tsx`. Worker.
- **D43** (ticket 43): `seeds/demo/xii.json`, `pnpm seed:demo:xii`,
  `scripts/about-media.ts` on the current War Week, regenerated
  `public/about/`. Worker. Blocked by D42 (card slugs).
- **D44** (ticket 44): `/privacy` and `/terms` on the current War Week,
  admin contact line, `STATIC_PAGE_THEME` deleted. Worker.

Why sequential: D42 and D44 both edit `src/lib/about.ts`; D43 and D44 both
touch `scripts/about-media.ts` (it imports `STATIC_PAGE_THEME`, lines 43, 72
and 613), and D43 rewrites it. Running D43 before D44 means D43 drops that
import as part of reading the current War Week's theme, so D44 never has to
make a throwaway edit to the script. All three also reset the one local
Postgres (smoke, e2e, `seed:demo:xii`), shared mutable state that rules out
running their gates concurrently.

### Resolved decisions

1. **D42 leaves `about-media.ts` compiling, nothing more.** If its new card
   slugs or removed cards break the script's typecheck, D42 makes the
   smallest edit that keeps `pnpm typecheck` green; D43 owns the rewrite.
   Until D43, new slugs reuse the closest existing PNG (copied under the
   new name); `lifecycle.png` and `ask-claude.png` are deleted with their
   cards.
2. **D43's evidence dir.** `about-media.ts` writes its `/about` evidence to
   `test-results/about-media/` (was `28-splash/`, a past work package).
3. **Screenshots for the epic and ticket ACs are taken once**, by the
   orchestrator in aggregate verification against the integrated build with
   `pnpm seed:demo:xii`, into `test-results/r7-public-pages/<page>-<width>/`
   (`about-390`, `about-1440`, `about-stills-390`, `about-stills-1440`,
   `privacy-*`, `terms-*`, `sign-in-*`). Workers check their pages but do
   not write there.
4. **Theme check** (checklist and 44's AC): the page's `[data-theme-root]`
   inline style equals `/<edition>`'s.

### Verification map

Run surface: local (production build + local Postgres). Deployed smoke is
not part of this epic. Evidence policy: `docs/agents/testing.md`
(committed under `test-results/`; proof root cleared at start of this
work package).

| Criterion | Command / action | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|
| 42-AC1 copy verbatim, banned phrases absent | `pnpm test src/app/about` + read rendered `/about` | headline, hero, "Why we built this" verbatim; none of the 8 phrases | vitest output; `about-*` screenshots | D42 | `src/app/about`, `src/lib/about.ts` |
| 42-AC2 six cards in order | same test + screenshot | exactly 6, nav order, 1–2 sentences | vitest; screenshot | D42 | same |
| 42-AC3 mode-neutral | read copy (review) + render with XII free-for-all | no Teams-only copy | review record; screenshot | D42 | same |
| 42-AC4 no overflow at 390, 1440 | Playwright `scrollWidth <= clientWidth` on `/about` | true at both | `about-390/`, `about-1440/` | D42 | about page/components |
| 42-AC5 test asserts absences and order | read `page.test.tsx` + run | passes | vitest | D42 | test file |
| 43-AC1 XII demo valid, FFA, fictional, contrast | `pnpm test src/seed` | passes incl. Archive contrast both schemes | vitest | D43 | `seeds/demo/xii.json` |
| 43-AC2 about-media writes XII stills; no `/xi`; exactly 8 PNGs | `pnpm build && pnpm seed:demo:xii && pnpm tsx scripts/about-media.ts`; `grep -n "/xi" scripts/about-media.ts`; `ls public/about` | exit 0; no match; hero (before/entry/after), finale-poster, 6 card PNGs | script log; ls | D43 | script, seed, cards |
| 43-AC3 stills in XII colors | Playwright screenshots of `/about` | every still XII | `about-stills-390/`, `about-stills-1440/` | D43 | `public/about/*` |
| 43-AC4 smoke and e2e on XI demo | `pnpm smoke`, `pnpm e2e` | pass | gate output | D43 | any |
| 44-AC1 current theme / fallback | `pnpm test src/app/privacy src/app/terms` + theme check in browser | XII with demo; fallback with none | vitest; screenshots | D44 | privacy/terms |
| 44-AC2 `STATIC_PAGE_THEME` gone | `grep -rn STATIC_PAGE_THEME src scripts` | no match | output | D44 | any |
| 44-AC3 admin contact line | test + read | "Contact the Jahnel Group admins." on both; old phrase gone | vitest | D44 | privacy/terms |
| 44-AC4 no overflow; screenshots | Playwright | true at 390 | `privacy-*`, `terms-*` | D44 | privacy/terms |
| 45-AC1 checklist exists | read `docs/regression-checklist.md` | viewports, Public Pages, a check per line | file | D45 | the doc |
| 45-AC2 `CLAUDE.md` links it | `grep regression-checklist CLAUDE.md` | match | output | D45 | CLAUDE.md |
| 45-AC3 / Epic-AC1 checklist passes | Playwright script over `/sign-in`, `/about`, `/privacy`, `/terms` at both viewports with XII demo | every line passes | `test-results/r7-public-pages/`; ticket 45 closeout | after D44 | any app change |
| Epic-AC2 tickets closed out, `done` | read ticket files | closeout + `done` each | files | closeout | — |
| Epic-AC3 CI passes | `gh pr checks` | green | PR | after PR | any push |
| Epic-AC4 / every ticket's `pnpm gate` | `pnpm format:check && pnpm gate` | exit 0 | gate log | after D44 | any change |
| DoD showcase current | review: `/about` and `docs/maintainers-guide.md` updated | both current | diff | after D44 | — |

Human gates: none actionable now. Announced for later: none needs a human —
CI on the PR (Epic-AC3) is read after the PR opens.

## [PROGRESS]

- D45 written by the orchestrator (docs only).

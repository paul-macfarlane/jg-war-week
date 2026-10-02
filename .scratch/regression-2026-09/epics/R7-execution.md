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
- D42 accepted (`e8efb9f`, Sonnet). Orchestrator fix amended in: `e2e/about-games.spec.ts` retargeted from the removed Games card to `competitions`; page JSDoc wrapped.
- D43 accepted (`ea37484`, Opus). Approved deviation: `seed:demo` and `localSeedFiles()` load the XI demo last (with `seeds/xii.json` first), so a live XII demo left by `seed:demo:xii` cannot block smoke/e2e's reset with a second live War Week.
- D44 accepted (`f8c6039`, Sonnet). Plan change: ran after D43 (D45 → D42 → D43 → D44) so D43 dropped `about-media.ts`'s `STATIC_PAGE_THEME` import as part of its rewrite.
- Candidate gate at `f8c6039`: exit 0 (3171 unit, smoke 201 ok, e2e 53 passed).

## [AI CODE REVIEW]

2026-10-01. Two fresh Opus reviewers read `ab28972..f8c6039` (one per axis); the orchestrator adjudicated each finding against the cited hunks.

### Axis 1 — technical implementation and spec conformity

- **F1 (blocking, resolved in `d434462`).** Privacy's "Who did what" was untrue:
  - Hosts also see Points Entry emails (`admin/points` filtered per Host).
  - The public Announcement shows the roster name or handle, not the email (`announcement-card.tsx`, `authorHandle`).
  - Organizers are global, not per War Week.
- **F2 (resolved).** The roster email also links a person to their Participant (`enrollment.ts`, `heat-reports.ts`, `games.ts`), and the Team wording wasn't mode-neutral.
- **F3/F4 (resolved).** `about-media.ts` ran setup outside `try`, ran its restores as one chain, and leaked the saved Points Entry or Game when a later step failed.
- **F5 (resolved).** The current-War-Week SQL lacked `selectCurrentWarWeek`'s `edition_number` tie-breaks.
- **F6/F7 (resolved).** Alt text was hard-coded to "XII" and named "Teams"; comments still said "mid-countdown" and "video hero".
- **F8 (resolved).** The maintainer's guide said to use `--stills` on an edition change, which leaves the Finale poster in the old theme.
- **F9 (resolved).** The checklist's theme check compared against `/<edition>`, which isn't public, and its scroll check couldn't catch text clipped by `overflow-hidden`. The `PUBLIC_PATHS` comment was stale.
- **F10 (resolved).** The stepper would clip below 390px.
- **F11 (resolved).** The Terms JSDoc was garbled.
- **F12 (deviation approved).** No test for "one or two sentences" (a manual count passes). `seed:demo:xii` lists the history seeds by hand; the maintainer's guide documents writing one per year.
- Conformant: 42's verbatim copy, the absent phrases, six cards and overflow fix; 43's seed shape, script and XI fixture; 44's theme, fallback, contact line and deletion; 45's doc and link; DoD showcase (`/about` and `docs/maintainers-guide.md`).

### Axis 2 — coding standards

- **S1–S5 (resolved).** Fixed:
  - the garbled JSDoc
  - dead `data:`/null-cookie paths in `about-media.ts`
  - comment lines past 80 columns
  - stale comments
  - hard-coded edition alt text
- **S6 (resolved).** `CONTEXT.md` notes that "the Jahnel Group admins" are the company's administrators, not an app role. The copy is ticket 44's required wording.
- **S7 (resolved).** README describes `seed:demo` and `seed:demo:xii`.
- **S8 (deviation approved).** `seed:demo:xii` lists the seeds explicitly.
- **S9 (resolved).** The test-only `XII_DEMO_SEED` export is inlined in the test.
- **S10 (deviation approved).** `about-games.spec.ts` and its evidence directory keep their R3 names; the test's own name is updated, and renaming is churn.
- **S11 (deviation approved).** The Privacy and Terms test helpers repeat `/about`'s, following the per-file fixture idiom.
- Conformant: shadcn and existing `buttonVariants` only; no `.env` reads; canonical domain terms; clean removals.

Every blocking finding is resolved. DR fix commit: `d434462` (Sonnet). The orchestrator checked its Host-visibility and roster-link claims against `admin-sections.ts`, `enrollment.ts` and `heat-reports.ts`.

## [CLOSEOUT]

2026-10-01. Repository `war-weeker`, branch `feat/regression-r7-public-pages` from `staging` `ab28972`, PR https://github.com/paul-macfarlane/jg-war-week/pull/110.

| Deliverable | Commit | Worker model | Result |
|---|---|---|---|
| D45 Regression checklist | `2cde4ba` | orchestrator (Opus) | accepted |
| D42 About copy and phone wrap | `e8efb9f` | Sonnet | accepted (orchestrator fix amended in) |
| D43 XII demo and About stills | `ea37484` | Opus | accepted |
| D44 Privacy and Terms | `f8c6039` | Sonnet | accepted |
| DR Aggregate review fixes | `d434462` | Sonnet | accepted |
| (evidence) refreshed stills, gate, checklist | `20abc56` | orchestrator | — |

**Verified run command**

1. `set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate` → exit 0 at `d434462`: 3172 unit tests, smoke 201 `ok` / 0 `not ok`, e2e 53 passed.
2. Then `pnpm seed:demo:xii && pnpm tsx scripts/about-media.ts` → exit 0.
3. Then `pnpm start -p 3300` (with a throwaway `BETTER_AUTH_SECRET`) and the Public Pages checklist script → 46/46 PASS at 1440×900 and 390×844.
4. Finally `pnpm seed:demo` restores the XI demo.

Evidence (committed):
- `test-results/r7-gate/gate.txt`
- `test-results/r7-public-pages/checklist.txt`, plus one screenshot per page per viewport: `sign-in-*`, `about-*`, `privacy-*`, `terms-*`, `about-stills-*`
- `test-results/about-media/`
- `test-results/e2e/`

No deployed target in scope.

**Verdicts.** PASS: 42-1 … 42-6, 43-1 … 43-5, 44-1 … 44-5, 45-1 … 45-3, E-1, E-2, E-4, DoD showcase. E-3 (CI on the PR) is pending at closeout; check with `gh pr checks 110`.

**Deviations**
- D43 changed the `seed:demo` and `localSeedFiles()` load order (see [PROGRESS]).
- Order changed to D45 → D42 → D43 → D44.
- Review deviations F12, S8, S10 and S11.
- Process: the `in-progress` → `ai-review` transition was not written to the ticket files; the review ran between D44 and closeout.

**Isolation re-check.** Sequential direct checkout was predicted on `src/lib/about.ts` (D42, D44) and `scripts/about-media.ts` (D42, D43). Both collisions materialised: `about.ts` changed in D42, D43, D44 and DR; `about-media.ts` in D42, D43 and DR. The shared local Postgres reset (smoke, e2e, `seed:demo:xii`) also held throughout.

**Follow-up candidates**
- The Finale poster is the Finale's Start screen (empty Standings), as XI's was. A frame from the countdown would sell it better.
- The schedule still scrolls slightly under the sticky nav.

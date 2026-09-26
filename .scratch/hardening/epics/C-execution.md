# Execution: Epic C (test net, then refactor)

Epic: `C-test-net-and-refactor.md`. Tickets `../issues/13-test-net.md`, then `../issues/11-adr-0001-layering-and-dead-code.md`. Branch `chore/hardening-c-tests-and-layering` from `staging` `2db3b38` (Epic B merged in #79). One PR into `staging`. Run surface: local + deployed (CI runs smoke and Playwright on the PR; nothing deploys from this epic).

## Resolved decisions (execution, not contract)

- **Playwright session stub.** The e2e helper does what `scripts/smoke.ts` does: insert a `user` and `session` row, sign the token with `BETTER_AUTH_SECRET` (`makeSignature` from `better-auth/crypto`) and set the `better-auth.session_token` cookie. No Google. The Organizer flows insert the e2e user's email into `organizer`.
- **Playwright layout.** `@playwright/test` (devDependency), `playwright.config.ts`, specs under `e2e/`, Chromium only, `webServer` = `pnpm start -p 3200` (needs `pnpm build`), `outputDir: test-results/e2e` so Playwright's own clearing never touches other evidence. Each flow saves at least one screenshot via `testInfo.outputPath(...)`, which is `test-results/e2e/<test-name>/`. A global setup refuses a non-local `DATABASE_URL` (`isLocalDatabaseUrl`), runs `pnpm db:migrate` and `pnpm seed:load --reset seeds/*.json`; a teardown deletes the e2e users. Script `pnpm e2e`; `gate` becomes `typecheck && lint && test && build && smoke && e2e`. CI adds `pnpm exec playwright install --with-deps chromium` and `pnpm e2e` after smoke.
- **The five flows** (ticket 13): (1) `x@example.com` session is refused and an anonymous visit lands on `/sign-in`; (2) an Organizer records a Points Entry in `/admin/points` and `/xi/leaderboard` shows the new total; (3) a single-elimination Competition gets Entrants, a Bracket, Heat Results, advances, finalizes, and its Points Entries appear; (4) `/xi/finale` Start runs to first place; (5) `/history` and each past edition page render.
- **Vitest gaps** (ticket 13): `src/queries/standings.test.ts` (rolled-back tx, two War Weeks; the join only counts the queried one); `src/lib/standings.test.ts` (negative points); `src/lib/points-entry.test.ts` or the mutation test (team target on an individual Competition refused); `src/lib/standings.test.ts` (Counts Toward Team with no Team); `src/mutations/brackets.test.ts` (Placement Points edit after finalize refused; a manual Points Entry racing finalize, two connections, in the pattern of `src/mutations/races.test.ts`; a re-record with the same winner keeps later Heats).
- **`cn` stays.** `cn@0.4.0` is a compiled `clsx` + `tailwind-merge` replacement with a real merge engine. Nothing to replace.
- **Lint rule** (11-AC2): `no-restricted-imports` scoped to `src/lib/**` refusing `@/seed*`, `@/queries*`, `@/mutations*`, `@/actions*`, `@/components*`, `@/app*`, `next/*` and `lucide-react`. `@/db/schema` type imports and `@/db` types stay allowed: the AC names the five forbidden layers, and lib's zod enums derive from the Drizzle `pgEnum` `enumValues` (ticket 30 item).
- **`withTransaction`** has no caller outside tests. It goes; the per-file rolled-back-transaction helper the DB tests copy becomes one shared test helper (`src/db/test-transaction.ts`) on `db.transaction`. ADR 0001's "Uses `withTransaction`" line is updated to say the mutation runs in one `dbOrTx.transaction`.
- **Smoke split.** `scripts/smoke.ts` becomes `scripts/smoke/` with `index.ts` (main, run order), `harness.ts` (server, fetch, ok/fail, sessions, runQuery) and one module per area, mirroring the `assert*` groups. `package.json`'s `smoke` script points at `scripts/smoke/index.ts`. The ok-line count (177 on `2db3b38`) and the FAIL count (0) are the behavior contract.
- **Not in scope** (named in Epic B's review as "for ticket 11" but absent from ticket 11's text): folding `/admin` page visibility into `can`. Left as a follow-up on the ticket.

## Structure: three waves

| Wave | Deliverable | Owns | Checkout | Model |
|---|---|---|---|---|
| 1 (parallel) | **D1** ticket 13 vitest gaps | `src/queries/standings.test.ts` (new), `src/lib/standings.test.ts`, `src/lib/points-entry.test.ts`, `src/mutations/brackets.test.ts`, `src/mutations/points-entries.test.ts` | worktree `d1`, DB `war_weeker_d1` | sonnet |
| 1 (parallel) | **D2** ticket 13 Playwright, CI, gate, docs | `e2e/**`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `.gitignore` (Playwright caches only), `docs/agents/testing.md` (command table), `README.md`, `docs/maintainers-guide.md` (gate wording) | direct, DB `war_weeker`, port 3200 | opus |
| 2 (parallel) | **D3** ticket 11 layering + lint rule + `withTransaction` | `src/lib/{setup,setup-schedule-faq,war-week-lifecycle,schedule,more-links}.ts` + tests, `src/seed/schema.ts`, `src/components/more-links*.tsx` (icons), `src/app/**` callers of `resolveClock`, `src/mutations/*.ts` + tests (signature order, `DEFAULT_SETTINGS` out), `src/actions/*.ts` (call sites only), `eslint.config.mjs`, `src/db/index.ts`, `src/db/test-transaction.ts` (new) + every DB test's helper import, `docs/adr/0001-*.md` (one line) | direct, DB `war_weeker` | opus |
| 2 (parallel) | **D5** ticket 11 dead code, evidence scripts, smoke split, Heat button, `finaleDurationMs` | `scripts/**` (delete `*-evidence.ts`; `smoke.ts` → `smoke/`), `package.json` (`smoke` script only), `src/components/{coming-soon,option-select,bracket-results,finale}.tsx`, `src/components/ui/sonner.tsx`, `src/lib/finale.ts` + test, `src/app/globals.css` (`cn-toast`), `docs/maintainers-guide.md` ("Where things live" smoke row) | worktree `d5`, DB `war_weeker_d5`, `SMOKE_PORT=3105` | sonnet |
| 3 | **D4** ticket 11 duplication, one `revalidatePath` rule, seed upsert helper, pgEnum zod enums, `--ww-primary`, hex parsing, `useWide`, Team swatch, `ActionResult`/`MutationResult`, shared regexes | `src/actions/*.ts`, `src/actions/_shared.ts` or similar (new), `src/mutations/{setup,setup-schedule-faq,types}.ts`, `src/queries/{points-entries,announcements,awards}.ts`, `src/lib/{awards,competitions,announcements,setup-schedule-faq,points-entry,bracket/input,color,theme,setup}.ts` + tests, `src/auth/authorize.ts`, `src/components/{date-range-picker,install-instructions,teams-editor,war-week-settings-form,color-field}.tsx`, `src/app/admin/setup/{war-week,teams}/page.tsx`, `src/seed/load.ts` + test, `src/lib/*` enum schemas | direct, DB `war_weeker` | opus |

**Isolation.** Wave 1 runs D1 in a worktree because D2 owns the direct checkout for an hour of build + browser work and both need Postgres: D1 gets `war_weeker_d1` so its transactional tests never meet D2's `seed:load --reset`. Predicted ownership is disjoint (D1 only `*.test.ts` under `src/`; D2 nothing under `src/`). Wave 2 runs D5 in a worktree because D3 and D5 run at once and D5 must run smoke (its own DB and `SMOKE_PORT=3105`, its own `.next`). Predicted collisions avoided by moving items: `--ww-primary` (in `src/lib/theme.ts`, which D4 also edits) goes to D4; `withTransaction` (whose removal edits every DB test file D3 already edits) goes to D3, so D5 touches no `src/**/*.test.ts`. D4 is serialized after wave 2 because it edits `src/actions/*`, `src/mutations/*` and `src/lib/setup*.ts`, which D3 also edits. Both worktrees are removed right after integration (Epic B: a worktree's `.next` output broke `pnpm lint` in the main checkout). Re-check all three predictions at closeout against `git show --name-only`.

Worktrees live under `.claude/worktrees/hardening-c/war-weeker/{d1,d5}` on branches `chore/hardening-c-tests-and-layering-{d1,d5}`; accepted commits are cherry-picked onto the work-package branch.

## Verification map

Evidence root `test-results/` (Epic B's evidence removed on this branch 2026-09-26; artifacts committed on the branch, per `docs/agents/testing.md`). Environment: local Postgres 17 from `docker compose` on port 2345 (`DATABASE_URL` as in `.env.example`, `DATABASE_DRIVER=pg`); CI's Postgres service for E-AC2.

| Criterion | Command / action | Real dependency | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| 13-AC1a five flows pass locally | `pnpm build && pnpm e2e` | local Postgres, built app, Chromium | 5 specs pass; a screenshot per flow under `test-results/e2e/` | `test-results/e2e/**`, `test-results/hardening-c-gate/gate.txt` | after D2; rerun after every wave | any `src/`, `e2e/`, seed or config change |
| 13-AC1b five flows pass in CI | `gh run list --branch chore/hardening-c-tests-and-layering` and the run's `pnpm e2e` step | GitHub CI | CI green on the PR head with the e2e step passing | `test-results/hardening-c-ci/runs.md` | after push | any change |
| 13-AC2a new vitest cases pass | `pnpm test -- src/queries/standings.test.ts src/lib/standings.test.ts src/lib/points-entry.test.ts src/mutations/brackets.test.ts src/mutations/points-entries.test.ts` | local Postgres (query and mutation tests) | every new case passes | `test-results/hardening-c-d1/vitest.txt` | after D1 | those files or the modules they cover |
| 13-AC2b a case fails when its rule is broken | orchestrator by hand: drop the `competition.warWeekId` filter in `getStandings` (or the finalize guard), run the one test, restore | local Postgres | the test fails with the rule broken and passes restored | `test-results/hardening-c-focus/mutation-probe.txt` | after D1 | the probed test |
| 13-AC3 gate includes Playwright and passes | `pnpm gate` (`package.json` `gate` ends in `&& pnpm e2e`) | local Postgres, built app, Chromium | green | `test-results/hardening-c-gate/gate.txt` | after D2; final after D4 | any change |
| 13-DOCS testing.md command table has `e2e` | `grep -n "e2e" docs/agents/testing.md README.md docs/maintainers-guide.md` | none | an `e2e` row naming `pnpm e2e`; gate wording lists e2e | `test-results/hardening-c-docs/grep.txt` | after D2 | those files |
| 11-AC1 no behavior change | `pnpm gate` after wave 2 and after D4: vitest count ≥ wave-1 count, smoke `ok` lines = 177 and 0 `FAIL`, e2e 5/5 | local Postgres, built app | as stated | `test-results/hardening-c-gate/gate.txt` (final), `hardening-c-wave2/gate.txt` | after wave 2; final after D4 | any change |
| 11-AC2 lint rule enforces lib's imports | `pnpm lint` is clean; then the orchestrator adds `import "@/seed/schema"` to a lib file, runs `pnpm lint`, expects the `no-restricted-imports` error, restores | none | rule fires on the probe, clean without it | `test-results/hardening-c-focus/lint-probe.txt` | after D3 | `eslint.config.mjs`, `src/lib/**` |
| 11-AC3 gate | `pnpm gate` | local Postgres | green | `test-results/hardening-c-gate/gate.txt` | after D4 | any change |
| 11-SCOPE named items done | `grep` probes: no `from "@/seed` under `src/lib`; no `lucide-react` under `src/lib`; no `new Date()` in `resolveClock`; one `revalidateWarWeek`; one `refusingDuplicate`; one `organizerWarWeekColumns`; `ls scripts/` has no `*-evidence.ts`; `scripts/smoke.ts` gone and `scripts/smoke/` present; no `coming-soon.tsx`; no `cn-toast`; no `--ww-primary`; no `withTransaction`; no raw `<button` in `bracket-results.tsx` | none | each probe as stated | `test-results/hardening-c-docs/grep.txt` | after D4 | the named files |
| E-AC1 tickets record closeout and are `done` | `grep -n '^\*\*Status' .scratch/hardening/issues/{11,13}-*.md .scratch/hardening/epics/C-*.md` | none | all `done` | ticket files (committed) | closeout | ticket files |
| E-AC2 CI runs smoke and Playwright on the PR and passes | as 13-AC1b, plus the `pnpm smoke` step | GitHub CI | green | `test-results/hardening-c-ci/runs.md` | after push | any change |
| E-AC3 `pnpm gate` locally | as 11-AC3 | local Postgres | green | `test-results/hardening-c-gate/gate.txt` | after D4 | any change |
| DoD-DOCS showcase current (team rule) | no user-visible change in this epic; `docs/maintainers-guide.md` updated for the gate and the smoke location | none | guide mentions `pnpm e2e` and `scripts/smoke/` | `test-results/hardening-c-docs/grep.txt` | after D5 | those files |

## Human gates

None. CI runs on push without a human step; PR creation is closeout. Nothing deploys.

## Progress

- 2026-09-26: plan recorded; proof root cleared; epic and tickets 13, 11 claimed (`in-progress`).
- Wave 1: D2 accepted (`d3f663c`; orchestrator rerun of `pnpm e2e` 17/17). D1 accepted and cherry-picked (`d07d8a5`); 79 files / 1366 tests; by-hand probe on the `getStandings` join (1003 vs 3) proves 13-AC2b. Evidence `fbcae4f`. Worktree `d1` and its DB removed.

## Closeout

Pending.

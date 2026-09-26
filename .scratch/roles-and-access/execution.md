# Execution: Epic B (Organizers, Hosts, the write target, and the action layer)

Spec: `spec.md`. Epic: `../hardening/epics/B-access-and-action-layer.md`. Tickets 03, 04, 08, 10. Branch `feat/03-roles-and-access` from `staging` `4a41296` (the spec commits ride on it). One PR into `staging`. Run surface: local + deployed (CI smoke on the PR; the production prerequisite belongs to the `staging` → `main` PR).

## Structure: four waves

| Wave | Deliverable | Owns | Checkout |
|---|---|---|---|
| 1 | **D1** schema, migration set (tables + `--custom` copy), seed `organizers`, Organizer/Host mutations with the last-Organizer lock, create-next copies Hosts, copy test and mutation tests | `src/db/schema.ts`, `drizzle/`, `src/seed/*`, `seeds/*.json`, `src/mutations/{organizers,setup,war-week-lifecycle}.ts` + tests, `src/queries/*` reads for roles | direct |
| 2 | **D2** actor, `can`, authorize step, every action on the new order (`warWeekId` on creates and the settings save), `/admin` gate and trimming, Organizers page, Hosts field, Admin link, removals, minimal smoke churn | `src/lib/access.ts` + test, `src/auth/*`, `src/actions/*`, `src/app/admin/**`, `src/app/[edition]/war-week.ts`, `src/components/{admin-*,organizer-email-chips,*-form}.tsx`, `src/lib/{setup,war-week-lifecycle}.ts`, `scripts/smoke.ts` (Organizer helper and refusal strings only) | direct |
| 3 (parallel) | **D3** ticket 04 code (boundaries, catch-all, parser shape checks, `loading.tsx`, unit tests; no smoke) | `src/app/**/{error,global-error,loading}.tsx`, `src/actions/*` (catch-all only), `src/lib/*` parsers + tests | worktree `d3` |
| 3 (parallel) | **D4** ticket 08 | `src/auth/server.ts`, `src/auth/trusted-origins.ts` + test, `README.md` | worktree `d4` |
| 3 (parallel) | **D5** ticket 10 | `src/mutations/*` (locks), `src/lib/competitions.ts` + test, `src/db/schema.ts` (indexes, checks, comment), one generated migration, two-connection tests | worktree `d5` |
| 4 | **D6** smoke checks for 03 and 04, CONTEXT.md, `/about`, Organizer guide, maintainers guide | `scripts/smoke.ts`, `CONTEXT.md`, `src/lib/about.ts`, `src/components/organizer-guide.tsx`, `docs/maintainers-guide.md` | direct |

Isolation: waves 1, 2 and 4 are single workers on the direct checkout. Wave 3 uses three worktrees under `.claude/worktrees/hardening-b/war-weeker/` because the three run at once; predicted ownership is disjoint (above). D6 is serialized after wave 3 because D3 and D6 would both append checks to `scripts/smoke.ts` and register them in `main()`; D3 therefore makes no smoke change. Both predictions are re-checked at closeout against the real diffs.

D3 and D5 both touch the mutation/action boundary: D3 wraps the *action* bodies, D5 changes *mutation* bodies. D5's migration is generated after D1's in the same set (journal order), so only D5 runs `db:generate` in wave 3.

## Verification map

Evidence root `test-results/` (cleared 2026-09-26; committed on the branch, per `docs/agents/testing.md`). Environment: local Postgres from `docker compose` on port 2345; CI's service for E-AC2.

| Criterion | Command / action | Real dependency | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| 03-AC1 `can` per family × actor | `pnpm test -- src/lib/access.test.ts` | none (pure) | every row in the family table passes | `hardening-b-d2/test.txt` | after D2 | `src/lib/access*` |
| 03-AC2 create for A can't write B | `pnpm smoke` check "warWeekId beats admin_edition cookie" | local Postgres, built app | A gains the row, B unchanged | `hardening-b-smoke/smoke.txt` | after D6 | any action or auth change |
| 03-AC3 CONTEXT.md rewritten | `grep -n "Changing\|organizerEmails" CONTEXT.md` empty; Access and lifecycle sections name Organizer and Host | none | as stated | `hardening-b-docs/grep.txt` | after D6 | CONTEXT.md |
| 03-AC4 about, guide, maintainers | `grep -n Host src/lib/about.ts src/components/organizer-guide.tsx docs/maintainers-guide.md` | none | each names Hosts | `hardening-b-docs/grep.txt` | after D6 | those files |
| 03-AC5 gate; Host refused outside their Competition | `pnpm gate`; smoke check "Host refused on another Competition" | local Postgres, built app | gate green; refusal message | `hardening-b-gate/gate.txt`, `hardening-b-smoke/smoke.txt` | after D6 | any change |
| S-MIG migration copy | `pnpm test -- src/db/migration-copy.test.ts` | local Postgres superuser (scratch DB) | exact `organizer` rows per spec 2a | `hardening-b-d1/test.txt` | after D1 | `drizzle/`, copy step |
| S-LOCK last Organizer | `pnpm test -- src/mutations/organizers.test.ts` | local Postgres, two connections | one Organizer left; second refused | `hardening-b-d1/test.txt` | after D1 | `src/mutations/organizers.ts` |
| S-HOST Host setup save can't change Hosts | `pnpm test -- src/mutations/setup.test.ts` | local Postgres | `competition_host` unchanged | `hardening-b-d2/test.txt` | after D2 | setup action/parser |
| S-ORDER order of checks | `pnpm smoke` check "malformed input gets the access refusal" | built app | access refusal, never validation | `hardening-b-smoke/smoke.txt` | after D6 | any action |
| S-FORMER former Host refused | `pnpm smoke` check "removed Host refused" | built app | refusal | `hardening-b-smoke/smoke.txt` | after D6 | actor loading |
| S-PROD production prerequisite | **Human gate**, announced: before the `staging` → `main` merge Paul confirms the current edition's `organizer_emails` and takes a Neon backup; post-check: Migrate run green, `/` and `/admin` load, `organizer` rows match | production | as stated | recorded on ticket 03 at that time | after this PR merges to `staging` (outside this PR) | production data |
| 04-AC1 thrown mutation error → result | `pnpm test -- src/actions` | none (mutation stubbed to throw) | `{ ok:false, error }` per family | `hardening-b-d3/test.txt` | after D3 | `src/actions/*` |
| 04-AC2 parsers don't throw | `pnpm test -- src/lib` | none | error result for `{}` and wrong types | `hardening-b-d3/test.txt` | after D3 | parsers |
| 04-AC3 error boundary | `pnpm smoke` check "forced error shows the boundary" | built app | boundary copy, not Next's screen | `hardening-b-smoke/smoke.txt` | after D6 | `error.tsx` files |
| 04-AC4 / 08-AC3 / 10-AC4 / E-AC3 gate | `pnpm gate` | local Postgres | green | `hardening-b-gate/gate.txt` | after D6 | any change |
| 08-AC1 origin list | `pnpm test -- src/auth` | none | production: base only; preview: exactly two hosts | `hardening-b-d4/test.txt` | after D4 | `src/auth/*` |
| 08-AC2 preview sign-in | **Human gate**, announced: after push, Paul signs in on the PR's preview alias; post-check: his report, and the ticket records any OAuth redirect-URI change | Vercel preview, Google OAuth | sign-in succeeds or the ticket records the change | ticket 08 comment | after push | `src/auth/server.ts` |
| 10-AC1 races | `pnpm test -- src/mutations` (two-connection tests) | local Postgres | outcomes named in ticket 10 | `hardening-b-d5/test.txt` | after D5 | `src/mutations/*` |
| 10-AC2 ledger tie-break | `pnpm test -- src/lib/competitions.test.ts` | none | stable order for equal `enteredAt` | `hardening-b-d5/test.txt` | after D5 | `src/lib/competitions.ts` |
| 10-AC3 migration applies; smoke | `pnpm smoke` | local Postgres | migrate step and smoke green | `hardening-b-smoke/smoke.txt` | after D6 | `drizzle/` |
| E-AC1 tickets done with closeout | `grep -n Status .scratch/hardening/issues/{03,04,08,10}-*.md` | none | all `done` | ticket files | closeout | ticket files |
| E-AC2 CI smoke on the PR | `gh run list --branch feat/03-roles-and-access` | GitHub CI | CI green on the PR head | `hardening-b-ci/runs.md` | after push | any change |

## Human gates

- **S-PROD** (announced for later): prerequisite is this PR merged and verified on staging. Raised with the `staging` → `main` PR, not here.
- **08-AC2** (announced for later): prerequisite is the pushed branch's preview deployment. Raised at closeout.

No gate is actionable before dispatch.

## Progress

- 2026-09-26: plan recorded; wave 1 dispatch next.

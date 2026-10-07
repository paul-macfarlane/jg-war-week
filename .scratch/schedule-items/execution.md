# Execution: Schedule items (Epic R25)

Contract: [`spec.md`](./spec.md) (stable; not rewritten here). Branch
`feat/r25-schedule-items` off `staging` at `15114169` (R26 and the red-teamed
spec merged), in the worktree
`.claude/worktrees/r25-schedule-items/war-weeker`.

## [EXECUTION PLAN]

Run surface: **local + deployed**. Everything is proven locally; the deployed
part is the human reseed after merge (DoD8), outside this PR.

### Structure: sequential, two deliverables

| ID | Spec decisions | Deliverable | Depends on | Model |
|---|---|---|---|---|
| D1 | 1 (storage, roster, display-only, with a Competition), 2, 3 (server and seed), 5 | Data and server: migration 0035, `schedule_item_host`, nullable start time through every reader, Hosts saved by the mutation (roster check; discarded and cleared with a Competition), category rule in the shared schema, seeds and loader, the role and migration tests, smoke Host role check, `CONTEXT.md` | — | opus |
| D2 | 1 (form, "Hosted by"), 2 (UI), 3 (form), 4 | Form and Schedule UI: Category before Competition, conditional Competition with title fill, Host `ParticipantPicker`, optional start time, aligned Day / Start / End, "Hosted by" with avatars, "Any time" on both pages, the R25 e2e spec, the picker-leak smoke on both Schedule pages, maintainer's guide, regression checklist, `/about` | D1 | sonnet |

Why sequential: the schema change breaks the type of every Schedule item
reader, so D1 must land whole before any UI work compiles against it. D2 then
owns one behavior end to end (form, display, e2e, smoke, docs). There is no
parallel slice worth a second worktree: D2's files (`schedule-item-form.tsx`,
`schedule-item.tsx`, `schedule-items-editor.tsx`, the two Schedule pages,
`scripts/smoke/pickers.ts`) are the same files D1 must touch minimally to keep
the build green.

Isolation: one worktree, workers run one after the other in it, against the
database `war_weeker_r25` on the local Docker Postgres (port 2345), with
`SMOKE_PORT=3125` and `E2E_PORT=3225` so another checkout's smoke or e2e can't
collide. No `.env.local`: every command takes the CI-style env on the command
line:

```
DATABASE_URL='postgres://postgres:postgres@localhost:2345/war_weeker_r25?sslmode=disable' DATABASE_DRIVER=pg SMOKE_PORT=3125 E2E_PORT=3225
```

### Verification map

Evidence root `test-results/` (cleared once before the final run, then
committed). Captured output under `test-results/r25/`, vitest output under
`test-results/vitest/` (the spec names it), screenshots under
`test-results/e2e/<test>/`. AC numbers follow the spec's acceptance criteria
in order; DoD numbers its Definition of Done in order.

| Criterion | Command / action | Surface | Real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|---|
| AC1 | `e2e/regression-r25-schedule-items.spec.ts` (Hosts test, 1440 and 390) | Chromium, prod build | Postgres | two Hosts picked by name; "Hosted by" both with one avatar each; item deleted after | `test-results/e2e/regression-r25-*` | after D2 | form, schedule-item display, picker |
| AC2 | `pnpm test src/mutations/setup-schedule-faq.test.ts` | vitest | Postgres | Host from another War Week refused | `test-results/vitest/vitest.txt` | after D1 | mutation |
| AC3 | e2e (linked item: no Host field, Competition's Hosts shown; adds and removes Competition Hosts); mutation vitest (discard + clear on link); loader vitest (reload linking clears) | Chromium + vitest | Postgres | as spec | screenshots; `vitest.txt` | vitest after D1; e2e after D2 | mutation, loader, form, display |
| AC4 | `pnpm test src/queries/organizers.test.ts`; `pnpm smoke` Schedule-item-only Host refused | vitest + smoke | Postgres, prod build | no hosted Competitions; admin Competition page refused | `vitest.txt`; `test-results/r25/smoke.txt` | after D1 | actor/organizers query, smoke hosts |
| AC5 | `pnpm smoke` picker-leak on `/admin/schedule` and `/xi/schedule` with marker Hosts rendered | smoke | Postgres, prod build | no email in HTML or RSC; both marker names appear | `test-results/r25/smoke.txt` | after D2 | display, smoke pickers |
| AC6 | `pnpm test src/lib/schedule.test.ts` (or the existing schedule lib test); e2e untimed item | vitest + Chromium | Postgres for e2e | "Any time", sorts first, never Now/Next | `vitest.txt`; screenshots | vitest after D1; e2e after D2 | schedule lib, display |
| AC7 | `pnpm test src/lib/setup-schedule-faq.test.ts` | vitest | — | "Add a start time first." | `vitest.txt` | after D1 | setup schema |
| AC8 | mutation vitest (untimed duplicate wording); `src/db/migrations.test.ts` 0035 raw duplicate insert refused | vitest | Postgres | refused both ways | `vitest.txt` | after D1 | mutation, migration |
| AC9 | `pnpm test src/seed/load.test.ts` (untimed reload keeps id and Host) | vitest | Postgres | same id, same Host | `vitest.txt` | after D1 | loader |
| AC10 | `pnpm test src/db/migrations.test.ts` (0035 over populated rows) | vitest | Postgres | rows survive with start_time; `host` gone | `vitest.txt` | after D1 | migration |
| AC11 | e2e (field only for Competition, clears, fills title); vitest on setup schema and seed schema (refusal) | Chromium + vitest | Postgres for e2e | as spec | screenshots; `vitest.txt` | vitest after D1; e2e after D2 | form, schemas |
| AC12 | e2e bounding boxes of Day / Start / End controls equal within 1px at 1440 and 390 | Chromium | Postgres | match | screenshots + spec output | after D2 | form layout |
| AC13 | `pnpm test src/seed/schema.test.ts src/seed/seeds.test.ts` | vitest | — | untimed loads; `host`/`hosts` refused; no seed has them | `vitest.txt` | after D1 | seed schema, seeds |
| AC14 | e2e: untimed item on `/admin/schedule` reads "Any time" | Chromium | Postgres | text present | screenshots | after D2 | admin schedule list |
| AC15 | full `pnpm test` with the CI env; captured | vitest | Postgres | DB suites listed as passed, none skipped | `test-results/vitest/vitest.txt` | integrated | any test or code change |
| DoD1 | red-team record in spec | file | — | passed 2026-10-06 | spec | done | — |
| DoD2 | `git merge-base --is-ancestor 21517b70 HEAD` (R26 merge) | git | — | ancestor | `test-results/r25/gate.txt` header | now | rebase |
| DoD3 | migration and seeds in the same branch; `pnpm smoke` | smoke | Postgres | green | `test-results/r25/smoke.txt` | after D1 | migration, seeds |
| DoD4 | read `CONTEXT.md` diff for the four named lines | file review | — | all four updated | review | after D1 | CONTEXT.md |
| DoD5 | read maintainers guide, regression checklist (Schedule lines, both viewports), `/about` diff | file review | — | updated where affected | review | after D2 | docs |
| DoD6 | full `pnpm e2e` after clearing `test-results/` | Chromium | Postgres | screenshots committed | `test-results/e2e/` | integrated | any code change |
| DoD7 | `pnpm format:check && pnpm gate`; CI on the PR | local + GitHub CI | Postgres | green | `test-results/r25/gate.txt`; PR checks | integrated / PR | any change |
| DoD8 | human: Seed workflow per environment after merge; post-check `/xi/schedule` loads with no "Hosted by" | deployed | staging, production | succeeds | Paul's run + check | after merge (outside this PR) | — |

Human gates: none actionable before dispatch (Docker Postgres is up). DoD8 is
announced for later: it needs the merged migration deployed, so it is Paul's
step after he merges; this PR cannot prove it.

## [PROGRESS]

## [SCOPE CHANGE]

## [AI CODE REVIEW]

## [CLOSEOUT]

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

- D1 (opus, `4041ccb4`): migration 0035, `schedule_item_host`, nullable start
  time, Hosts in the mutation and queries, category rule, seeds and loader,
  role and migration tests, smoke Host role check, `CONTEXT.md`. Accepted.
- D2 (sonnet, `3615eae8`): form (Category first, conditional Competition,
  title fill, Hosts picker, optional start), "Hosted by" with Avatars, "Any
  time", R25 e2e spec, picker-leak smoke on both Schedule pages, docs.
  Accepted.
- First gate at `3615eae8`: unit 4162 passed, smoke green, e2e 215 of 216.
  The failure was R26's `/about` 1440-light test waiting on a cold
  `next/image` resize (`naturalWidth` 0 after 20s); the spec passed 8 of 8
  alone. It isn't an R25 change.
- D3 (sonnet, `dd9db38a`): the aggregate review fixes below. Accepted.
- Orchestrator fix `89d91c69`: the approved phone layout (see [SCOPE CHANGE]).

## [SCOPE CHANGE]

- **Decision 4 / AC12 at 390** (approved by Paul, 2026-10-07): the aggregate
  review (F1) held the form to one row at every width. Built that way, each
  time control at 390 showed about 66px of a 93px "10:30 AM" (clipped) and its
  list wrapped. Paul chose: on a phone, Day on its own row and Start time and
  End time sharing the next, aligned; one row from `sm` up. The spec's
  Decision 4 and AC12 carry the amendment; AC12's e2e asserts it and that a
  picked time isn't clipped.

## [AI CODE REVIEW]

Two fresh reviewers (opus) read `15114169..3615eae8`; the orchestrator
adjudicated each finding.

**Technical implementation and spec conformity**

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F1 | Day / Start / End stacked at 390, against Decision 4 and AC12 | blocking | One row tried in D3 clipped the times; Paul approved Day above and paired times on a phone (`89d91c69`, spec amended) |
| F2 | R25 evidence not yet committed | blocking | Resolved by the final run, committed with the closeout |
| F3 | `CONTEXT.md` said a Host edits linked Schedule Items | non-blocking | Fixed (D3) |
| F4 | `testing.md` smoke row run-on, AC4 check missing | non-blocking | Fixed (D3) |
| F5 | Organizer guide "Hosts … it doesn't" | non-blocking | Fixed (D3) |
| F6 | A Participant deleted between the roster check and the insert threw (FK 23503) | non-blocking | Mapped to the roster refusal (D3); no deterministic test without a mock, so none |
| F7 | e2e "sorts first" could pass on a Day with only the untimed item | non-blocking | Now asserts a timed item follows (D3) |
| F8 | The no-Host-role vitest relies on its second half | non-blocking | Informational; conforms |
| F9 | No e2e for editing an already-linked item | non-blocking | Added (D3) |

Conformity: Decisions 1, 2, 3 and 5, the Schema change section and out of
scope conform; Decision 4 conforms as amended.

**Coding standards**

| # | Finding | Disposition |
|---|---|---|
| S1 | `testing.md` R25 text spliced without sentence breaks | Fixed (D3) |
| S2 | Organizer guide number agreement | Fixed (D3) |
| S3 | Visible time labels differed from the error labels; a `-mt-2` override | Labels are "Start time" / "End time" again, the note moved to the helper line, override removed (D3) |
| S4 | Host ids deduplicated twice | Once, in the schema (D3) |
| S5 | Roster check and refusal copied from Competition Hosts | One shared `onWarWeekRoster` and `HOST_NOT_ON_ROSTER` (D3) |
| S6 | Two grouping helpers in `queries/schedule.ts` | One `groupBy` (D3) |
| S7 | Smoke deleted rows the cascade removes | Dropped (D3) |
| S8 | Smoke marker name rebuilt inline | One `markerName` (D3) |
| S9 | A Competition id used as a Host id in a fixture | Participant constant (D3) |
| S10 | Unused e2e helper parameter | Removed (D3) |
| S11 | `/about` "every item on the ET clock" | "every timed item on the ET clock, and the rest marked Any time" (D3) |

All severities non-blocking. No unresolved blocking finding.

## [CLOSEOUT]

PR: _(added below once opened)_ (into `staging`).

| Deliverable | Worker model | Commit |
|---|---|---|
| D1 data, server rules, seeds | opus | 4041ccb4 |
| D2 form and Schedule UI | sonnet | 3615eae8 |
| D3 review fixes | sonnet | dd9db38a |
| Phone layout (approved amendment) | orchestrator | 89d91c69 |

Verified run command (integrated head 89d91c69, local Docker Postgres,
database `war_weeker_r25`, CI env `DATABASE_URL` + `DATABASE_DRIVER=pg`,
`SMOKE_PORT=3125`, `E2E_PORT=3225`): `pnpm format:check && pnpm gate`, exit 0
(typecheck, lint 0 errors, 4162 unit tests, build, smoke 366 ok, e2e 217
passed). `test-results/` was cleared first and regenerated; `pnpm exec vitest
run --reporter=verbose` captured to `test-results/vitest/vitest.txt` (210 files,
4162 tests passed, none skipped).

| Criterion | Verdict | Evidence |
|---|---|---|
| AC1 | PASS | `test-results/e2e/regression-r25-schedule-it-*-with-an-avatar-each-at-{1440,390}-*` |
| AC2 | PASS | `test-results/vitest/vitest.txt` (refuses a Host from another War Week's roster) |
| AC3 | PASS | e2e `regression-r25-*-the-form-has-no-Host-field-*` and the edit-linked test; vitest discard/clear (mutation) and reload-links (loader) |
| AC4 | PASS | `vitest.txt` (`getHostedCompetitions` … no Host role); `test-results/r25/gate.txt` smoke "a Participant who hosts only a Schedule Item shows the refusal" |
| AC5 | PASS | `gate.txt` smoke: both marker Hosts' names show on `/xi/schedule`; no roster email on `/xi/schedule` or `/admin/schedule` |
| AC6 | PASS | `vitest.txt` (`schedule.test.ts` untimed: Any time, sorts first, never Now or Next); e2e `regression-r25-*-both-pages-and-sorts-first-*` |
| AC7 | PASS | `vitest.txt` ("Add a start time first.") |
| AC8 | PASS | `vitest.txt` (untimed duplicate wording; 0035 raw insert refused) |
| AC9 | PASS | `vitest.txt` (keeps an untimed item on reload: same id, its Host) |
| AC10 | PASS | `vitest.txt` (`schedule items (0035)`) |
| AC11 | PASS | e2e `regression-r25-*-fills-an-empty-title-*`; vitest setup and seed schema refusals |
| AC12 | PASS (as amended) | e2e `regression-r25-*-line-up-at-{1440,390}-*`: one row at 1440; Day above paired times at 390; picked times not clipped |
| AC13 | PASS | `vitest.txt` (seed schema: untimed accepted, `host`/`hosts` refused; no seed has them) |
| AC14 | PASS | e2e `regression-r25-*-both-pages-and-sorts-first-*` (`/admin/schedule` reads Any time) |
| AC15 | PASS | `test-results/vitest/vitest.txt`: every DB-backed R25 test listed ✓, 0 skipped |
| DoD1 | PASS | spec red-team record (2026-10-06) |
| DoD2 | PASS | `gate.txt` header: R26 merge 21517b70 is an ancestor |
| DoD3 | PASS | migration 0035 and seeds in one branch; `gate.txt` smoke |
| DoD4 | PASS | `CONTEXT.md`: Host entry, untimed Schedule Item and Now/Next, natural key nulls not distinct, seed entry corrected (and the stale Host-edits line, F3) |
| DoD5 | PASS | maintainers guide, regression checklist (Schedule lines at both viewports), `/about` copy (S11); no `/about` still shows the form or a Hosted item |
| DoD6 | PASS | `test-results/e2e/` regenerated and committed |
| DoD7 | PASS locally; PR CI runs on the PR | `test-results/r25/gate.txt` |
| DoD8 | Pending (human, after merge) | Paul: after the merge's Vercel build applies 0035, run the Seed workflow for staging and production; check each `/xi/schedule` loads with no "Hosted by" |

Deviations: Decision 4 / AC12 at phone width (approved, see [SCOPE CHANGE]).
Deployed smoke: DoD8 is the human step above.

Isolation re-check: sequential was chosen because D1's schema change breaks
every Schedule Item reader's types. Real diffs: D1 and D2 both edited
`src/components/schedule-item-form.tsx`, `src/components/schedule-item.tsx` and
`src/app/admin/schedule/page.tsx`, so a parallel D2 would have collided; the
prediction held.

First gate note: R26's `e2e/regression-r26-about.spec.ts` failed once at 1440
light on a cold `next/image` resize and passed 8 of 8 alone and in the final
gate; it is R26's test and was left unchanged.

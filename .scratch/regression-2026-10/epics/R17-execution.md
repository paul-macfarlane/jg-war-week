# Execution record: Epic R17, Brackets

Contract: [`R17-brackets.md`](./R17-brackets.md) (one work package) and its parts
[`97`](../issues/97-one-bracket-format.md), [`99`](../issues/99-remove-seeding-forfeit-time-and-place.md),
[`98`](../issues/98-third-place-game.md), [`100`](../issues/100-one-bracket-tree.md),
with the decisions in each and `../grilling-2026-10-03.md`.
No `/atlas-plan` ran. On 2026-10-03, `/atlas-implement` derived this plan against `staging` at `8ceb8f3` (PR #126 R16 and PR #127 red-team merged).
Red-team: required; pass 1 resolved in the epic.
Branch: `feat/regression-r17-brackets`.

## [EXECUTION PLAN]

2026-10-03.

### Run record

- Work package `regression-r17`; branch from `staging` at `8ceb8f3`, the review comparison point.
- Structure: **sequential**, direct checkout. The epic makes the Bracket files serial (one owner at a time, part order 97 → 99 → 98 → 100), and nearly every deliverable touches them (`src/lib/bracket/*`, `src/mutations/brackets.ts`, `src/actions/brackets.ts`, `bracket-builder.tsx`, `heat-result-form.tsx`, `bracket-tree.tsx`, `bracket-view.tsx`, `e2e/bracket*.spec.ts`), so no two run in parallel and no worktrees are made.
  - **D1 — schema and the one migration.** Every schema change in the epic's table goes into `src/db/schema.ts` / `src/lib/enums.ts` at once; `script -q /dev/null pnpm db:generate` once, answering create; the SQL hand-edited in the epic's six steps into `drizzle/0029_*.sql`; the epic's migration test on old rows in `src/db/migrations.test.ts`; the local database migrated. The app need not typecheck after D1.
  - **D97 — one Bracket Format** (part 97 whole): Format `bracket`, `bracket_config` never null (2/1/false default), the engine dispatch in one place in `src/lib/bracket/`, `placementLimit`, builder's one Format option with heat size / advancing and the "Head-to-head (single elimination)" preset, seed schema (`bracket` with required config, old names refused, the renamed seed-schema test), seed JSON conversion (demo XII Chess Heats and every seed), MCP Format naming. May leave typecheck red only where 99 removes things (Heat time and place, Forfeit, Standings seeding).
  - **D99 — removals and `recorded_at`** (part 99 whole): Standings seeding, Forfeit, Time & place with every reader listed in 99, `recorded_at` set and cleared, the schedule test, the e2e specs rewritten (not run). Typecheck, lint and unit green at the end.
  - **D98 — 3rd place game; places up to 4th** (part 98 whole): the switch, server refusals and lock, `loser_to_*` and the `third_place` Heat at Generate, places and points, every "final" reader, `BRACKET_PLACEMENTS = 4`, the e2e spec written (not run).
  - **D100 — one tree** (part 100 whole): record from the tree for whoever may record, `bracket-results.tsx` and its tests deleted, no List toggle, the tree scrolls in its own container, the e2e specs written (not run); the Postgres action refusal test.
  - **DE — smoke and e2e** on the integrated branch: build once; smoke's MCP and Bracket checks updated; run full smoke and e2e serially (port 3200 and the shared local database); fix test-side defects, report product defects to the orchestrator.
  - **DX — docs:** `CONTEXT.md`, `/about` copy and stills, `docs/maintainers-guide.md` (including the reset), `docs/regression-checklist.md`, `docs/agents/testing.md`'s smoke and e2e rows.
  - Then the aggregate review, `pnpm format:check && pnpm gate` on the integrated commit, closeouts and the PR.
  - Edges: D1 → D97 → D99 → D98 → D100 → DE → DX → gate.
- Workers run `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` with `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg` (local Postgres container `war-weeker-postgres`). Postgres test files must run, not skip.
- Proof-artifact root `test-results`: the prior work package's `test-results/r16/`, the stale `test-results/r10-accounts/` and `test-results/e2e/` are removed in the claim commit; the gate regenerates `test-results/e2e/`, DX regenerates `test-results/about-media/`. R17 evidence: `test-results/r17/` (vitest summary with skipped count, gate log) and `test-results/e2e/<test>/`.

### Resolved decisions

- **Migration:** one `drizzle/0029_*.sql`, owned by D1. A later schema need comes back to the orchestrator, which amends 0029 serially (regenerate from the 0028 snapshot and reapply the hand edits), never adds 0030.
- **Engine names stay internal:** the single-elimination and Heats engines keep their module and function names; only the Format value, config, UI, copy, MCP and seeds say Bracket.
- **Interim state:** between D1 and D99, code that reads dropped columns may not compile; D99 ends with the build checks green.

### Verification map

| Criterion | Command / action | Surface | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| E1 migration on old rows | `pnpm test src/db/migrations.test.ts` | vitest, local Postgres, throwaway DB | commits; both `bracket`; configs {2,1,false}, {4,2,false}; no Heats, generated entries or `finalized_at`; 4 Placement Points | `test-results/r17/vitest.txt` (ran, not skipped) | after D1 | `drizzle/`, `schema.ts` |
| E2 seeds load twice | `pnpm test src/seed/seed-sets.test.ts` | vitest, Postgres | row counts unchanged on second load | `test-results/r17/vitest.txt` | after D97 | `seeds/`, `src/seed/`, `drizzle/` |
| E3 Format grep | epic's `grep … src/lib/enums.ts src/seed/schema.ts seeds` | repo | no hits | closeout | after D97 | those files |
| E4 skip grep | `git diff 8ceb8f3 -- e2e src scripts \| grep …` | repo | no hits | closeout | before gate | any test change |
| E5 MCP | `pnpm test src/mcp`; smoke MCP check on Chess Heats | vitest + smoke | Bracket with heat size, advancing, 3rd place game; no Heat time/place/Forfeit; `recordedAt`; 3rd place marked; champion = final's winner; no `@` | `test-results/r17/gate.log` | after DE | `src/mcp/`, smoke |
| E6 testing.md rows | review | repo | smoke and e2e rows describe the rewritten flows | DX commit | after DX | later flow change |
| E7 showcase | review `/about`, stills, guide, checklist | repo | updated; reset described | DX commit | after DX | later UI change |
| E8 CONTEXT | review `CONTEXT.md` | repo | Bracket terms; retired terms | DX commit | after DX | — |
| E9 closeouts | part files and epic | repo | closeouts, `done`, PR URL | closeout commit | closeout | — |
| E10 PR step | PR body | GitHub | reset listed as Paul's post-merge step | PR | closeout | — |
| E11 gate | `pnpm format:check && pnpm gate`; PR CI | local + CI | exit 0; CI green | `test-results/r17/gate.log` | before PR | any change |
| P97-engines, P97-dispatch | `pnpm test src/lib/bracket` | vitest | engine tests through `bracket` at 2/1 and 4/2; dispatch picks single-elim for 2/1 only | gate log | after D97 | `src/lib/bracket/` |
| P97-builder | `pnpm test src/components/bracket-builder.test.tsx`; E3 grep | vitest | one Bracket option, heat size / advancing, preset label | gate log | after D97 | builder |
| P99-grep | part 99's two greps | repo | no hits | closeout | after D99 | any change |
| P99-recorded | `pnpm test` (Postgres mutation tests) | vitest, Postgres | `recorded_at` set on Organizer save, self-report, edit; cleared by Reset and forced regenerate | gate log | after D99 | `src/mutations/brackets.ts` |
| P99-schedule | `pnpm test src/queries/schedule.test.ts` | vitest, Postgres | no Heat in Schedule | gate log | after D99 | `src/queries/schedule.ts` |
| P99-e2e | `pnpm e2e` (bracket, heats, squads specs) | build, Postgres | flows without time / Forfeit; "Your next Heat" no time; "Recorded <time>" | `test-results/e2e/<test>/` | after DE | Bracket UI |
| P98-unit | `pnpm test src/lib/bracket` | vitest | places/points with and without; Heats final 1–4; 4 Entrants; refusals; final readers | gate log | after D98 | bracket lib |
| P98-pg | `pnpm test` (Postgres) | vitest, Postgres | toggle refused once a Heat Result exists | gate log | after D98 | mutations |
| P98-cap | `pnpm test` | vitest | over 4 refused with `placementLimitRefusal` | gate log | after D98 | `competitions.ts` |
| P98-e2e | `pnpm e2e` (3rd place spec) | build | 8 with 3rd place to Finalize; 10/7/5/3; 1440 shot | `test-results/e2e/<test>/` | after DE | Bracket UI |
| P100-record, P100-access | `pnpm e2e` (tree specs); Postgres action test | build + vitest | records from both trees; no List toggle; no button where not allowed; server refuses | `test-results/e2e/<test>/`, gate log | after DE | tree, access |
| P100-390 | `pnpm e2e` | build | container scrolls, page doesn't; shots 1440 and 390 | `test-results/e2e/<test>/` | after DE | tree layout |
| P100-axe | `pnpm e2e` | build | axe passes in both schemes | gate log | after DE | tree |
| P100-delete | `grep -rn 'Run results\|BracketResults' src e2e` | repo | no hits | closeout | after D100 | any change |

Human gates: none before or during delivery. **Announced for later (outside this work package):** the epic's reset of staging then prod (Seed workflow with reset; prod pre-check before the `staging` → `main` merge). It needs the merged PR, so it goes in the PR description as Paul's post-merge step (E10).

## [PROGRESS]

- 2026-10-03, D1 (Opus): `8715387`. `drizzle/0029_colossal_robin_chapel.sql`, generated once (under `expect`, answering create; `script` with piped input hung), then hand-edited. **Approved deviation:** the epic's step 4 (`bracket_config`) runs inside step 3, while `format` is text, because after the cast both old Formats are `bracket` and can't be told apart. Added `heat_loser_to_heat_id_idx` to mirror the winner index; `recorded_at` is `timestamp with time zone` like `finalized_at`. The R16 migration test now migrates to a copy stopping at 0028. Migration test: 3 passed, 0 skipped. Local DB at 0029.
- 2026-10-03, D97 (Sonnet): `11e0f33`. `engineFor(config)` in `src/lib/bracket/formats.ts` is the one dispatch; `BracketConfig` / `DEFAULT_BRACKET_CONFIG` / `configOf` in `config.ts`; builder one Format with the head-to-head preset; seed schema needs a full config; demo XII Chess Heats converted; `get_bracket` gains `heatSize`, `advancing`, `thirdPlaceGame`. `isHeadToHead(config)` is also read by tree/view for display labels (not engine choice). Typecheck red only in 99's areas (dropped Heat columns, Forfeit).
- 2026-10-03, D99 (Sonnet): `9591ced`. Standings seeding, Forfeit, Heat time & place removed (`heat-schedule-form.tsx`, `heat-schedule.ts`, `now-next.ts` deleted; Now/Next is Schedule Items only); `recorded_at` set in `saveBracket` for the recorded Heat (Organizer, Host, self-report share `writeHeatResult`), cleared on any Heat sent back to not played and by regenerate. Typecheck clean; vitest 182 files / 3761 tests passed; both 99 greps empty (rechecked by the orchestrator). e2e specs rewritten, not yet run. Carried to DX: `src/components/organizer-guide.tsx` copy still names By Standings, Forfeit, Time & place.
- 2026-10-03, D98 (Opus): `1281384`. The final is identified in one place, `src/lib/bracket/final.ts` (last-round Heat with `thirdPlace` false); engines, `isComplete`, `champion`, placings, MCP, tree/view, scripts updated. `BRACKET_PLACEMENTS = 4`. Finalize now needs `isComplete`. **Approved deviation:** Heat positions are 1-based in this codebase, so the final is position 1 and the 3rd place game position 2 (the contract's 0/1 assumed 0-based). Vitest 183 files / 3784 passed. `e2e/bracket-third-place.spec.ts` written, not yet run.
- 2026-10-03, D100 (Opus): `ad8916a`, `c6cc902`. One `BracketTree` for admin (`bracket-results.tsx` → `bracket-admin.tsx`, round cards gone) and Participants (no List toggle); `recordableHeatIds` / `onRecord` give a solid Record result (outline Edit when played) only where the viewer may record; tree scrolls in its own `Rounds` region; builder link renamed **Results**. Postgres action refusal test `src/actions/heat-reports-refusals.test.ts`. `organizer-guide.tsx` copy brought up to date. Vitest 184 files / 3797 passed. An Organizer or Host records from admin, not from the public page (no second submit path added).
- 2026-10-03, DE (Opus): `df1dcf1`, `56072bb`. Smoke's Bracket loop now builds a head-to-head Bracket with a 3rd place game and checks `get_bracket` (heat size, advancing, 3rd place game, `recordedAt` per played Heat, no time/place/Forfeit keys, one 3rd place game and one final, champion = final's winner, no `@`). Two test-side e2e fixes (`bracket-tree.spec.ts` button count with byes; `regression-r15-solid-buttons.spec.ts` card locator). No product fixes. Smoke 261 ok / 0 FAIL; e2e 108 passed, 0 failed, 0 skipped, 0 flaky. Smoke loads no seed with a Bracket, so the seeded Chess Heats MCP check goes to DX as a Postgres test.
- 2026-10-03, DX (Sonnet): `bffef1d`, `b78e57c`. `CONTEXT.md`, `docs/agents/testing.md` smoke and e2e cells, `docs/maintainers-guide.md` (Bracket section and "How R17 reached staging and production (the reset)"), `docs/regression-checklist.md`; `/about` copy needed no change, stills regenerated (5 changed). `src/mcp/bracket-seeded.test.ts` loads the `seed:demo:xii` set into a throwaway DB and checks `get_bracket` on Chess Heats (Bracket, 4/2/false, no `@`, no time/place/Forfeit). Vitest 185 files / 3798 passed.
- 2026-10-03, DR (Opus): `f9710cf`. Aggregate review fixes (below). Vitest 185 files / 3803 passed; the 8 affected e2e specs 18 passed.

## [AI CODE REVIEW]

2026-10-03. Diff `8ceb8f3..HEAD` (excluding `test-results/`, `public/`, `drizzle/meta/`). Two fresh Opus reviewers read one axis each; the orchestrator adjudicated every candidate against the cited hunks. All findings were resolved in `f9710cf`; none remain open.

### Axis 1: technical implementation and spec conformity

No defect in the migration, engine dispatch, final identification, loser links, `recorded_at` or server-side authorization. Verified against the contract: migration safety on old rows and its test; one dispatch `engineFor(config)`; the final identified only in `src/lib/bracket/final.ts` and read by both engines, `isComplete`, placings, Finale and MCP; loser links generated and cleared; places with and without the 3rd place game; cap of 4; `recorded_at` set on every save path and cleared on every reset; removals and greps; one tree with server authorization unchanged; MCP; seed conversion; backlog 25 untouched.

| ID | Severity | Paths | Finding | Disposition |
| --- | --- | --- | --- | --- |
| F1 | blocking | `src/mutations/brackets.ts`, `bracket-builder.tsx` | The 3rd place game could still be toggled after Heat Results through the force (clear and save) path; W2 says it can't be toggled once the Bracket starts. | Resolved: refused once any Heat Result exists, even with `force`; switch disabled with the reason; Postgres test with and without `force`; `CONTEXT.md` and guide agree. |
| F2 | non-blocking | `bracket-builder.tsx` | A saved 3rd place game outlived a drop below 4 Entrants and the disabled switch showed it off. | Resolved: the switch shows the saved value and can always be turned off; the reason says Generate needs 4 or the game off. |
| F3 | non-blocking | `src/lib/bracket/tree.ts`, `bracket-tree.tsx` | The 3rd place game's winner got the champion's " wins". | Resolved: " wins" only on the final; the 3rd place winner "takes 3rd". |
| F4 | non-blocking | `docs/maintainers-guide.md` | `get_bracket` described with Heat time and place. | Resolved. |
| F5 | non-blocking | `src/lib/setup.ts` | Seed schema accepted a 3rd place game off 2/1. | Resolved with `thirdPlaceRefusal`'s config half; seed test. |
| F6 | non-blocking | several | Stale retired-Format comments; admin page title "Bracket results". | Resolved. |
| F7 | — | `tree.ts`, `view.ts` | `isHeadToHead` read outside the dispatch. | No change: display only; no engine chosen outside `engineFor`. |

### Axis 2: coding standards

Clean: no skips added, retired tests deleted, no `cursor-*` or `disabled:pointer-events-none`, button variants per 87, dialogs and toasts through the app wrappers, failable assertions, seeded data restored, lint boundaries kept, no `.env` reads.

| ID | Severity | Paths | Finding | Disposition |
| --- | --- | --- | --- | --- |
| S1 | blocking | `src/components/organizer-guide.tsx` | The guide still said everyone else is placed by the Round they went out in. | Resolved: places only from the final and 3rd place game, up to 4th. |
| S2 | non-blocking | `docs/maintainers-guide.md` | Same as F4. | Resolved. |
| S3 | non-blocking | `README.md` | Single elimination / Heats Formats and timed Heats. | Resolved. |
| S4 | non-blocking | `CONTEXT.md` | "one of six" Formats; "a Heats Heat". | Resolved. |
| S5 | non-blocking | `src/lib/finale-slides.ts` | Forfeit comment. | Resolved. |
| S6 | non-blocking | lib comments, `bracket-tree.tsx`, e2e titles | Retired Format names; `heatsFormat` prop. | Resolved (`multiEntrant`; titles; lookups kept consistent). |
| S7 | non-blocking | `src/lib/bracket/view.ts` | Dead `heatEntrantLabels`. | Removed. |
| S8 | non-blocking | `bracket-builder.tsx` | Second copy of the 3rd place game rule. | Resolved: derived from `thirdPlaceRefusal`. |
| S9 | non-blocking | `bracket-builder.tsx` | Preset hand-rolled as an outline Button with `aria-pressed`. | Resolved: shadcn `Toggle`. |
| S10 | non-blocking | `bracket-builder.tsx` | Settings form key omitted `thirdPlaceGame`. | Resolved. |
| S11 | non-blocking | `bracket-tree.tsx` | Only `data-testid` in production source. | Removed; specs use the `Rounds` region. |
| S12 | non-blocking | `bracket-tree.test.tsx` | Redundant `toBeDefined()`. | Removed. |

Remaining risks: an Organizer or Host records from the admin tree, not from the public Competition page (no second submit path added, per "prefer removing to adding"); while a 3rd place game is on and a Heat Result exists, the heat size can't change either (follows the lock).

## [CLOSEOUT]

2026-10-03. Every criterion has a final, evidence-backed verdict against the integrated commit `f9710cf9` (plus this closeout commit, docs and evidence only). Commands were run with `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`.

- **Repository delivery:** `war-weeker`, branch `feat/regression-r17-brackets` from `staging` at `8ceb8f3`; direct checkout, no worktrees.
- **Deliverables:** D1 schema and migration (Opus, `8715387`); D97 one Bracket Format (Sonnet, `11e0f33`); D99 removals and `recorded_at` (Sonnet, `9591ced`); D98 3rd place game (Opus, `1281384`); D100 one tree (Opus, `ad8916a`, `c6cc902`); DE smoke and e2e (Opus, `df1dcf1`, `56072bb`); DX docs and the Chess Heats MCP test (Sonnet, `bffef1d`, `b78e57c`); DR review fixes (Opus, `f9710cf`). Orchestrator: Opus 5.5.
- **Isolation re-check:** sequential was chosen on predicted collisions in the shared Bracket files (`src/lib/bracket/*`, `src/mutations/brackets.ts`, `bracket-builder.tsx`, `bracket-tree.tsx`, `bracket-view.tsx`, `e2e/bracket*.spec.ts`). The real diffs confirm it: D97, D99, D98 and D100 each changed `src/mutations/brackets.ts`, `bracket-builder.tsx` and the bracket lib; D99, D98 and D100 each changed `e2e/bracket.spec.ts` and `bracket-tree.tsx`.
- **Approved deviations:** migration step 4 runs inside step 3 while `format` is text; Heat positions are 1-based (final 1, 3rd place game 2); the seeded Chess Heats MCP check is a Postgres vitest (`src/mcp/bracket-seeded.test.ts`) because smoke loads no seed with a Bracket, and smoke's own Bracket loop carries the `get_bracket` checks.
- **Verified run command:** `pnpm format:check && pnpm gate`, exit 0: vitest 185 files / 3803 tests passed, 0 skipped; smoke 261 ok, 0 FAIL; e2e 108 passed (4.2m), 0 failed, 0 skipped, 0 flaky. Log: `test-results/r17/gate.log`. Focused vitest (verbose, 40 files / 1234 tests, 0 skipped): `test-results/r17/vitest.txt`. No deploy in this work package.

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| E1 migration on old rows | PASS | `test-results/r17/vitest.txt` ("migrating populated pre-R17 Brackets…" ran and passed) |
| E2 seeds load twice | PASS | `test-results/r17/vitest.txt` (three `every seed loads twice` cases) |
| E3 Format grep | PASS | empty |
| E4 skip grep | PASS | `git diff 8ceb8f3 -- e2e src scripts \| grep …` empty |
| E5 MCP | PASS | `src/mcp/*.test.ts` incl. `bracket-seeded.test.ts` (vitest.txt); smoke bracket loop `get_bracket` check (gate.log) |
| E6 testing.md rows | PASS | `docs/agents/testing.md` smoke and e2e cells (`bffef1d`) |
| E7 showcase | PASS | `/about` copy unchanged (already says Bracket), stills regenerated, guide incl. the R17 reset, checklist (`bffef1d`, `f9710cf`) |
| E8 CONTEXT | PASS | `CONTEXT.md` (`bffef1d`, `f9710cf`) |
| E9 closeouts | PASS | this record, the epic and parts 97–100 `done` |
| E10 PR step | PASS | PR description lists the reset as Paul's post-merge step |
| E11 gate | PASS (local); CI on the PR pending | gate.log; CI reported on the PR |
| P97-engines, P97-dispatch, P97-builder | PASS | vitest.txt (`formats.test.ts`, engine tests, `bracket-builder.test.tsx`) |
| P99-grep | PASS | both greps empty |
| P99-recorded | PASS | vitest.txt (`Heat recorded_at` in `brackets.test.ts`, `heat-reports.test.ts`) |
| P99-schedule | PASS | vitest.txt (`schedule.test.ts`) |
| P99-e2e | PASS | gate.log; `test-results/e2e/bracket-a-Bracket-is-built-*` |
| P98-unit, P98-pg, P98-cap | PASS | vitest.txt (`third-place.test.ts`, `brackets.test.ts`, `competitions.test.ts`) |
| P98-e2e | PASS | `test-results/e2e/bracket-third-place-*/third-place-finalized-1440.png`; gate.log |
| P100-record, P100-access | PASS | `test-results/e2e/bracket-tree-*`; `src/actions/heat-reports-refusals.test.ts` (vitest.txt) |
| P100-390 | PASS | `test-results/e2e/bracket-tree-a-head-to-hea-*` (1440 and 390 shots) |
| P100-axe | PASS | `…/admin-knockout-axe-{light,dark}.json`, `participant-knockout-axe-{light,dark}.json` |
| P100-delete | PASS | grep empty |

**Human prerequisite (post-merge, Paul):** the epic's reset of staging, the prod pre-check, then prod (see the PR description and `docs/maintainers-guide.md`).

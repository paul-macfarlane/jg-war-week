# Epic A: Safety net and independent fixes

**What to build:** Every phase 1 ticket that doesn't wait on the roles work, delivered as one work package, one branch and one PR into `staging`.

**Tickets:** `02`, `06`, `05`, `07`, `09`, `15` (files under `../issues/`)

**Branch:** `fix/hardening-a-safety`

**Blocked by:** none (06's dependency on 02 is inside this epic: build 02 first)

**Status:** done

## Order and parallelism

1. `02` first. `06` needs its local-database guard before smoke runs in CI.
2. `05`, `07`, `09` and `15` touch separate areas (Competition mutation, bracket engine, UI, MCP access and docs), so they can run in parallel with `02` → `06`.
3. `15` and `02` both edit `scripts/smoke.ts`; merge them carefully.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [x] Each ticket file records its closeout and is set to `done` in this branch.
- [x] CI on the PR runs smoke and the drift check, and passes.
- [x] `pnpm gate` passes locally.

## Comments

**2026-09-26, Claude (atlas-implement) — [EXECUTION PLAN]**

Claimed: this epic and tickets 02, 05, 07, 09, 15 (`in-progress`). 06 is claimed when 02's deliverable is integrated, per this epic's own "build 02 first" rule. Branch `fix/hardening-a-safety` from `staging` @ `3d7ab8f`; one PR into `staging`.

*Structure: two waves.* Wave 1 runs D02, D05, D07, D09 and D15 in parallel, each in its own worktree under `.claude/worktrees/hardening-a-safety/`, because five workers share one `.next`, one Postgres and port 3100 otherwise. Workers run typecheck, lint, vitest and build; `pnpm smoke` runs only at integration in the main checkout, since it resets the shared local database. Wave 2 is D06 (CI) after D02 lands. Predicted overlaps: D02 and D15 both edit `scripts/smoke.ts` (hunks near line 30 and near line 4055); D05, D07 and D15 edit different sections of `CONTEXT.md`; D07 also edits `scripts/smoke.ts`'s Bracket loop. Expected to merge cleanly; re-checked at closeout.

| Deliverable | Ticket | Worker | Slice |
|---|---|---|---|
| D02 | 02 | sonnet | `isLocalDatabaseUrl` helper (`src/db/local-url.ts`), smoke guard before migrate, `seed:load --reset` refuses non-local without `--allow-remote-reset`, Seed workflow passes the flag, eight DB tests use the helper |
| D05 | 05 | sonnet | `updateCompetition` refuses scoring / Placement Points changes while `finalizedAt` is set ("Un-finalize the Bracket first."); mutation test; CONTEXT.md sentence |
| D07 | 07 | opus | Engine: a re-record that keeps the winner resets nothing; the reset list counts only Heats that had a result; one engine function feeds both `recordHeatResult` and the confirm copy; CONTEXT.md and the Organizer guide wording; smoke Bracket loop asserts the counts |
| D09 | 09 | opus | Archive contrast (with a per-seed contrast unit test), focus after deleting a setup row, the delete dialog's pending state, Videos count helper + test, disabled Switch label, Scoring select in free-for-all |
| D15 | 15 | sonnet | `MCP_PUBLIC` removed everywhere; README, `llms.txt`, spec front matter, `/about` and the maintainer's guide reframed; hackathon files removed; stale README evidence link fixed |
| D06 | 06 | sonnet | `ci.yml`: `workflow_dispatch`, `pnpm smoke` after build, drift check (`pnpm db:generate` then `git status --porcelain drizzle` must be empty) |

*Resolved decisions.* Flag name `--allow-remote-reset`. Local rule: `DATABASE_DRIVER !== "neon"` and host `localhost`, `127.0.0.1` or `[::1]`. 07 resets downstream only when the winner changes; the reported reset list holds only Heats that had a result. 09's axe evidence is gathered by the orchestrator in a browser against the smoke-seeded build. The proof root (`test-results/`) was cleared in the first commit of this branch; only this work package's evidence goes back in.

*Verification map* (run surface: local + GitHub Actions; evidence under `test-results/hardening-a-*/`, committed):

| Criterion | Proof | Earliest | Invalidated by |
|---|---|---|---|
| 02-AC1 smoke refuses remote URL before migrating | `DATABASE_URL=postgres://u:p@example.com/db pnpm smoke` → non-zero, message names the rule; `test-results/hardening-a-guards/` | D02 integrated | `scripts/smoke.ts`, `src/db/local-url.ts` |
| 02-AC2 `seed:load --reset` refuses remote URL without the flag | same URL, `pnpm seed:load --reset seeds/xi.json` → non-zero before any connection; helper unit test | D02 integrated | `scripts/seed-load.ts`, `src/db/local-url.ts` |
| 02-AC3 Seed workflow passes the flag | `grep allow-remote-reset .github/workflows/seed.yml`; local `pnpm seed:load --reset --allow-remote-reset seeds/xi.json` accepted | D02 integrated | `seed.yml`, `seed-load.ts` |
| 05-AC1/AC2 refusal while finalized, name saves | `pnpm test -- src/mutations/setup.test.ts` (local Postgres) | D05 integrated | `src/mutations/setup.ts`, `src/lib/setup.ts` |
| 05-AC3 CONTEXT.md sentence | `grep -n "Un-finalize" CONTEXT.md` | D05 integrated | `CONTEXT.md` |
| 06-AC1 / E-AC2 PR run passes smoke and drift | `gh run view <id>` on the PR run; candidate from a `workflow_dispatch` run on the branch head; `test-results/hardening-a-ci/runs.md` | PR opened (candidate: D06 integrated) | any commit |
| 06-AC2 drift step fails on a schema change without a migration | throwaway branch + `gh workflow run ci.yml --ref <branch>`; run URL in `runs.md` | D06 integrated (outward: pushes a throwaway branch) | `ci.yml` |
| 07-AC1 engine tests | `pnpm test -- src/lib/bracket/engine.test.ts` (three named tests) | D07 integrated | `src/lib/bracket/engine.ts` |
| 07-AC2 confirm copy count | the confirm copy and `recordHeatResult` share one engine function (review); smoke's Bracket loop asserts 0 reset on a same-winner edit and the decided-only count on a winner change | D07 integrated (smoke at gate) | engine, `bracket-results.tsx`, `mutations/brackets.ts` |
| 09-AC1 no axe contrast violations on `/history`, `/x`, `/i` | axe-core run in a browser against the built app with a signed-in session; JSON + screenshot per page in `test-results/hardening-a-axe/`; per-seed contrast unit test | D09 integrated + build | `archive.tsx`, seeds' themes, `globals.css` |
| 09-AC2 focus after deleting a setup row | browser check on `/admin/setup`; screenshot in `test-results/hardening-a-focus/` | D09 integrated + build | `setup-row.tsx`, editors |
| 09-AC3 Videos count includes embedded videos | `pnpm test -- src/lib/announcements.test.ts` | D09 integrated | `src/lib/announcements.ts` |
| 15-AC1 grep finds nothing outside ADRs/specs | `grep -riE "MCP_PUBLIC\|hackathon\|connection event\|submission" src scripts README.md docs` → `test-results/hardening-a-leftovers/grep.txt` | D15 integrated | any doc |
| 15-AC2 anonymous `POST /api/mcp` 401; token and session work | smoke `assertMcp` in the gate | gate | `proxy.ts`, `access.ts`, smoke |
| E-AC1 every ticket `done` with closeout | `grep -n "Status" .scratch/hardening/issues/{02,05,06,07,09,15}-*.md` | closeout | ticket files |
| E-AC3 / 02-AC4 / 05-AC4 / 07-AC3 / 09-AC4 / 15-AC3 `pnpm gate` | `pnpm gate` → `test-results/hardening-a-gate/gate.txt` | final wave integrated | any source change |
| DoD team rule: `/about` and maintainer's guide current | review of D15 + D07 diffs | review | — |

Human gates: none actionable now. Announced for later: pushing a throwaway branch for 06-AC2, and reading the PR's CI run for 06-AC1 after the PR opens.

**2026-09-26, Claude (atlas-implement) — [PROGRESS]**

- Wave 1 accepted and integrated: D02 `c625d98` (sonnet), D07 `f7020dc` (opus), D15 `d499032` (sonnet), D05 `f1bd839` (sonnet), D09 `926a1bb` (opus). D06 was written by the orchestrator in `e510a70` (only `ci.yml`, too small to delegate). All merges were clean. `scripts/smoke.ts` (D02, D07, D15) and `CONTEXT.md` (D05, D07, D15) auto-merged, as predicted.
- Orchestrator fix `e2ed4ee`: axe found the Archive card's "Original wiki page" footer link at 4.03–4.19:1, because it sits on `bg-muted/50`, not the card that D09's contrast test measured. The link now uses the foreground colour, and the test covers the footer surface.
- Found during integration: `pnpm gate` in the main checkout lints and tests any `.claude/worktrees/*` checkouts, so it only passes once the worker worktrees are removed. They were removed after acceptance.
- Found during integration: running `pnpm seed:load --reset` without an explicit local `DATABASE_URL` in the shell is now refused, meaning this machine's `.env.local` doesn't give a local database URL. That is the ticket 02 guard working. The gate runs used an explicit `DATABASE_URL` from `.env.example`.
- Candidate evidence: `test-results/hardening-a-guards/` (02), `hardening-a-axe/` (09-AC1: 0 violations on `/history`, `/x`, `/i` at desktop and phone widths), `hardening-a-focus/` (09-AC2), `hardening-a-gate/gate.txt` (gate on `88d1aeb`: 886 tests, 145 smoke ok; rerun at the end).

**2026-09-26, Claude (atlas-implement) — [AI CODE REVIEW]**

Diff `3d7ab8f..a15f74d`. Two fresh reviewers (opus), one per axis; the orchestrator adjudicated their findings.

*Technical implementation and spec conformity*

| # | Severity | Finding | Paths | Disposition |
|---|---|---|---|---|
| F1 | blocking | When the list empties, focus went to the add row's first input, but 09-AC2 names the Add button | `src/components/setup-row.tsx` | resolved `86b1af6` |
| F4 | blocking | A `?host=` / `?hostaddr=` query override bypassed the local-database guard (pg honours it) | `src/db/local-url.ts` | resolved `86b1af6`, with a test |
| F2 | non-blocking | Deleting the last row focuses the previous row; the AC names only "next" and "empty" | `src/lib/setup-row-focus.ts` | interpretation recorded |
| F3 | non-blocking | 09 re-themes the nav, hero and footer via `--primary-text`; accent text flips to black on 7 of 11 past themes | `src/lib/theme.ts`, `color.ts`, `globals.css`, nav, hero, footer | accepted: needed for `/x` and `/i` in AC1; XI unchanged |
| F8 | non-blocking | "the later Heats its old winner reached" is wrong when later Heats reset by cascade | CONTEXT, organizer guide, `mutations/brackets.ts`, engine test name | resolved `86b1af6` |
| F11 | non-blocking | The finalized refusal test didn't save a description | `src/mutations/setup.test.ts` | resolved `86b1af6` |
| F7 | non-blocking | The winner rule (first non-forfeit) is written in the engine, the mutation and the form; they agree today | `engine.ts`, `mutations/brackets.ts` | open → epic C ticket 11 |
| F5 | non-blocking | 22 legacy `scripts/*-evidence.ts` delete rows against any `DATABASE_URL`, with no guard | `scripts/*-evidence.ts` | open → follow-up task offered |
| F9 | non-blocking | The new smoke bracket assertions assume Red won its semifinal and a 4-Entrant Bracket | `scripts/smoke.ts` | open |
| F10 | non-blocking | An interactive `drizzle-kit` rename prompt could hang the drift step until the timeout | `.github/workflows/ci.yml` | open |
| F12 | non-blocking | `run()` never settles if the action throws (harmless: pending clears) | `src/components/setup-row.tsx` | open |

*Coding standards*

| # | Severity | Finding | Paths | Disposition |
|---|---|---|---|---|
| CS-06/07 (F6) | blocking | Team DoD rule: the maintainer's guide didn't cover 02's refusal, 06's CI steps or 05's refusal; nor did the organizer guide for 05 | `docs/maintainers-guide.md`, `organizer-guide.tsx` | resolved `86b1af6`. `/about` copy covers none of these, so it needed no change. |
| CS-05 | non-blocking | Stale doc comment on `HeatResultForm` | `bracket-results.tsx` | resolved `86b1af6` |
| CS-04 | non-blocking | Dead `"::1"` host entry; no doc comment on `isLocalDatabaseUrl`; the helper sits in `src/db/` | `src/db/local-url.ts` | resolved; the location stays (infrastructure, not domain) |
| CS-01 | non-blocking | Same as F7 | | open → ticket 11 |
| CS-02/03 | non-blocking | `readableOn` duplicates avatar's black/white pick; `contrastRatio` is re-exported from `theme.ts` | `color.ts`, `theme.ts`, `avatar.ts` | open → ticket 11 |
| CS-08/09 | non-blocking | Evidence gaps (15 grep, 06 runs); `gate.txt` held local paths | `test-results/` | resolved: evidence added; `gate.txt` has `$HOME` replaced with `~` |
| CS-10/11/12 | non-blocking | A renamed evidence file; `ADD_ROW` lives in lib; `text-foreground/NN` remains elsewhere | | accepted |

No blocking finding remains open.

**2026-09-26, Claude (atlas-implement) — [CLOSEOUT]**

One repository delivery: `war-weeker`, branch `fix/hardening-a-safety` from `staging` @ `3d7ab8f`. PR https://github.com/paul-macfarlane/jg-war-week/pull/78.

| Deliverable | Ticket | Worker / model | Commit |
|---|---|---|---|
| D02 | 02 | atlas-worker / sonnet | `c625d98` |
| D05 | 05 | atlas-worker / sonnet | `f1bd839` |
| D06 | 06 | orchestrator (opus), inline | `e510a70` |
| D07 | 07 | atlas-worker / opus | `f7020dc` |
| D09 | 09 | atlas-worker / opus | `926a1bb` |
| D15 | 15 | atlas-worker / sonnet | `d499032` |
| fixes | 09, 02, review | orchestrator | `e2ed4ee`, `86b1af6` |

The prediction that parallel work would collide in shared files was right, but no conflict materialized. `scripts/smoke.ts` was touched by D02 (the guard at the top of `main()`), D07 (the bracket loop, around line 3480) and D15 (lines 27–39). `CONTEXT.md` was touched by D05 (the last Bracket-rules bullet), D07 (the knockout bullet) and D15 (Access rules). All three deliverables in each file had separate hunks and merged automatically. Running the five in parallel worktrees was right; smoke ran only in the main checkout.

Verification (per `docs/agents/testing.md`; evidence committed under `test-results/`):

| Criterion | Verdict | Evidence |
|---|---|---|
| 02-AC1–AC3 | PASS | `hardening-a-guards/` (on `f73f2b3`) |
| 05-AC1–AC3 | PASS | `setup.test.ts` in the gate; CONTEXT.md |
| 06-AC1 | PASS | PR CI run https://github.com/paul-macfarlane/jg-war-week/actions/runs/36265877480 (head `f25d65d`: lint, format, typecheck, migrate, drift check, test, build, smoke all green; 0 smoke FAIL lines; job about 2 minutes) |
| 06-AC2 | PASS | `hardening-a-ci/runs.md` (run 36265647553, drift step failed) |
| 07-AC1–AC2 | PASS | engine tests plus the smoke bracket loop, in the gate |
| 09-AC1 | PASS | `hardening-a-axe/` |
| 09-AC2 | PASS | `hardening-a-focus/` (on `86b1af6`) |
| 09-AC3 | PASS | `announcements.test.ts` in the gate |
| 15-AC1 | PASS | `hardening-a-leftovers/grep.txt` |
| 15-AC2 | PASS | smoke MCP checks in the gate |
| Every ticket's gate AC, plus E-AC3 | PASS | `hardening-a-gate/gate.txt`: `pnpm gate` on `86b1af6`, 898 tests, 145 smoke ok. Command: `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable pnpm gate` |
| E-AC1 | PASS | tickets 02, 05, 06, 07, 09 and 15 are `done`, each with a closeout, in this commit |
| E-AC2 | PASS | PR CI run https://github.com/paul-macfarlane/jg-war-week/actions/runs/36265877480 (head `f25d65d`: lint, format, typecheck, migrate, drift check, test, build, smoke all green; 0 smoke FAIL lines; job about 2 minutes) (smoke and drift both green) |
| DoD: `/about` and maintainer's guide current | PASS | review F6 resolved; `/about` copy unaffected |

Deviations and interpretations: F2 and F3 above. Per Paul, root `about.md` and CLAUDE.md's "Post-hackathon" line stay. No deployed-target smoke: nothing is deployed until this PR merges into `staging`.

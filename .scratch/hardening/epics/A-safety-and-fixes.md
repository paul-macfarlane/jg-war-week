# Epic A: Safety net and independent fixes

**What to build:** Every phase 1 ticket that doesn't wait on the roles work, delivered as one work package, one branch and one PR into `staging`.

**Tickets:** `02`, `06`, `05`, `07`, `09`, `15` (files under `../issues/`)

**Branch:** `fix/hardening-a-safety`

**Blocked by:** none (06's dependency on 02 is inside this epic: build 02 first)

**Status:** in-progress

## Order and parallelism

1. `02` first. `06` needs its local-database guard before smoke runs in CI.
2. `05`, `07`, `09` and `15` touch separate areas (Competition mutation, bracket engine, UI, MCP access and docs), so they can run in parallel with `02` → `06`.
3. `15` and `02` both edit `scripts/smoke.ts`; merge them carefully.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and the drift check, and passes.
- [ ] `pnpm gate` passes locally.

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

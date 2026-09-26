# 06: Run smoke in CI

**What to build:** `.github/workflows/ci.yml` runs `pnpm smoke` against a Postgres service container, plus a migration drift check. Today smoke is the only coverage for actions and UI, and CI never runs it.

**Blocked by:** 02

**Status:** done

## Scope

- Add a Postgres service to the CI job (matching the version in `docker-compose.yml`) with a localhost `DATABASE_URL`. Use dummy auth secrets from `.env.example` names; never real ones.
- Drift check: `drizzle-kit generate` against the schema produces no new migration.
- Keep the job under about 10 minutes. If it's too slow, split smoke into its own job.

## Acceptance criteria

- [x] A PR run shows smoke passing in CI.
- [x] A deliberate schema change without a migration fails the drift step (tested on a throwaway branch; record the run URL here).

## Comments

**2026-09-26, Claude (atlas-implement, epic A) — [CLOSEOUT]** Written by the orchestrator in `e510a70` (only `.github/workflows/ci.yml`, too small to delegate). After `pnpm build` it runs `pnpm smoke` against the Postgres 17 service. A migration drift step after `db:migrate` fails when `pnpm db:generate` leaves `drizzle/` changed. The workflow also gets a `workflow_dispatch` trigger and a 15-minute job timeout.
- AC1 PASS: the PR's CI run https://github.com/paul-macfarlane/jg-war-week/actions/runs/36265877480 (head `f25d65d`: lint, format, typecheck, migrate, drift check, test, build, smoke all green; 0 smoke FAIL lines; job about 2 minutes), with smoke passing
- AC2 PASS: throwaway draft PR https://github.com/paul-macfarlane/jg-war-week/pull/77 (a column added with no migration). Run https://github.com/paul-macfarlane/jg-war-week/actions/runs/36265647553 failed at "Migration drift check" and named the missing `drizzle/0008_*` files. PR closed unmerged, branch deleted. `test-results/hardening-a-ci/runs.md`
- `workflow_dispatch` only becomes usable once this `ci.yml` reaches `main`, which is why the probe used a PR.
- PR: https://github.com/paul-macfarlane/jg-war-week/pull/78

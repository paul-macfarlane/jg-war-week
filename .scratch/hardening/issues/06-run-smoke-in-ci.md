# 06: Run smoke in CI

**What to build:** `.github/workflows/ci.yml` runs `pnpm smoke` against a Postgres service container, plus a migration drift check. Today smoke is the only coverage for actions and UI, and CI never runs it.

**Blocked by:** 02

**Status:** in-progress

## Scope

- Add a Postgres service to the CI job (matching the version in `docker-compose.yml`) with a localhost `DATABASE_URL`. Use dummy auth secrets from `.env.example` names; never real ones.
- Drift check: `drizzle-kit generate` against the schema produces no new migration.
- Keep the job under about 10 minutes. If it's too slow, split smoke into its own job.

## Acceptance criteria

- [ ] A PR run shows smoke passing in CI.
- [ ] A deliberate schema change without a migration fails the drift step (tested on a throwaway branch; record the run URL here).

## Comments

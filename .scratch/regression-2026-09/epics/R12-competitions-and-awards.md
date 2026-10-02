# Epic R12: Participation and Award Categories

**What to build:** A Participation Format that turns taking part into points, and Award Categories that carry across War Weeks with a "through the years" view.

**Tickets:** `69`, `70`, `71` (files under `../issues/`)

**Branch:** `feat/regression-r12-participation-awards`

**Blocked by:** R11 merged into `staging` (one schema-changing epic at a time).

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Red-team:** **required** (Drizzle schema change; a new Participant write).

**Source:** Paul's regression feedback, 2026-10-01; grilled the same day (`../grilling-2026-10-01.md`).

## Order

69 alone; 70 → 71.

## Acceptance criteria

Each ticket's own, plus:

- [ ] ADR for the check-in write; demo seed and migration together; smoke on seeded local Postgres.
- [ ] `/about`, `docs/maintainers-guide.md`, the regression checklist and MCP (`get_*` tools if Competitions or Awards are exposed) updated.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes; `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets `ready-for-agent`.

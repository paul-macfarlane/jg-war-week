# Epic R16: The Competition model

**What to build:** Points come from results. `points` becomes Placement (90); Discretionary points replace the Points page (91); Max Points goes (92); Head-to-head and Best score become Formats and ranked Games and Finish Points go (93); Participation follows scoring (94); Placement Points without a limit (95); seed conversion, the full gate and the staging/prod reset (96).

**Tickets:** `90`, `91`, `92`, `93`, `94`, `95`, `96` (files under `../issues/`)

**Branch:** `feat/regression-r16-competition-model`

**Blocked by:** none (R15 merged into `staging` 2026-10-03, PR #124). Branch R16 from `staging` after that merge: ticket 89 changes the Games settings form that `93` flattens.

**Status:** ready-for-agent

**Red-team:** **required** (Drizzle schema change; Hosts record Placements; Discretionary points are Organizer-only). Red-teamed 2026-10-03; findings resolved below.

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## Order

92, 95 and 94 first (small, independent); 90 → 93; 91; 96 last (needs all): it converts every seed and runs the one full `pnpm gate`.

## Shared decisions (from the red-team, 2026-10-03)

- **Deployed data is reset, not converted** (Paul: not a production database with real users yet). The SQL migrations only change the schema, plus the minimum coercion so they apply cleanly to rows of the old shape (map old enum values, null dropped columns' dependants, delete per-Format rows the new CHECKs refuse). They don't preserve Standings. After the merge, staging and prod are reloaded with `--reset` (`96`). Seed JSON is where data is converted.
- **Enums in one transaction.** Drizzle applies every pending migration in one transaction (`schema.ts`, R3 decision 13). Never `ALTER TYPE … ADD VALUE` and use the value in the same run: change an enum by creating the new type, `ALTER COLUMN … TYPE … USING`, then dropping the old type. Drop CHECKs before changing the columns they name and re-add them after.
- **Every migration test runs on populated rows.** Each ticket that changes the schema adds a case to `src/db/migrations.test.ts` (the R11 pattern: scratch schema, rows of the old shape, apply the tagged migration's statements, assert the result). CI only migrates an empty database, so this is the only check that the migration applies to staging.
- **One full gate, at the end.** R16 is one branch and one PR, so the slice the testing policy gates is the epic. Tickets 90–95 each pass `pnpm typecheck && pnpm lint && pnpm test`, including their own new unit, action and migration tests. They change the seed *schema and loader* for what they add, but no seed JSON: every seed conversion happens in `96`, which then runs `pnpm gate` (smoke and e2e load every seed) for the first time on the branch. Smoke and e2e specs a ticket adds or rewrites are written in that ticket and first run there. Commits between 90 and 96 aren't fully green; that's accepted.
- **Retired tests are deleted, not skipped.** Each ticket lists the specs it deletes and the ones it rewrites in its closeout, and updates the command table in `docs/agents/testing.md` to match. A deleted test is replaced by one for the new behaviour where the behaviour still exists.
- **Permissions are server-side.** Every new write goes through `authorize` / `can` (`src/auth/authorize.ts`, `src/lib/access.ts`) with a new action name in `WarWeekAction` and a rule in `can`. A page refusal is not enough: each new action has unit tests in `src/lib/access.test.ts` for every role it refuses and an action-level test that calls the server action as that role.
- **ADRs:** one new ADR covers both Placement writes (Organizers and the Competition's Hosts; Participants never) and Discretionary points (Organizers only, scoped to a War Week by `war_week_id`), and updates ADR 0002's table.

## Acceptance criteria

Each ticket's own, plus:

- [ ] The new ADR is in `docs/adr/` and ADR 0002's table reflects Placement and Discretionary points.
- [ ] MCP reports the new Formats (Placement, Head-to-head, Best score, Participation, Bracket) and Discretionary points, read-only, no emails.
- [ ] `/about` (copy and media via `scripts/about-media.ts`), `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where user-visible (team rules).
- [ ] `CONTEXT.md` updated per the grilling record's glossary list for what ships here.
- [ ] `grep -rn "test.skip\|describe.skip\|test.fixme" e2e src` shows no skip added on this branch (`git diff staging -- e2e src`).
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-03 (red-team): BLOCKED, 2 blocking (migration never tested on populated data; Discretionary points unscoped and under-checked), 10 warnings, 10 minor.
- 2026-10-03 (Paul, on the red-team): B1 reset staging/prod rather than convert; B2 `war_week_id`; W1 reset is fine; W2 schema at agent's discretion; W3 server-side checks on every action; W4 fix the Standings test; W5 delete old tests; W6 wait for R15 to merge; W7 one full gate at the end, seed conversion back in 96 (Paul, after asking how the gate works: per-ticket seed conversion was bloat); W10 demo XI's stray Games-Competition entries are dropped (confirmed); W8 fix the e2e setup; W9 Discretionary entries can be edited and deleted; minors at agent's discretion. Applied to the epic and tickets 90–96 the same day.

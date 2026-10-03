# Epic R17: Brackets

**What to build:** One Bracket Format (part 97); seeding by Standings, Forfeit and Time & place removed, and a Heat's recorded time stored (99); an optional 3rd place game in a head-to-head Bracket, with places from the final up to 4th (98); one tree for admin and Participants (100).

**Work package:** this epic is **one work package**: one branch, one migration, one seed conversion, one full gate, one PR. The files `97`–`100` under `../issues/` are its **parts**: each holds the decisions and behaviour checks for one area, with no gate, branch, PR or migration of its own. Their `Blocked by` lines are an order inside this branch, not merge gates.

**Branch:** `feat/regression-r17-brackets`, from `staging` after both blockers below have merged.

**Blocked by:** R16 (`feat/regression-r16-competition-model`) merged into `staging`, so the branch starts from its schema (`drizzle/0028_*`); and this planning change (`docs/regression-r17-red-team`) merged into `staging` (one schema-changing epic at a time).

**Status:** in-progress

**Red-team:** **required** (Drizzle schema change; recording from the shared tree). Pass 1 on 2026-10-03 BLOCKED; resolved below.

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## How the work is done

- **Part order on the one branch:** 97 → 99 → 98 → 100. A part may leave the gate red; only the end of the work package must be green.
- **Shared files are owned by one worker at a time**, in part order: `src/db/schema.ts`, `src/lib/enums.ts`, `drizzle/`, `src/seed/schema.ts`, `src/lib/bracket/*`, `src/mutations/brackets.ts`, `src/actions/brackets.ts`, `src/components/bracket-builder.tsx`, `heat-result-form.tsx`, `bracket-tree.tsx`, `bracket-view.tsx`, `bracket-results.tsx` and `e2e/bracket*.spec.ts`. No two workers edit these in parallel.
- **The default design is one Format with one engine dispatch:** Format, config, UI, copy, MCP and seeds say **Bracket**; internally, heat size 2 / 1 advancing runs today's single-elimination engine (power-of-2 tree, byes, `winnerTo` links) and anything else runs today's Heats engine. Merging the two engines is out of scope.
- **One migration.** `pnpm db:generate` runs **once**, after every part's schema change is in `src/db/schema.ts`, giving a single `drizzle/0029_*.sql` with its journal entry and snapshot, then hand-edited as below. Never generate one per part. drizzle-kit needs a terminal: run `script -q /dev/null pnpm db:generate` and answer **create** to every prompt (nothing here is a rename); check the SQL has no `RENAME`.
- **Checks while building:** `pnpm typecheck && pnpm lint && pnpm test` with local Postgres up (`docker compose up -d`) and `DATABASE_URL` pointing at it, so Postgres tests run rather than skip. Any skipped Postgres file is a failure. Smoke and e2e run in the full gate at the end.
- **Retired tests are deleted, not skipped,** and replaced by a test of the new behaviour where one exists. Each part's closeout lists the specs it deletes and rewrites. The existing single-elimination, Heats and timed-Heat e2e flows are **rewritten** by 99 and 100, not expected to pass unchanged.
- **Permissions are server-side.** Recording from the shared tree uses the existing Heat Result and self-report authorization; no new action. Toggling the 3rd place game goes through the existing Bracket-setup authorization.
- **Evidence** goes under `test-results/r17/` (vitest summary with its skipped count, gate output); e2e screenshots stay under `test-results/e2e/<test>/`.
- **Out of scope:** backlog item 25 (rename `finalized_at` / `generated_by_bracket`) stays on the backlog for a later schema change; R17 is already large.

## Schema changes (all in the one migration)

| Change | Part |
| --- | --- |
| `competition_format`: `single-elimination` and `heats` become `bracket` | 97 |
| `bracket_config` is set for every Bracket: `{ entrantsPerHeat, advancePerHeat, thirdPlaceGame }`; never null for a Bracket | 97, 98 |
| `heat_status` loses `forfeit`; `heat_entrant.forfeited` dropped | 99 |
| `heat.day_id`, `start_time`, `location` and `heat_day_id_idx` dropped | 99 |
| `heat.recorded_at` (timestamp, nullable) added | 99 |
| `heat.loser_to_heat_id`, `loser_to_slot` (mirroring `winner_to_*`) and `heat.third_place` (boolean, not null, default false) added | 98 |

## The migration

Deployed data is **reset, not converted** (Paul, 2026-10-03: a full reset; all data is in seed files and no other data matters; nothing uses Forfeit). The migration changes the schema and coerces just enough that it applies to rows of the old shape. Seed JSON is where data is converted. Hand-edit the generated SQL so, in order:

1. Any CHECK naming a changed column is dropped first and re-added last.
2. **Every Bracket returns to not generated:** delete every `heat` of a `single-elimination` or `heats` Competition (`heat_entrant` cascades), delete those Competitions' Points Entries with `generated_by_bracket`, and clear their `finalized_at`. This also removes every `forfeit` Heat and every `forfeited` row.
3. `competition_format` is recreated (no `ALTER TYPE … ADD VALUE`): drop `competition.format`'s default; create the new type with `bracket` in place of `single-elimination` and `heats`; `ALTER COLUMN format TYPE … USING` a `CASE` mapping both to `bracket`; drop the old type; restore the default.
4. `bracket_config`: a former `single-elimination` Competition gets `{"entrantsPerHeat":2,"advancePerHeat":1,"thirdPlaceGame":false}`; a former `heats` one keeps its saved values (or `4`/`2` where null) plus `"thirdPlaceGame":false`.
5. A Bracket's `placement_points` longer than 4 is cut to its first 4.
6. `heat_status` is recreated without `forfeit` (the `USING` cast is safe after step 2); `heat_entrant.forfeited`, `heat.day_id`, `start_time`, `location` dropped; the new `heat` columns added.

## Seed conversion

- `seeds/demo/xii.json` Chess Heats: `"format": "bracket"`, `bracketConfig` `{ "entrantsPerHeat": 4, "advancePerHeat": 2, "thirdPlaceGame": false }`; its `[5, 3, 1]` fits 4 places.
- Every seed: no `single-elimination` or `heats` Format, no Bracket without a full `bracketConfig`, no Bracket with more than 4 Placement Points.
- `src/seed/schema.ts` accepts `bracket` (with a required config) and refuses the old names; `src/seed/schema.test.ts`'s "bracketConfig is only for a heats Competition" becomes "only for a Bracket".

## Human prerequisite: reset staging, then prod

As R16's, after the R17 PR merges into `staging` and `migrate.yml` is green:

1. **Staging.** Run the **Seed** workflow on `staging`, file blank (all seeds), **reset** ticked, `staging` typed in **confirm_reset**. Expected: green. Check: demo XII's Chess Heats opens as a Bracket of 4 per Heat, top 2 advance; its builder offers no 3rd place game; no Heat shows a time.
2. **Prod pre-check, before the `staging` → `main` PR merges:** prod Admin holds no Bracket an Organizer built that should be kept (migration step 2 deletes every Heat). If it does, don't merge; ask Paul.
3. **Prod**, after the `main` merge's migrate run is green: the Seed workflow **from `main`**, as for staging, on `production`.

If a migrate run fails, don't reseed; fix the migration on a `fix/…` branch.

## Acceptance criteria

The parts' own, plus:

- [ ] **Migration on old rows** (`src/db/migrations.test.ts`; the closeout shows it ran, not skipped): in a throwaway database, migrate with a copy of `drizzle/` whose journal stops at `0028`; insert a finalized `single-elimination` Competition with `bracket_config` null, Heats (one `forfeit` with a `forfeited` Entrant, one with a `day_id`, `start_time` and `location`) and generated Points Entries; and a `heats` one with config `{4, 2}` and 5 Placement Points; run the full `drizzle/` (one transaction). Assert it commits; both are `bracket`; their configs are `{2, 1, false}` and `{4, 2, false}`; neither has Heats, generated entries or `finalized_at`; the second has 4 Placement Points. Drop the database.
- [ ] **Every seed loads twice** in R16's three seed sets (`src/seed/seed-sets.test.ts`); row counts don't change on the second load.
- [ ] `grep -rn '"single-elimination"\|"heats"' src/lib/enums.ts src/seed/schema.ts seeds` finds nothing (the Format values' sources; the engines may keep internal names).
- [ ] `git diff $(git merge-base HEAD origin/staging) -- e2e src scripts | grep -n '^+.*\(\.skip(\|\.fixme(\|\.only(\)'` finds nothing (`skipIf` is allowed).
- [ ] **MCP** names the Format **Bracket** with heat size, advancing and 3rd place game; `get_bracket` has no Heat time, place or Forfeit, gives `recordedAt` per played Heat, marks the 3rd place game, and its champion is the final's winner; `src/mcp/llms-txt.ts` no longer promises a Heat's time and place. Covered by `src/mcp/*.test.ts` (including no `@` in output) and smoke's MCP check on the seeded Chess Heats.
- [ ] `docs/agents/testing.md`'s smoke and e2e rows describe the rewritten Bracket flows (no timed Heat, no Forfeit, no By Standings; the tree recording flows and the 3rd place game added).
- [ ] `/about` copy and stills (`pnpm tsx scripts/about-media.ts --stills`), `docs/maintainers-guide.md` (including the reset as how R17 reached staging and prod) and `docs/regression-checklist.md` updated where user-visible.
- [ ] `CONTEXT.md`: **Bracket** with heat size, advancing and **3rd place game**; single elimination and Heats retired as Format names (a **Heat** is still one game); **Forfeit** and a Heat's Day, time and location retired, including in the Bracket rules; a played Heat's **recorded time**.
- [ ] Each part file records its closeout and is `done`; this epic records the work-package closeout (evidence paths, vitest summary with skipped count, gate result) and the PR URL.
- [ ] The PR description lists the human prerequisite as a post-merge step for Paul.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-03 (red-team pass 1): BLOCKED, 2 blocking (four gated tickets on one branch with parallel migrations; migration unspecified and untested on old rows), 8 warnings, 7 minor.
- 2026-10-03 (Paul, on pass 1): B1 one work package; B2 nothing uses Forfeit, recreating enums is fine, treat it as a full reset (all data is in seeds); W1 store the recorded time; W2 the 3rd place game decides 3rd and 4th, is optional when configuring, can't be toggled once the Bracket starts, single elimination only; W3 make clear which Heat is which; W4 Heat times aren't needed; the rest at the agent's discretion. Applied: one work package with part order and serial shared files (B1, W8); the migration resets every Bracket, with a test on old rows, and the human reset (B2); `heat.recorded_at` (W1); the 3rd place game stored as `thirdPlaceGame` plus `loser_to_*` links and a `third_place` Heat, locked once any Heat Result exists (W2); every final reader excludes the `third_place` Heat, with tests (W3); Heat times removed with no fallback, every reader listed (W4); MCP and seed DoD (W5); assertive scroll and points checks (W6); tree access checks (W7); exact greps, rewritten e2e, no manual reordering, evidence and closeout, one engine dispatch as the default, backlog 25 deferred, branch from merged R16 (M1–M7).

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r17`): claimed; `ready-for-agent` → `in-progress`. Execution record: [`R17-execution.md`](./R17-execution.md).

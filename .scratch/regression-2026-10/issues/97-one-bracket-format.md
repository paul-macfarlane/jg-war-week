# 97: One Bracket Format

**What to build:** `single-elimination` and `heats` merge into one Format, **Bracket**, with two settings: **heat size** (2–8) and **how many advance** (1 to size − 1). "Head-to-head (single elimination)", size 2 with 1 advancing, is the default preset; anything else is Heats. One Format, config, builder, tree and copy.

**Part of:** epic R17 (`../epics/R17-brackets.md`), one work package. No gate, branch or migration of its own; the epic's "How the work is done", migration and seed conversion apply.

**Blocked by:** nothing inside R17 (first part)

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: heats vs single elimination unclear); grilling Q16

## Decisions

- **One Format, one engine dispatch:** size 2 / 1 advancing runs today's single-elimination engine (power-of-2 bracket, byes to top seeds, `winnerTo` links) and behaves exactly as single elimination does today; any other config runs today's Heats engine. The dispatch lives in one place in `src/lib/bracket/`; nothing outside it branches on which engine runs.
- `bracket_config` is never null for a Bracket: `{ entrantsPerHeat, advancePerHeat, thirdPlaceGame }` (`thirdPlaceGame` from `98`). `configOf` no longer has a per-Format null default; a new Bracket gets 2 / 1 / false.
- `placementLimit` treats `bracket` as the Bracket Format (`src/lib/competitions.ts`).
- Self-report and Squads keep working.
- Schema and seed changes are listed in the epic; this part owns the Format enum, the config shape, the seed schema and the demo seed change.

## Acceptance criteria

- [x] The existing single-elimination and Heats engine tests run through the Bracket Format at 2/1 and at other configs (e.g. 4/2), unchanged in their expectations.
- [x] Unit test: the engine dispatch picks the single-elimination path for 2/1 only.
- [x] Builder: one Format select option, **Bracket**, with heat size and advancing; the 2/1 preset is labelled "Head-to-head (single elimination)"; no separate Heats or Single elimination Format option remains (`grep -rn '"single-elimination"\|"heats"' src/lib/enums.ts src/seed/schema.ts seeds` finds nothing).
- [x] The epic's migration test covers this part's mapping.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r17`): claimed; `ready-for-agent` → `in-progress`. Execution record: [`R17-execution.md`](../epics/R17-execution.md).

- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r17`): D97 `11e0f33` (Sonnet). Dispatch `engineFor(config)`; engine tests through `bracket` at 2/1 and 4/2; builder one Format with the preset; migration test covers the mapping. Rewritten: `formats.test.ts`, `seed/schema.test.ts` ("only for a Bracket"); deleted: the two null-config Heats tests. Every AC PASS; evidence and the AI Code Review in [`R17-execution.md`](../epics/R17-execution.md). `ai-review` → `done`.

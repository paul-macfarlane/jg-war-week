# 95: Placement Points without a limit

**What to build:** Placement Points can cover any number of places for Placement, Head-to-head, Best score and Participation (team). Brackets keep their current limit of 5 here; R17's `98` lowers it to 4 when it defines places from the final. Today `MAX_PLACEMENTS = 5` (`src/lib/competitions.ts:20`).

**Part of:** Epic R16's one work package (`../epics/R16-competition-model.md`): no gate, order or migration of its own. Schema changes go into `src/db/schema.ts`; the epic generates and hand-edits the one migration and converts the seeds.

**Status:** done

**Source:** grilling Q4 (Paul: "no limits unless there's a clear reason"; Brackets at 4 to limit complexity, without closing the door); red-team 2026-10-03 (M2)

## Decisions

- Keep the stored shape an open list (`numeric[]`), non-increasing, each ≥ 0; the limit is a per-Format rule in one place, so Brackets can grow later.
- The field is a list editor (add / remove a place) rather than a fixed five inputs; it stays usable at 20+ places on a phone: a component test adds 20 places and saves; a screenshot at 390 wide with 20 places shows every input reachable without horizontal scroll.

## Acceptance criteria

- [ ] Unit tests: 12 places accepted for Placement; 6 refused for a Bracket (5 until `98`); non-increasing enforced.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r16`): claimed with Epic R16; `ready-for-agent` → `in-progress`. Execution record: [`R16-execution.md`](../epics/R16-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r16`): done. `placementLimit` in `src/lib/competitions.ts` is the one rule (Brackets 5, every other Format unlimited), applied on create, edit, Format change and seed, with one message. `PlacementPointsRows` is a list editor (add, remove any place, 5·3·1). Tests: 12 places for Placement, 6 refused for a Bracket, non-increasing; `placement-points-rows.test.tsx` adds 20 places and saves; `e2e/placement-points.spec.ts` shot `test-results/e2e/placement-points-20-places/390.png` with no horizontal scroll. Evidence and review: [`R16-execution.md`](../epics/R16-execution.md). PR: https://github.com/paul-macfarlane/jg-war-week/pull/126.

# 94: Participation scoring follows the Competition's scoring

**What to build:** Participation's points follow the Competition's scoring, with no separate team mode: an **individual** Competition gives N points to each person who took part (counting toward their Team when "counts toward team" is on); a **team** Competition ranks Teams by headcount and awards Placement Points. The team **per-person** mode goes, and the settings show only the fields that apply (N for individual, Placement Points for team).

**Part of:** Epic R16's one work package (`../epics/R16-competition-model.md`): no gate, order or migration of its own. Schema changes go into `src/db/schema.ts`; the epic generates and hand-edits the one migration and converts the seeds.

**Status:** in-progress

**Source:** Paul's regression feedback 2026-10-03 (Admin: participation max and placement points); grilling Q5, Q27. Amends ticket 69's team modes; red-team 2026-10-03 (W7).

## Decisions

- Drop `participation_team_scoring` (and `per-person`); any existing per-person Competition becomes ranked (no data in use).
- Max Points goes in `92`.
- **CHECK `competition_participation_columns`** becomes: Participation + individual needs `participation_points` and no `placement_points`; Participation + team needs `placement_points` and no `participation_points`; other Formats have neither participation column nor `check_in_closes_at`. The epic's migration maps per-person rows to ranked and clears `participation_points` on team rows.
- **Seeds:** `participationTeamScoring` leaves the seed schema; the epic strips it from the JSON (demo XI's Daily Workout Check-in included).
- **Tests:** delete the per-person unit and e2e cases; keep and rewrite the ranked ones.

## Acceptance criteria

- [ ] Unit tests: individual N each (and toward Team); team ranked by headcount with ties.
- [ ] The team Participation e2e is rewritten and an individual one gives N each.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r16`): claimed with Epic R16; `ready-for-agent` → `in-progress`. Execution record: [`R16-execution.md`](../epics/R16-execution.md).

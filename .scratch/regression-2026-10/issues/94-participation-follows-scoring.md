# 94: Participation scoring follows the Competition's scoring

**What to build:** Participation's points follow the Competition's scoring, with no separate team mode: an **individual** Competition gives N points to each person who took part (counting toward their Team when "counts toward team" is on); a **team** Competition ranks Teams by headcount and awards Placement Points. The team **per-person** mode goes, and the settings show only the fields that apply (N for individual, Placement Points for team).

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: participation max and placement points); grilling Q5, Q27. Amends ticket 69's team modes; red-team 2026-10-03 (W7).

## Decisions

- Drop `participation_team_scoring` (and `per-person`); any existing per-person Competition becomes ranked (no data in use).
- Max Points goes in `92`.
- The migration drops the `participation_columns` CHECK, maps `per-person` rows to ranked, drops the column and its enum, and re-adds the CHECK without it.
- **Seeds:** `participationTeamScoring` leaves the seed schema; `96` strips it from the JSON (demo XI's Daily Workout Check-in included).
- **Tests:** delete the per-person unit and e2e cases; keep and rewrite the ranked ones.

## Acceptance criteria

- [ ] Unit tests: individual N each (and toward Team); team ranked by headcount with ties.
- [ ] The team Participation e2e is rewritten and an individual one gives N each (first run in `96`).
- [ ] `src/db/migrations.test.ts`: a scratch schema with a per-person and a ranked team Participation Competition migrates; both end up ranked and the column is gone.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass (the full gate runs once, in `96`).

# 96: Convert the seeds, run the gate, reset staging and prod

**What to build:** The last step of R16. Tickets 90–95 change the schema, the seed loader and the tests but no seed JSON; this ticket converts every seed to the new model, runs the epic's one full `pnpm gate`, and names the human reset of the deployed databases.

**Blocked by:** `90`, `91`, `92`, `93`, `94`, `95`

**Status:** ready-for-agent

**Source:** grilling Q26, Q37–Q40; seed survey in `../grilling-2026-10-03.md` facts; red-team 2026-10-03 (B1, W1, W4, W7, W10, M1, M7)

## Decisions

- **Rule for a `points` Competition** (from `90`): sum each target's entries; order targets by total (ties share a place); write Placements and `finalized: true`. Placement Points: keep the Competition's own when they reproduce every target's total place for place (Settlers of Catan's `[5,3,1]` with only a 1st stays); otherwise the list of totals each place got. The old entries leave the seed.
- **War Week XI** (`seeds/xi.json`, 22 Competitions, 24 entries, all one per Team): converted by the rule. **Subjective Points** (Red 6, Blue 4) becomes Discretionary points with reason "Subjective Points" and the Competition is removed. **HQ Attendance** and **AI Survey Completion** become Placements by the rule.
- **Demo XI:** Electric City Matrix (ranked, no Games) becomes an empty, unfinalized Placement. Bouncy Pong and Tuesday Stairs become Head-to-head and Best score, and their three typed entries (`bouncy-pong-nick-brown`, `tuesday-stairs-red`, `tuesday-stairs-blue`) are removed: Games aren't seeded and a typed entry on a Games Competition was never valid (Paul confirmed). Daily Workout Check-in loses `participationTeamScoring`.
- **Demo XII:** Step Challenge becomes a Placement with a Score (total steps, higher wins), recorded once and finalized; Mile Run already matches [3, 2, 1]. This is the seeded Placement-with-Score Competition `90` asks for; smoke covers its page.
- **Historical seeds i–x:** `maxPoints` goes; a `points` Competition with no entries (vi–x) becomes an empty, unfinalized Placement.
- Every seed: `maxPoints`, `gameType` `ranked`, `finishPoints` and `participationTeamScoring` gone; `format` values renamed.
- **Deployed data is reset, not converted** (Paul, 2026-10-03: not a production database with real users yet). The migrations only coerce enough to apply to old rows; the reload with `--reset` replaces the War Week data.

## Human prerequisite: reset staging, then prod

Prerequisite: the R16 PR is merged into `staging` and `migrate.yml`'s run on that push is green.

1. **Staging.** Run the **Seed** workflow (Actions tab) on `staging`, file blank (all seeds), **reset** ticked, `staging` typed in **confirm_reset**.
   Expected: the run is green.
   Check: on staging, `/xi/leaderboard` shows the frozen XI totals from this ticket's test; `/xi` lists Placement Competitions and Admin has no Points page; Subjective Points appears as "Discretionary: Subjective Points" in a Team's "where points came from".
2. **Prod**, after the `staging` → `main` PR merges and its migrate run is green: the same, on `production`.
   Expected and check: as for staging, on the production URL.

If a migrate run fails, don't reseed: the migration tests in `src/db/migrations.test.ts` missed an old-row shape. Fix it on a `fix/…` branch.

## Acceptance criteria

- [ ] **Frozen XI Standings:** a test holds a literal table of each Team's total from `seeds/xi.json` as of `staging` before R16 (computed once and pasted in, never by the conversion), loads the converted `seeds/xi.json` with the real loader into a fresh War Week in Postgres, and asserts `getStandings` returns exactly those totals.
- [ ] `grep -rni "max.\?points\|finishPoints\|participationTeamScoring\|\"ranked\"\|\"format\": \"points\"\|\"format\": \"games\"" seeds` finds nothing.
- [ ] Every seed loads twice into a fresh database with no change on the second load (row counts per table equal); loading `seeds/xi.json` twice leaves one Subjective Points entry per Team; smoke row counts and constraints updated for the new tables.
- [ ] A final `src/db/migrations.test.ts` case applies **all** R16 migrations in order, in one transaction, to a scratch schema holding one row of each pre-R16 shape (a `points` Competition with typed entries, a `games` head-to-head with Games, a `ranked` one, a per-person Participation, a Bracket with `max_points`), and asserts it commits.
- [ ] `/about` stills regenerated (`pnpm tsx scripts/about-media.ts --stills`) where the Points page or Formats appear.
- [ ] `docs/maintainers-guide.md` records the reset as the way R16 reached staging and prod.
- [ ] The human prerequisite above is in the PR description as a post-merge step for Paul.
- [ ] `pnpm format:check && pnpm gate` passes: the epic's first and only full gate run.

# 96: Migrate Competitions and seeds

**What to build:** The migration and seed rewrite that land R16. Every `points` Competition becomes a **finalized Placement** whose Standings are unchanged; Games become Head-to-head / Best score; data that isn't a contest becomes Discretionary points.

**Blocked by:** `90`, `91`, `92`, `93`, `94`, `95`

**Status:** ready-for-agent

**Source:** grilling Q26, Q37–Q40; seed survey in `../grilling-2026-10-03.md` facts

## Decisions

- **Rule for a `points` Competition:** sum each target's entries; order targets by total (ties share a place); Placement Points = the total each place got; write Placements and Finalize, so the generated entries equal the old totals.
- **War Week XI** (`seeds/xi.json`, 22 Competitions, 24 entries, all one per Team): converted by the rule. **Subjective Points** (Red 6, Blue 4) becomes Discretionary points with reason "Subjective Points" and the Competition is removed. **HQ Attendance** and **AI Survey Completion** become Placements by the rule.
- **Demo XI:** Electric City Matrix (ranked) becomes a Placement; entries sitting on `games` Competitions (Bouncy Pong, Tuesday Stairs) are rewritten as Games or Placements so the seed is consistent.
- **Demo XII:** Step Challenge becomes a Placement with a Score (total steps, higher wins), recorded once; Mile Run already matches [3, 2, 1].
- Historical seeds i–x have no entries: only Format and Max Points change.
- **No production safeguards:** the data isn't in use (Paul, Q39). A test proves XI's Standings are identical before and after.
- Seed schema (`src/seed/schema.ts`) gains Placements and Discretionary points; loads stay idempotent.

## Acceptance criteria

- [ ] Test: XI's team Standings from the old seed equal those after conversion.
- [ ] Every seed loads twice; smoke row counts and constraints updated.
- [ ] `/about` stills regenerated (`pnpm tsx scripts/about-media.ts --stills`) where the Points page or Formats appear.
- [ ] `pnpm gate` passes.

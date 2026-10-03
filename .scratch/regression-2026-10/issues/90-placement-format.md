# 90: The Placement Format

**What to build:** The `points` Format becomes **Placement**: a Competition whose one result is recorded on one sheet. An Organizer or Host adds people (search, or **Add everyone**: the roster, or every Team in a team Competition), gives each row a **Place** and an optional **Score**, and presses **Finalize**: points come only from the Competition's Placement Points by place. **Reopen** withdraws them so the sheet can change. No typed points, no Entrants step.

**Blocked by:** none (first ticket of R16 after 92, 95, 94)

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: placement scoring, one-at-a-time entry, free-form points, re-grill points); grilling Q1, Q24, Q25, Q34, Q35; red-team 2026-10-03 (W2, W3, W4, W8, M1, M5, M6, M7)

## Decisions

- **Score direction:** a per-Competition setting, *none* / *higher wins* / *lower wins*. With a direction, Places fill from Scores as they're typed and stay editable (for ties and judgement); without one, Places are typed or dragged.
- **Ties** share a place and its full points (the Bracket/Games rule). Unplaced rows (no Place) earn nothing.
- **A Score without a Place blocks Finalize:** it refuses with "Give every row with a Score a Place, or clear its Score." and names the rows. While not Finalized such rows are allowed.
- **One result only.** Repeat play belongs to Head-to-head or Best score (`93`).
- **Who:** Organizers and Hosts of that Competition. Participants don't record Placements. Covered by the epic's new ADR.
- **Points:** Finalize writes generated Points Entries (as Brackets do today, `finalized_at` set) and Reopen deletes them; Standings, Finale, Recent results (ticket 56) and "where points came from" read them unchanged.
- **Placements are visible** on the Participant Competition page: place, name, Score, points; Recent results shows a Finalize.
- Paul expects feedback once it's usable; keep the sheet simple.
- CONTEXT.md: **Placement** (Format and row), **Record placements**, **Score direction**.

### Schema (red-team W2)

- `competition_format`: `points` → `placement` (recreate the type; see the epic's enum rule). The migration maps existing `points` rows to `placement`.
- `competition.score_direction`: enum `none | higher | lower`, not null, default `none`. Meaningful only for Placement; other Formats keep `none` (CHECK).
- New table `placement`: `id`, `competition_id` (FK, cascade), `team_id` / `participant_id` (FKs, cascade; CHECK `num_nonnulls(team_id, participant_id) = 1`), `place` integer null (CHECK `place >= 1`), `score` numeric(12,3) null, `seed_key` varchar(80) null, `created_at`, `updated_at`. Unique `(competition_id, team_id)`, `(competition_id, participant_id)`, `(competition_id, seed_key)`. Index on `competition_id`.
- A team Competition takes only Teams, an individual one only Participants, both of the Competition's War Week: refused in the write (ADR 0003), not by CHECK.
- Rows can't change while the Competition is Finalized (the server refuses; Reopen first).

### Permissions (red-team W3)

- New actions `placement.edit` (add / change / remove rows, Score direction), `placement.finalize`, `placement.reopen` in `WarWeekAction`, each allowed for Organizers and Hosts of that Competition only, through `authorize("…", "competition", id)`.

### Seed loader and tests (red-team W7, M1, M7)

- The seed schema gains `placements` (`{ key, competition, team | participant, place, score? }`) and `scoreDirection` on a Competition, and a `finalized: true` flag; the loader writes rows idempotently by `(competition_id, seed_key)` and, for a finalized Competition, writes the generated entries the same way Finalize does.
- **The conversion rule** (applied to the seed JSON in `96`): sum each target's entries; order targets by total (ties share a place); write Placements and `finalized: true`. Placement Points: keep the Competition's own when they reproduce every target's total place for place (e.g. Settlers of Catan's `[5,3,1]` with only a 1st); otherwise the list of totals each place got. The old entries are removed from the seed. A `points` Competition with no entries (the historical seeds vi–x) becomes an empty, unfinalized Placement.
- Tests on the old typed-entry flow for `points` Competitions move to `91` (which deletes the Points page); this ticket deletes nothing it doesn't replace.

## Acceptance criteria

- [ ] Unit tests: Places from Scores in both directions with ties; points by place with ties; unplaced earns nothing; a Score without a Place refuses Finalize; Finalize/Reopen idempotent; the seed loader writes Placements and a finalized Competition's entries idempotently.
- [ ] `src/lib/access.test.ts`: `placement.edit`, `placement.finalize` and `placement.reopen` allow an Organizer and that Competition's Host, refuse a Host of another Competition, a Participant and anonymous.
- [ ] Action test (Postgres): each placement server action, called as a Participant and as a Host of another Competition, returns the refusal and writes nothing; adding a Participant from another War Week is refused.
- [ ] `src/db/migrations.test.ts`: in a scratch schema with a `points` Competition holding typed entries, a `games` Competition and a Bracket, the migration applies, the `points` row is `placement` with `score_direction = 'none'`, and the others are unchanged.
- [ ] e2e (red-team W8): the spec inserts an **individual** Placement Competition (score direction *higher wins*) into demo XI and a `competition_host` row for `E2E_HOST_EMAIL` (the `e2e/games.spec.ts` pattern), then `asHost` records 6 Participants with Scores, edits a tie, Finalizes; `/xi/leaderboard` moves by those Participants' Teams' points; Recent results shows the Finalize; Reopen withdraws; a signed-in Participant (`signIn(context, E2E_PARTICIPANT_EMAIL)`) gets the refusal at the sheet. Screenshots at 1440 and 390. Written here; first run in `96`'s gate.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass (the full gate runs once, in `96`).
- [ ] MCP exposes Placements read-only, no emails.

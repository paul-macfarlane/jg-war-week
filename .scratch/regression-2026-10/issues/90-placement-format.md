# 90: The Placement Format

**What to build:** The `points` Format becomes **Placement**: a Competition whose one result is recorded on one sheet. An Organizer or Host adds people (search, or **Add everyone**: the roster, or every Team in a team Competition), gives each row a **Place** and an optional **Score**, and presses **Finalize**: points come only from the Competition's Placement Points by place. **Reopen** withdraws them so the sheet can change. No typed points, no Entrants step.

**Part of:** Epic R16's one work package (`../epics/R16-competition-model.md`): no gate, order or migration of its own. Schema changes go into `src/db/schema.ts`; the epic generates and hand-edits the one migration and converts the seeds.

**Status:** ai-review

**Source:** Paul's regression feedback 2026-10-03 (Admin: placement scoring, one-at-a-time entry, free-form points, re-grill points); grilling Q1, Q24, Q25, Q34, Q35; red-team 2026-10-03 pass 1 (W2, W3, W4, W8, M1, M5, M6, M7) and pass 2 (W6, M5, M8)

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

- `competition_format`: `points` → `placement` (the epic's migration steps).
- `competition.score_direction`: enum `none | higher | lower`, not null, default `none`. Meaningful only for Placement; other Formats keep `none` (CHECK).
- New table `placement`: `id`, `competition_id` (FK, cascade), `team_id` / `participant_id` (FKs, cascade; CHECK `num_nonnulls(team_id, participant_id) = 1`), `place` integer null (CHECK `place >= 1`), `score` numeric(12,3) null, `seed_key` varchar(80) null, `created_at`, `updated_at`. Unique `(competition_id, team_id)`, `(competition_id, participant_id)`, `(competition_id, seed_key)`. Index on `competition_id`.
- A team Competition takes only Teams, an individual one only Participants, both of the Competition's War Week: refused in the write (ADR 0003), not by CHECK.
- Rows can't change while the Competition is Finalized (the server refuses; Reopen first).

### Permissions (red-team W3)

- New actions `placement.edit` (add / change / remove rows, Score direction), `placement.finalize`, `placement.reopen` in `WarWeekAction`, each allowed for Organizers and Hosts of that Competition only, through `authorize("…", "competition", id)`.

### Seed loader and route

- The seed schema gains `placements` (`{ key, competition, team | participant, place, score? }`) and `scoreDirection` on a Competition, and `finalized: true` with `finalizedAt` and `finalizedByEmail` (required together, so a seeded Finalize carries its real time and author, not the load time); the loader writes rows idempotently by `(competition_id, seed_key)` and, for a finalized Competition, writes the generated entries the same way Finalize does, with that time and email.
- The sheet lives at `/admin/placements/[competitionId]` (like `/admin/brackets/[id]`); R18 (`101`) folds it into the one Competition page.
- Changing a Placement with rows to another Format is refused until its rows are removed ("Remove its Placements first.").
- Tests on the old typed-entry flow for `points` Competitions are retired in part `91` (which deletes the Points page).

## Acceptance criteria

- [ ] Unit tests: Places from Scores in both directions with ties; points by place with ties; unplaced earns nothing; a Score without a Place refuses Finalize; Finalize/Reopen idempotent; the seed loader writes Placements and a finalized Competition's entries idempotently.
- [ ] `src/lib/access.test.ts`: `placement.edit`, `placement.finalize` and `placement.reopen` allow an Organizer and that Competition's Host, refuse a Host of another Competition, a Participant and anonymous.
- [ ] Action test (Postgres): each placement server action, called as a Participant and as a Host of another Competition, returns the refusal and writes nothing; adding a Participant from another War Week is refused; a Team in an individual Competition (and a Participant in a team one) is refused; any row change while Finalized is refused; a placement action on a non-Placement Competition is refused; changing the Format of a Placement with rows is refused.
- [ ] e2e (red-team W8): the spec inserts an **individual** Placement Competition with **counts toward team on** (score direction *higher wins*) into demo XI and a `competition_host` row for `E2E_HOST_EMAIL` (the `e2e/games.spec.ts` pattern), then `asHost` records 6 Participants with Scores, edits a tie, Finalizes; `/xi/leaderboard` moves by those Participants' Teams' points; Recent results shows the Finalize; Reopen withdraws; a signed-in Participant (`signIn(context, E2E_PARTICIPANT_EMAIL)`) gets the refusal at `/admin/placements/[competitionId]`. The spec deletes the Competition it inserted afterwards (cascade), so demo XI is unchanged for other specs. Screenshots at 1440 and 390.
- [ ] MCP exposes Placements read-only, no emails (test in `src/mcp/`; see the epic's MCP criterion).

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r16`): claimed with Epic R16; `ready-for-agent` → `in-progress`. Execution record: [`R16-execution.md`](../epics/R16-execution.md).

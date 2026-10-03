# 90: The Placement Format

**What to build:** The `points` Format becomes **Placement**: a Competition whose one result is recorded on one sheet. An Organizer or Host adds people (search, or **Add everyone**: the roster, or every Team in a team Competition), gives each row a **Place** and an optional **Score**, and presses **Finalize**: points come only from the Competition's Placement Points by place. **Reopen** withdraws them so the sheet can change. No typed points, no Entrants step.

**Blocked by:** none (first ticket of R16)

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: placement scoring, one-at-a-time entry, free-form points, re-grill points); grilling Q1, Q24, Q25, Q34, Q35

## Decisions

- **Score direction:** a per-Competition setting, *none* / *higher wins* / *lower wins*. With a direction, Places fill from Scores as they're typed and stay editable (for ties and judgement); without one, Places are typed or dragged.
- **Ties** share a place and its full points (the Bracket/Games rule). Unplaced rows (no Place) earn nothing; a Score without a Place is allowed only while not Finalized.
- **One result only.** Repeat play belongs to Head-to-head or Best score (`93`).
- **Who:** Organizers and Hosts of that Competition. Participants don't record Placements. Record an ADR or extend ADR 0002's table.
- **Points:** Finalize writes generated Points Entries (as Brackets do today) and Reopen deletes them; Standings, Finale, Recent results (ticket 56) and "where points came from" read them unchanged.
- **Placements are visible** on the Participant Competition page: place, name, Score, points; Recent results shows a Finalize.
- Paul expects feedback once it's usable; keep the sheet simple.
- CONTEXT.md: **Placement** (Format and row), **Record placements**, **Score direction**.

## Acceptance criteria

- [ ] Unit tests: Places from Scores in both directions with ties; points by place with ties; unplaced earns nothing; Finalize/Reopen idempotent.
- [ ] e2e: a Host records a Placement for 6 Participants with Scores (higher wins), edits a tie, Finalizes; `/xi/leaderboard` moves; Reopen withdraws; a Participant can't open the sheet. Screenshots at 1440 and 390.
- [ ] A seeded Placement Competition with a Score in the XII demo (with `96`); smoke covers its page.
- [ ] MCP exposes Placements read-only, no emails.
- [ ] `pnpm gate` passes.

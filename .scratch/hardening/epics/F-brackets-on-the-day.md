# Epic F: Brackets on the day

**What to build:** The part of ticket `16` that helps people follow and run a Bracket during War Week, as one work package, one branch and one PR into `staging`. It covers Heat times and places plus Now/Next (T13), live refresh on the bracket page and MCP `get_bracket` (T14), a Finale for a Bracket (T6 extra), and seeding by Standings (W2). None of it adds a Format, a role or a new kind of write.

**Tickets:** `16` (item 5 of its Order table; from "Also carried": the Finale for a Bracket, T14's live refresh and `get_bracket`, W2's by-Standings seeding); files under `../issues/`

**Branch:** `feat/hardening-f-brackets-on-the-day`

**Blocked by:** Epic E (its PR #84 merged into `staging`)

**Status:** plan-review

**Red-team:** required. Heat times add columns to `heat`, a Drizzle schema change (`docs/agents/planning.md`).

## Named needs

- **Participant:** "When and where is my next Heat?" The Participant view already pins "Your next Heat", but without a time or place. The home page's Now/Next ignores Heats.
- **Host and Organizer:** they see results land on an open bracket page without reloading it, and seed a Bracket from how Entrants are doing so far instead of only at random.
- **Organizer at the closing ceremony:** a finalized Bracket's champion is crowned on the projector the way the Finale crowns the War Week.
- **Claude user:** asks "who's in the Catan final?" through MCP.

## Order

1. **Heat time and place (T13).** A Heat gets an optional Day, start time (ET, like Schedule Items) and location, set by the Competition's Host or an Organizer from the results screen. Brackets spec stories 13 and 22 ("Your next Heat" shows the time and location).
2. **Now/Next includes timed Heats** (story 24). Heats with a Day and start time join the Schedule's now/next under the same ET rules (60 minutes when there's no end). A Heat is never merged with a Schedule Item that links the same Competition; both show. Reset Heats and Heats that are already decided drop out.
3. **Live refresh** (story 25). An open bracket page, both the participant view and the admin results screen, refreshes about every 10 s by reusing `src/components/auto-refresh.tsx`. The refresh never discards an unsaved result the Host is entering.
4. **MCP `get_bracket(competition)`** (story 26). Read-only. It returns the Format, the Rounds and Heats with their Entrants, places, scores, time and location, and the champion once finalized. It never returns emails, the Organizer list or Host lists (MCP policy row in `docs/agents/planning.md`).
5. **Seeding by Standings** (story 9, W2 without drag). The builder offers "By Standings" next to random. Teams are ordered by Team Standings and Participants by individual Standings; ties and Entrants with no points fall back to random order. Seed Positions can still be re-rolled or regenerated as today.
6. **Finale for a Bracket.** A finalized Bracket can be played as a Finale, counting its final placings in from last to first and ending on the champion. It follows the Finale rules (CONTEXT.md): it never reorders or recomputes Standings, and reduced motion shows the final state. Any signed-in JG user can open it; the link shows on the finalized Bracket.

## Acceptance criteria

Brackets spec (`.scratch/brackets/spec.md`) stories 9 (by Standings only), 13, 22, 24, 25 and 26, and its Surfaces decisions for Now/Next, live refresh and MCP, plus:

- [ ] Unit tests for Now/Next with timed Heats, driven by `?at=`: a Heat before, during and after its window; a Heat with no Day or no time (never shown); a Heat and a Schedule Item on the same Competition (both shown); a decided or reset Heat (not shown).
- [ ] Unit tests for by-Standings seeding: Teams and Participants, ties, Entrants with no Points Entries, and a single-elimination and a Heats Bracket generated from the result.
- [ ] `get_bracket` has tests like the other MCP tools (unknown Competition, a `points` Competition, an unfinalized and a finalized Bracket, no email in any response), and smoke calls it on `/api/mcp` with the token.
- [ ] Access tests: only an Organizer or that Competition's Host can set a Heat's time and place; a Participant, and a Host of a different Competition, are refused. Every action still runs `authorize` first (ADR 0003).
- [ ] The migration applies to the seeded local database; every seed still loads twice; smoke passes on it. Existing Heats keep working with no time.
- [ ] Playwright extends the single-elimination Bracket flow: the Host sets a Heat's time and location; the Participant sees them in "Your next Heat" and in Now/Next on the home page (`?at=` pinned); the finalized Bracket's Finale plays to the champion.
- [ ] Screenshots at 375px and 1280px of the results screen with a time set, the participant view, Now/Next with a Heat, and the Bracket Finale; zero horizontal overflow at 375/768/1280.
- [ ] Single elimination and Heats behave as before for Brackets with no times; the existing engine, mutation, smoke and Playwright bracket checks pass unchanged in what they assert.
- [ ] CONTEXT.md (Heat, Now/Next and Finale rules), `/about` copy and media, the Organizer guide and `docs/maintainers-guide.md` match every user-visible change.
- [ ] Ticket 16 records a `[PROGRESS]` comment for this slice and its `Status:` line is unchanged; this epic records its closeout and is set to `done` in this branch.
- [ ] `pnpm gate` passes locally and in CI.

## Out of scope

- Drag seeding, round robin and the Archive bracket view: cut from ticket 16 (Paul, 2026-09-27).
- Squads and self-report: Epic G.
- The Slack champion post: waits on Slack posting (ticket 17).
- Double elimination: only on request.

## Comments
- 2026-09-27 [EXECUTION PLAN]: written to `./F-execution.md`. Red-teamed three times: pass 1 blocked (2 blocking, resolved), pass 2 blocked (1 blocking, resolved), pass 3 `ATLAS_RED_TEAM_PASS` (4 minors, applied). Paul accepted every open-decision default, including refilled reset Heats showing in Now/Next. Ready for `/atlas-implement`.

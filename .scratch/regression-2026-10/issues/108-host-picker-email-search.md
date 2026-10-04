# 108: Search by email on the pickers Hosts use

**What to build:** Decide whether the pickers a Host sees (Record placements "Add a Participant", Bracket and Games Entrants, Log a Game, Squads, Who took part's search) may search by roster email, and if so how, without breaking "Participant emails never reach the client".

**Blocked by:** none

**Status:** needs-triage

**Source:** Ticket 106 scale pass (2026-10-04); R19 resolved decision "Search in `EntityCombobox` pickers matches name and email"

## Finding

- Ticket 106 made `EntityCombobox` search a hidden `keywords` field and wired Participant emails into the two Organizer-only pickers (Discretionary points, Awards).
- The other Participant pickers sit on the Competition page's run area, which Hosts use too, and Log a Game is Participant-facing. CONTEXT.md says "Participant emails never reach the client, only the matched id", and `PlacementSheetRow` says "never an email". Sending emails for search there needs a product call: Organizer-only (by actor), a server-side search, or name-only.

## Repro

1. `pnpm seed:demo:scale`, sign in as an Organizer, open Trivia Night's admin page.
2. In Record placements, type `example.com` into "Add a Participant": nothing matches, though every Participant's email ends with it.

## Acceptance criteria

- [ ] The decision is recorded; the chosen pickers match by email, or the name-only rule is written down.
- [ ] `pnpm gate` passes.

# 38: Bracket fixes found while building test fixtures

**What to build:** Four Bracket bugs found while building the `[Test]` Bracket fixtures on staging: the Tree view hides a Heat's time and place, Escape empties the Entrants picker, the Format help text reads as if Points were chosen, and the Finalize copy promises Points Entries that a Competition without Placement Points never gets.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** mobile regression pass 2026-09-30 (ticket 18), while building the `[Test] Pool`, `[Test] Settlers of Catan` and `[Test] Beyblades` fixtures in War Week XI on staging

## Need

- **Participant:** A Heat's time and place ("Monday, Feb 23 · 7:00 PM ET · Team Room 4") shows on the admin results screen and in the List layout, but not in the Tree layout, which is the default (`src/components/bracket-view.tsx`: `layout` starts as `"tree"` at :315; `BracketTree` at :431 gets no `days`, while the List branch calls `formatHeatWhen(heat, days)` at :453). A Participant checking when their Heat is played sees nothing unless they switch to List. CONTEXT.md says Heat cards show it.
- **Host, Organizer:** In the Entrants picker (`src/components/entrants-picker.tsx`, `EntityCombobox multiple`), pressing Escape with the input focused clears every chosen Entrant. Reproduced on staging at 375px: 16 chosen, click into the input, Escape, "0 chosen". Unsaved, so a reload restores them, but a Host who picked 20 people loses the work. Check the other `multiple` EntityCombobox users too: `squad-form.tsx`, `award-form.tsx`.
- **Host, Organizer:** Under the builder's Format select (`src/components/bracket-builder.tsx:583`), the help text always reads "Points is Points Entries only. A Format can't change while the Competition has Entrants.", even with Single elimination or Heats chosen, so it reads like a stale description of the chosen Format.
- **Host, Organizer:** Finalize asks "Create Points Entries from the final placings?" and afterwards says "Finalized: its Points Entries are in the ledger." (`src/components/bracket-results.tsx:184`, `:156`). A Competition with no Placement Points gets no Points Entries (`src/lib/bracket/points.ts`), so both are wrong for it. The Games "Closed: its Points Entries are in the ledger." (`games-builder.tsx:539`) has the same problem.

## Acceptance criteria

- [ ] The Tree layout shows a timed or placed Heat's `formatHeatWhen` text on its Heat box, as the List layout does, at 375px and 1280px. A unit or component test covers a Heat with a Day, time and location in the Tree.
- [ ] Escape in a `multiple` EntityCombobox closes the popup (and clears only the typed query) and keeps every chosen item. Covered by a component test on EntityCombobox and a Playwright check in the Bracket builder.
- [ ] The builder's Format help text doesn't describe Points as if it were chosen (e.g. "A Format can't change while the Competition has Entrants.", with the per-Format lines kept where Formats are first chosen).
- [ ] With no Placement Points, the Finalize confirm and the finalized note (and the Games closed note) don't claim Points Entries: e.g. "Finalize the Bracket? It has no Placement Points, so no Points Entries are created." Copy with Placement Points is unchanged.
- [ ] `pnpm gate` passes.

## Comments

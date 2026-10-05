---
title: War Week at full size (Epic R24)
status: done
grilled: 2026-10-04 (in session; decisions below)
created: 2026-10-04
source: Ticket 106 scale pass (2026-10-03), backlog issues 109–113
---

# War Week at full size

**Epic:** R24 · **Branch:** `feat/r24-scale` · **Blocked by:** none ·
**Execution:** [`execution.md`](./execution.md) ·
**Red-team:** not required (no schema change, no access change; the Finale
change only limits which rows count down and never reorders or recomputes
Standings) · **Status:** done · **Absorbs:** backlog
`regression-2026-10/issues/109`, `110`, `111`, `112`, `113`

## Summary

The 100-Participant scale pass (ticket 106, `pnpm seed:demo:scale`) found
five places that work at XI's size but break at XII's:

- **Roster (109).** `/admin/roster` is one 100-row list, about 5,400 px tall
  at 1440, with no search. Add Participant and Import sit below the last
  row.
- **Bracket admin (110).** A 64-Entrant Bracket's admin page lists every
  Entrant three times (Entrants, Seed Positions, the Round 1 Preview) before
  the tree. That is about 12,000 px at 1440.
- **Bracket tree (111).** The tree sits in the page's narrow column at 1440,
  so only Rounds 1–3 of 6 show. A Participant has no quick way to find their
  own Match.
- **Admin bottom bar (112).** In XI's monospace font preset at 390, the five
  tabs are wider than the screen and "More" is clipped.
- **Finale Standings (113).** Only about 12 rows fit on the slide and the
  slide doesn't scroll, so with 100 scorers most rows are never seen.

No schema change and no data migration.

## Decisions

1. **Roster: search, and the actions on top (109).**
   - Add Participant and Import move above the list, in the page header.
   - Add a search box above the list. It filters as you type, by part of
     the name or the email, case-insensitively, and shows a count ("12 of
     100"). Searching by email is fine here because `/admin/roster` is
     Organizer-only and already shows emails. The pickers' rule against
     email search (R22) doesn't apply to this page.
   - The search filters on the client, over the rows the page already
     loads. It doesn't change the URL. An empty result says "No one matches
     '<query>'".
   - No grouping by Team.
2. **Bracket admin: drop the Preview, collapse the Seeds (110).**
   - Remove the "Preview · Round 1" list from `bracket-builder.tsx`,
     because the tree below shows the same pairings.
   - When the Entrants are locked (`entrantsLock` is set, meaning a result
     exists), the Entrants and Seed Positions sections go inside one
     shadcn `Collapsible` (already in `src/components/ui/`). It is closed
     by default, and its trigger reads "Entrants and Seed Positions (64)".
     The lock reason stays visible outside it.
   - While unlocked, both sections stay expanded as today, because that is
     when an Organizer edits them.
3. **Bracket tree: full width on desktop, and a jump to your Match (111).**
   - From `md` up, the tree breaks out of the Competition page's narrow
     column and uses the full content width, so more Rounds show at 1440.
     The rest of the page keeps its column. The tree still scrolls sideways
     only inside its "Rounds" region, and the page never does (already
     asserted).
   - Add a "Jump to your Match" button above the tree. It shows only when
     the viewer, or a Squad or Team they play in, is an Entrant. It scrolls
     the Rounds region to the viewer's current Match (their next unplayed
     Match, or their last played one if they're out or the Bracket is
     Closed) and highlights that Match. Scrolling is smooth unless
     `prefers-reduced-motion` is on.
   - Truncated names in Matches stay as they are.
4. **Admin bottom bar: short tab labels in the app's sans font (112).**
   - `ADMIN_SECTIONS` in `src/lib/admin-sections.ts` gets an optional
     `tabLabel`, used only on the phone's bottom bar: "Points" for
     Discretionary points and "News" for Announcements. The side column,
     the More Sheet, page titles and `aria-label`s keep the full label.
     Each shortened tab gets the full label as its accessible name.
   - The bar's labels are set in Inter (`--font-preset-sans`) whatever the
     War Week's font preset, so a wide preset can't push a tab off screen.
     The rest of the page keeps the theme font.
5. **Finale Standings: count down the top 10, then say how many more
   (113).**
   - The Standings countdown slide shows and counts down only rows ranked
     10 or better. All rows tied at 10th are included, so the slide may
     hold more than 10 rows. The rows come from Standings unchanged, in the
     same order and with the same totals and ranks. The Finale never
     reorders or recomputes Standings (planning policy).
   - Under the last row: "…and N more Participants scored" (or Teams, in a
     teams War Week), where N is the number of scorers left out. The line
     is hidden when N is 0.
   - The timing in `src/lib/finale.ts` is unchanged. It already finishes
     within `FINALE_MAX_MS` (8 s) and now gets at most about 10 steps.
     The issue's "about 17 s for 17 rows" is worth checking during
     planning. If it comes from the e2e's wait rather than the countdown,
     record that in the closeout.
   - The `/<edition>/leaderboard` page keeps showing everyone.

## Out of scope

- Grouping the roster by Team, roster pagination, server-side search.
- Round chips, showing later Rounds first, full names on hover in the tree.
- Multi-column Finale Standings, a faster pace past the top 10.
- Any change to the desktop admin side column.

## Acceptance criteria

All against `pnpm seed:demo:scale` (100 Participants, the 64-Entrant Ping
Pong Bracket) unless noted, screenshotted at 1440 and 390 under
`test-results/e2e/regression-r24-*/`, with no sideways page scroll.

- [ ] **Roster.** As an Organizer on `/admin/roster`, Add Participant and
  Import are visible without scrolling. Typing part of a name past the 50th
  row shows that Participant and the "N of 100" count, and typing part of an
  email finds its Participant. A query matching no one shows the empty
  message (`regression-r24-roster`).
- [ ] **Bracket admin.** On Ping Pong Bracket's admin page with a Round 1
  result, there is no Round 1 Preview list. The Entrants and Seed Positions
  are collapsed under one trigger with the count, open by keyboard, and the
  lock reason is visible while collapsed. On an unlocked Bracket both
  sections are expanded. The page's height at 1440 before and after is
  recorded in the closeout, and the spec bounds it below 70% of before
  (`regression-r24-bracket-admin`). *Amended 2026-10-04, approved by Paul:
  was "at least half as tall"; the rest is the 64-Entrant tree itself.*
- [ ] **Bracket tree.** At 1440 the tree is wider than the page's text
  column and shows at least five Rounds without sideways scrolling. As a
  Participant who is an Entrant, "Jump to your Match" scrolls their Match
  into view inside the Rounds region and highlights it. As a Participant who
  isn't an Entrant, no button shows. The page never scrolls sideways at 390
  (`regression-r24-bracket-tree`).
- [ ] **Bottom bar.** In XI (monospace preset) and XII (sans preset) at
  390, an Organizer's five bottom-bar tabs are each fully inside the
  viewport (each tab's bounding box asserted), reading Competitions, Points,
  Schedule, News, More. Points and News have the full section names as their
  accessible names, and the side column at 1440 still reads "Discretionary
  points" and "Announcements" (`regression-r24-bottom-bar`). A vitest on
  `adminNavFor` covers `tabLabel`.
- [ ] **Finale.** With 100 scorers (the e2e gives every scale Participant a
  point and puts the data back afterwards, per Team rules), the Standings
  slide counts down to first place, shows only rows ranked 10 or better
  with ties at 10th included, and shows "…and N more" with the right N. A
  vitest proves the cut against Standings with a tie at 10th and with fewer
  than 10 scorers (no "more" line). The order and totals of the shown rows
  equal the leaderboard's top rows (`regression-r24-finale`).
- [ ] The existing e2e and smoke assertions these touch are updated, not
  removed. That covers the Bracket Preview, the bottom-bar labels and the
  Finale's "countdown ends on first place".
- [ ] `pnpm gate` passes.

## Definition of Done

- All acceptance criteria are `PASS`, and the evidence is committed under
  `test-results/`.
- `/about` copy and media are updated where they show a changed surface
  (Finale Standings, the admin bar), and `docs/maintainers-guide.md` too
  (Team rules).
- `docs/regression-checklist.md` lines for the Roster, Bracket admin,
  Bracket tree, admin bottom bar and Finale are updated (Team rules).
- Issues 109–113 are each set to `done` with a pointer to this spec, and
  `.scratch/backlog.md` moves them under Done.
- One PR from `feat/r24-scale` into `staging`.

## Comments

- 2026-10-04, orchestrator: two amendments approved by Paul during
  delivery. The Bracket admin height criterion now records heights (about
  12,000 → 7,662 px) instead of asking for half. "News" stays as the bar's
  short label, with a `CONTEXT.md` banned-terms exception. Also corrected
  "7 Rounds" to 6: a 64-Entrant Bracket has six. See
  [`execution.md`](./execution.md) `[SCOPE CHANGE]`.

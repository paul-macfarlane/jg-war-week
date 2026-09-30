# 31: Setup rows open in a Sheet

**What to build:** Teams, the Roster and Competitions list each row as one compact line; tapping it opens that row's existing form in a `ResponsiveSheetDialog`. One pattern at every width.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** mobile regression pass 2026-09-30 (ticket 18)

## Need

- **Organizer, Host:** Every row on the setup lists is an always-open inline form. On War Week XI at 375px the Teams & roster page (`/admin/setup/teams`, `src/components/teams-editor.tsx`) is 44,361px tall, about 55 screens, and Competitions (`/admin/setup/competitions`, `src/components/competitions-editor.tsx`) is 25,531px, about 31. Finding one Participant to fix their Team means scrolling past a hundred forms. On desktop it's the same wall of forms, only shorter.
- The Game and Heat Result forms already work this way (`src/components/game-form.tsx`, `src/components/heat-result-form.tsx` in `src/components/responsive-sheet-dialog.tsx`: a bottom Sheet below `lg`, a Dialog from `lg`).

## Decisions

- Same pattern on desktop; don't keep the inline forms at `md`+. One pattern is less code.
- Rows (a button named "Edit <name>", at least 44px tall below `sm`):
  - Team: color dot, name, usage summary (`usageSummary`).
  - Participant: display name, Company Tag, Team, the Leader Title when a Leader.
  - Competition: name, Group, Team Label or Individual, Format, Hosts (Organizers only), usage summary. The row's existing link to its Bracket or Games setup stays on the row, outside the edit button.
- The add row becomes an "Add <Team Label>" / "Add Participant" / "Add Competition" button that opens the empty form. "Add Competition" stays Organizer-only.
- The Sheet holds today's fields unchanged, with `SetupRowButtons` in a footer that stays visible while the fields scroll (`ResponsiveSheetDialogFooter`, sticky to the bottom of the Sheet).
- The Competition's Hosts field (`HostsField`) moves into its Sheet for Organizers. A Host still edits only the setup fields and can't add or delete.
- Days (`src/components/days-editor.tsx`) stays inline: two fields a row and a short page. Schedule and FAQ already list compact rows with their own edit pages; ticket 34 fixes their small controls.

## Acceptance criteria

- [ ] Teams, Roster and Competitions show compact rows as above; tapping one opens its form in a `ResponsiveSheetDialog` titled with the row ("Edit Team Red", "Edit Ana P", "Edit Cornhole").
- [ ] Save: success toast, the Sheet closes, the list refreshes. A refusal keeps the Sheet open with the typed values, shows the error under its field and focuses it (`useSetupRow`'s behaviour today).
- [ ] Delete from the Sheet asks in `ConfirmDialog` as today; afterwards the Sheet closes and focus moves to the next row's button, else the previous row's, else the Add button (`setupRowFocusTarget` in `src/lib/setup-row-focus.ts` and `focusNeighborOnceRemoved` in `src/components/setup-row.tsx` updated, with a unit test).
- [ ] Creating a Bracket or `games` Competition still goes straight to its setup page.
- [ ] On XI at 375px the Teams & roster page is under 11,000px tall and Competitions under 6,500px (a quarter of today's), measured in the e2e test.
- [ ] Smoke markers still hold (`aria-label="Roster"`, `aria-label="Competitions"` in `scripts/smoke/setup.ts`).
- [ ] `e2e/regression-r1.spec.ts` "r1 06 09" drives the Competition form through the Sheet.
- [ ] Playwright at 375px: open a Participant, change their Team, save, see the toast and the row update; a refused save keeps the Sheet open with the field focused; delete a row and focus lands on the next row. One screenshot of the list and one of the open Sheet at 375px and 1280px under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments

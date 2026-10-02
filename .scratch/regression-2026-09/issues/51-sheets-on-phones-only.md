# 51: Sheets on phones, dialogs from tablet up

**What to build:** `ResponsiveSheetDialog` switches from bottom sheet to centered dialog at **768px** (`md`) instead of 1024px. The Squad form (`bracket-builder.tsx`, a plain bottom `Sheet` at every width) moves onto `ResponsiveSheetDialog`. Audit every sheet, dialog and breakpoint-driven layout for drift and fix it; the bottom tab bars stay below 1024px.

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A8; grilling Q12

## Decisions

- Forms must keep their input across the switch (ticket 21's rule); re-check at the new breakpoint.
- The More menus stay bottom sheets (they belong to the tab bar).
- The audit result (each component, its breakpoint, fixed or why left) goes in the closeout.

## Acceptance criteria

- [x] At 390×844 the add-Participant form is a bottom sheet; at 820×1180 and 1440×900 it is a dialog. Same for the Squad form. Screenshots per viewport.
- [x] The existing "keeps input across the resize" e2e is updated to cross 768px and passes.
- [x] Closeout lists the breakpoint audit.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/113.

  Worker D51 (Sonnet), commit 6d34d98.
  - AC1 PASS. Add-Participant: bottom sheet at 390 (x=0, full width, bottom gap 0); centered dialog at 820 (x=154, w=512) and 1440 (x=464, w=512): test-results/r8-quick-fixes/sheet-dialog-participant-390/, -820/, -1440/. Squad form: same pattern: test-results/r8-quick-fixes/sheet-dialog-squad-390/, -820/, -1440/.
  - AC2 PASS: the `games.spec.ts` "keeps its input" step now widens 375 → 820, crossing 768. It is in `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).
  - AC3 PASS: breakpoint audit below.
  - AC4 PASS: `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).

  | Component | Breakpoint | Result |
  |---|---|---|
  | `ResponsiveSheetDialog` | `lg` → `md` (768px) | Fixed |
  | Squad form (`bracket-builder.tsx`, `squad-form.tsx`) | plain bottom Sheet at every width → `ResponsiveSheetDialog` (`md`) | Fixed |
  | `setup-row.tsx` (add-Participant, Teams, Competitions, other Setup rows) | `md` via the wrapper | Fixed by the wrapper |
  | `game-form.tsx`, `heat-schedule-form.tsx`, `heat-result-form.tsx`, `bracket-results.tsx`, `bracket-view.tsx` | `md` via the wrapper | Fixed by the wrapper |
  | `primary-nav.tsx` (member bottom tab bar + More Sheet) | `lg` (bar below 1024) | Left: the ticket keeps it |
  | `admin-bottom-bar.tsx` (admin tab bar + More Sheet) | `md` (bar below 768) | Left: admin moves to its side column at `md`; it was already `md` before this ticket |
  | `admin-shell.tsx` | `md` | Left: sidebar layout, not sheet vs dialog |
  | `ConfirmDialog` | none (always centered) | Left |
  | `date-range-picker.tsx` | `sm` (40rem) media query | Left: popover layout, not sheet vs dialog |
  | `calendar.tsx` | `md:flex-row` | Left: calendar layout |
  | `bracket-tree.tsx` | `md` | Left: tree vs round-by-round view |
  | admin announcements/points/awards lists | `md` | Left: card list vs table |
  | `ui/sheet.tsx` | `sm:max-w-sm` on side sheets | Left: no bottom-sheet breakpoint |
  | `install-instructions.tsx`, `color-field.tsx`, `use-finale.ts` | non-width queries | Left: unrelated |

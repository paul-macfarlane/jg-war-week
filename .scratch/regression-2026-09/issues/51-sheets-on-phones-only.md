# 51: Sheets on phones, dialogs from tablet up

**What to build:** `ResponsiveSheetDialog` switches from bottom sheet to centered dialog at **768px** (`md`) instead of 1024px. The Squad form (`bracket-builder.tsx`, a plain bottom `Sheet` at every width) moves onto `ResponsiveSheetDialog`. Audit every sheet, dialog and breakpoint-driven layout for drift and fix it; the bottom tab bars stay below 1024px.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A8; grilling Q12

## Decisions

- Forms must keep their input across the switch (ticket 21's rule); re-check at the new breakpoint.
- The More menus stay bottom sheets (they belong to the tab bar).
- The audit result (each component, its breakpoint, fixed or why left) goes in the closeout.

## Acceptance criteria

- [ ] At 390×844 the add-Participant form is a bottom sheet; at 820×1180 and 1440×900 it is a dialog. Same for the Squad form. Screenshots per viewport.
- [ ] The existing "keeps input across the resize" e2e is updated to cross 768px and passes.
- [ ] Closeout lists the breakpoint audit.
- [ ] `pnpm gate` passes.

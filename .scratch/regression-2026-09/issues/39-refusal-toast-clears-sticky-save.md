# 39: A refusal toast doesn't cover the sticky Save

**What to build:** On a phone, a toast shown after a refused save sits above the sticky Save row, not on top of it.

**Blocked by:** none

**Status:** in-progress

**Source:** Epic R5 follow-up (`../epics/R5-execution.md` [AI CODE REVIEW] T4), 2026-09-30

## Need

- **Organizer:** On `/admin/setup/war-week` at 375px, a refused save shows its error toast at the bottom, just above the section bar. The sticky Save row (`StickyFormActions`, ticket 33) sits in the same place, so the toast covers Save and the form's error line for its 4 seconds (`test-results/e2e/regression-r5-r5-33-*/settings-refused-375.png`). On a touch screen it clears on its own; with a mouse, Sonner keeps a hovered toast open, which is the failure behind the `bracket-squads` CI flake fixed in R5 D0.
- The setup Sheets' sticky footer (ticket 31) has a milder version of the same overlap.

## Decisions

- Below `md`, toasts clear whatever sticky actions the page shows, as they already clear the section bar (`--admin-bar-inset` in `src/components/admin-shell.tsx`). Options for planning: `StickyFormActions` publishes its height as a CSS variable the Toaster's `mobileOffset` adds; or toasts move to the top below `md` while a sticky actions row is on screen. Pick the smaller one; don't move toasts to the top everywhere.
- From `md`, nothing changes.

## Acceptance criteria

- [ ] At 375px on `/admin/setup/war-week`, a refused save's toast is entirely above the sticky Save row (bounding boxes don't overlap), and the error line under the field stays visible.
- [ ] The toast still sits above the section bar on admin pages with no sticky row (ticket 30's check still passes).
- [ ] From `md`, toasts are where they are today (screenshot compare).
- [ ] Playwright check and screenshot under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-30 (Paul): triaged `needs-triage` → `ready-for-agent`; delivered in Epic R6 (`../epics/R6-follow-ups-from-r5.md`).
- 2026-09-30: claimed, `ready-for-agent` → `in-progress`; branch `feat/regression-r6-follow-ups` from `staging` `d9b2a88`.

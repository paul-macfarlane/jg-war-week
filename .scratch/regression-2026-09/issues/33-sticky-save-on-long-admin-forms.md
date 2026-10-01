# 33: Save stays in reach on long admin forms

**What to build:** Below `md`, a long admin form's Save sits in a bar stuck to the bottom of the screen, above the admin section bar from ticket 30.

**Blocked by:** none (runs after 30 in Epic R5: the bar sits above 30's section bar)

**Status:** in-progress

**Source:** mobile regression pass 2026-09-30 (ticket 18)

## Need

- **Organizer:** At 375px the War Week settings Save button (`src/components/war-week-settings-form.tsx:496`) is about 3,160px down the page, four screens, and it doesn't move. Changing one color means scrolling to the bottom to save, then back up to check it.

## Decisions

- One small shared component in `src/components/` wraps a form's submit row: below `md` it's `sticky bottom-0` (offset by 30's bar and the safe area) with the page background and a top border; from `md` it renders as today. Built from the existing `Button`; no new dependency.
- Required on the War Week settings form. Also applied to any other `/admin` page form taller than two screens (1,624px) at 375px on XI data: measure `announcement-form.tsx`, `schedule-item-form.tsx`, `next-war-week-form.tsx` and `award-form.tsx`, and record the heights in the closeout. Forms in a `ResponsiveSheetDialog` are ticket 31's.
- This ticket owns `war-week-settings-form.tsx`, so it also makes its "Reset to derived" button (`size="xs"`, line 395) at least 44px tall below `sm`.

## Acceptance criteria

- [ ] At 375px on `/admin/setup/war-week`, Save is in the viewport at the top of the page and after scrolling to any field, and it doesn't cover 30's section bar.
- [ ] The last field and the form's error/status line can be scrolled clear of the bar (bottom padding), and a refused save's focused field isn't hidden under it (`scroll-margin-bottom`).
- [ ] From `md` the forms look as today.
- [ ] Each other form over 1,624px at 375px uses the same component; measurements recorded in the closeout.
- [ ] "Reset to derived" is at least 44px tall below `sm`.
- [ ] `e2e/forms.spec.ts` "the settings form refused on the server…" still passes; a new Playwright check at 375px scrolls the settings form and asserts Save is in view. Screenshot under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-30: claimed by `/atlas-implement` (work package `regression-r5`), `ready-for-agent` → `in-progress`; branch `feat/regression-r5-admin-on-a-phone` from `staging` `50acefb`. Execution record: `../epics/R5-execution.md`.

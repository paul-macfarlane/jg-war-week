# 34: Admin controls are 44px on a phone

**What to build:** Below `sm`, every small admin button, link and icon control has at least a 44x44px hit area. From `sm` they stay as they are.

**Blocked by:** none

**Status:** in-progress

**Source:** mobile regression pass 2026-09-30 (ticket 18)

## Need

- **Organizer, Host:** Measured at 375px: Edit links 29x16 on Schedule, FAQ up/down buttons 25x24, the rich-text toolbar (H1, H2, H3, B, I, •, 1., Link) 28px tall, combobox clear buttons 24x24. Delete, Pin/Unpin and the FAQ arrows are `size="xs"` (24px). Easy to miss or hit the wrong one with a thumb, and Delete sits next to Edit.

## Decisions

- Follow the existing phone pattern: a class that is 44px below `sm` and today's size from `sm`, as `ResponsiveSheetDialog`'s close does (`size-11 sm:size-8`) and setup buttons do (`min-h-11 sm:min-h-9`). For small icon buttons inside an input, widen the hit area with the `after:absolute after:-inset-2.5 sm:after:hidden` pattern already marked "JG War Week edit" in `src/components/ui/combobox.tsx:261`.
- Controls to fix:
  - `ConfirmActionButton`'s default `size = "xs"` (`src/components/confirm-dialog.tsx:106`): every Delete on the Points ledger, Awards, Announcements, Schedule and FAQ.
  - Pin/Unpin (`src/components/announcement-admin-buttons.tsx:28`).
  - FAQ up/down (`src/components/setup-schedule-faq-buttons.tsx:72` and `:81`).
  - Edit links on `src/app/admin/setup/schedule/page.tsx` and `src/app/admin/setup/faq/page.tsx`: `buttonVariants({ variant: "outline" })` like 32's.
  - Rich-text toolbar buttons (`src/components/rich-text-editor.tsx:71`) and its panel buttons (`:374`, `:380`).
  - Combobox clear and trigger (`src/components/ui/combobox.tsx:44`, `:73`), and the email chip remove (`src/components/jg-email-chips.tsx:74`), via the `after:` hit area, each commented "JG War Week edit".
- Out of scope: the Edit links on Points, Announcements and Awards (ticket 32), "Reset to derived" (ticket 33), select trigger heights (ticket 35). `src/components/games-view.tsx:242` already uses `min-h-11 min-w-11 sm:min-h-0 sm:min-w-0`; leave it.

## Acceptance criteria

- [ ] At 375px each control above measures at least 44x44px (its bounding box, or its `::after` box for the icon buttons).
- [ ] At 1280px each renders at today's size (screenshot compare on `/admin/setup/faq` and `/admin/announcements/new`).
- [ ] Playwright at 375px measures one of each on `/admin/points`, `/admin/announcements`, `/admin/announcements/new`, `/admin/setup/schedule` and `/admin/setup/faq`. Screenshots under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-30: claimed by `/atlas-implement` (work package `regression-r5`), `ready-for-agent` → `in-progress`; branch `feat/regression-r5-admin-on-a-phone` from `staging` `50acefb`. Execution record: `../epics/R5-execution.md`.

# 85: Pointer cursor on everything clickable

**What to build:** Buttons, links, `[role=button]`, combobox and select items, tabs, switches and checkboxes show the pointer cursor; disabled ones show `not-allowed`. Tailwind v4 dropped the default, and `src/app/globals.css` has no rule (only `faq/page.tsx:29` sets one).

**Blocked by:** none

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Participant: cursor); grilling Q12

## Decisions

- One base-layer rule in `globals.css`, not per-component classes; remove `cursor-default` from combobox items (`src/components/ui/combobox.tsx:154`).

## Acceptance criteria

- [x] An e2e or unit check reads computed `cursor: pointer` on a button, a link, a combobox option and a tab, and `not-allowed` on a disabled button.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r15`): claimed with Epic R15; `ready-for-agent` → `in-progress`. Execution record: [`R15-execution.md`](../epics/R15-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r15`): done. One `:where(...)` rule in `src/app/globals.css` gives every clickable role the pointer and disabled ones `not-allowed`; `cursor-default` removed from combobox, select and dropdown-menu items. Review found `disabled:pointer-events-none` on Button, Toggle and TabsTrigger hid `not-allowed` from users, so those were removed (native `disabled` and Base UI's tab guard still block activation). Disabled menu and list items keep `pointer-events-none` and so the plain cursor; the guide and checklist say so. e2e `e2e/regression-r15-cursor.spec.ts` reads computed cursors and checks `elementFromPoint` hits the disabled button.

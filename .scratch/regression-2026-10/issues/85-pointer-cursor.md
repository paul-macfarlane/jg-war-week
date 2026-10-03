# 85: Pointer cursor on everything clickable

**What to build:** Buttons, links, `[role=button]`, combobox and select items, tabs, switches and checkboxes show the pointer cursor; disabled ones show `not-allowed`. Tailwind v4 dropped the default, and `src/app/globals.css` has no rule (only `faq/page.tsx:29` sets one).

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Participant: cursor); grilling Q12

## Decisions

- One base-layer rule in `globals.css`, not per-component classes; remove `cursor-default` from combobox items (`src/components/ui/combobox.tsx:154`).

## Acceptance criteria

- [ ] An e2e or unit check reads computed `cursor: pointer` on a button, a link, a combobox option and a tab, and `not-allowed` on a disabled button.
- [ ] `pnpm gate` passes.

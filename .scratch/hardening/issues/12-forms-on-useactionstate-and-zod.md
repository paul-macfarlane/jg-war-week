# 12: Forms on `useActionState` + Zod

**What to build:** ADR 0004. Move the admin forms that manage state by hand (`useState` plus `startTransition`) to `useActionState`, with one Zod schema per action shared by client and server. Supersedes `.scratch/war-weeker/issues/18`.

**Blocked by:** 03, 04, 13

**Status:** ready-for-agent

## Scope

The components that use `startTransition` today:
- `announcement-form`
- `award-form`
- `bracket-builder`
- `bracket-results`
- `faq-item-form`
- `next-war-week-form`
- `points-entry-form`
- `schedule-item-form`
- `setup-row`
- `war-week-settings-form`
- the button groups: `announcement-admin-buttons`, `setup-schedule-faq-buttons`, `war-week-lifecycle-controls`
- `admin-edition-switcher`
- `confirm-dialog`

Button-only actions and `ConfirmDialog` may keep `startTransition` if `useActionState` adds nothing. Record which ones are kept, and why.

- One helper turns Zod issues into per-field errors, shown with shadcn `Field` error slots.
- Toasts stay the success signal. Wording is consistent ("saved", not a mix of "added" and "saved").
- Accessibility carry-overs from custom-inputs Phase B:
  - `FieldLabel`s beside the rich-text editor label nothing
  - the editor's link and image panels use raw labels
  - the Participants picker's `aria-label` hides "(n chosen)"
  - `SuggestionCombobox` has no `id`
  - the settings form mixes id styles

## Acceptance criteria

- [ ] Every form component in scope uses `useActionState`, or has a recorded reason not to.
- [ ] A field error from the server shows under its field, and focus moves to the first invalid field (Playwright on the settings and Points Entry forms).
- [ ] `pnpm gate` passes.

## Comments

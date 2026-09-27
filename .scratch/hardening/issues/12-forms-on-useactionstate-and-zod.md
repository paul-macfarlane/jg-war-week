# 12: Forms on `useActionState` + Zod

**What to build:** ADR 0004. Move the admin forms that manage state by hand (`useState` plus `startTransition`) to `useActionState`, with one Zod schema per action shared by client and server. Supersedes `.scratch/war-weeker/issues/18`.

**Blocked by:** 03, 04, 13

**Status:** in-progress

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

### [PROGRESS] 12-AC1 keep-list

Kept on `startTransition`, with the reason (D1b, after converting
`announcement-form`, `award-form`, `faq-item-form`, `schedule-item-form` and
`setup-row` — the rest of the in-scope list — to `useActionState`):

- `confirm-dialog` (`ConfirmActionButton`), `announcement-admin-buttons`
  (Pin/Unpin), `setup-schedule-faq-buttons` (Move up/down),
  `admin-edition-switcher`, the Start/Reopen buttons in
  `war-week-lifecycle-controls`: buttons with no fields; `useActionState`
  adds nothing.
- `bracket-builder`: Format select, Entrants save, Generate and Clear are
  button-driven with a confirm-and-retry (`force`) loop and whole-form
  refusals; no per-field error exists to show. (Only its Entrants picker's
  accessible name changed in D1b, to include "(n chosen)".)
- `bracket-results`: a Heat Result is a winner button plus Save, gated by a
  reset confirm; its refusals are about the Heat, not a field.
- `organizers-editor` is not in ticket 12's list; `competitions-editor`,
  `days-editor`, `teams-editor` change only as callers of `useSetupRow`
  (each row's own `<form>` now posts through `useActionState`; Delete stays
  a transition inside the hook since it has no fields).
- `ConfirmDialog` keeps its optional `form` prop (from D0), so a dialog can
  submit a `useActionState` form instead of calling `onConfirm` directly.

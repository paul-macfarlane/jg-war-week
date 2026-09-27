# 12: Forms on `useActionState` + Zod

**What to build:** ADR 0004. Move the admin forms that manage state by hand (`useState` plus `startTransition`) to `useActionState`, with one Zod schema per action shared by client and server. Supersedes `.scratch/war-weeker/issues/18`.

**Blocked by:** 03, 04, 13

**Status:** done

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

Every file `grep -ln startTransition src/components/*.tsx` lists, and why:

- `confirm-dialog` (`ConfirmActionButton`, which the Start/Reopen buttons in
  `war-week-lifecycle-controls` use), `announcement-admin-buttons`
  (Pin/Unpin), `setup-schedule-faq-buttons` (Move up/down),
  `admin-edition-switcher`: buttons with no fields; `useActionState` adds
  nothing.
- `bracket-builder`: Format select, Entrants save, Generate and Clear are
  button-driven with a confirm-and-retry (`force`) loop and whole-form
  refusals; no per-field error exists to show. (Only its Entrants picker's
  accessible name changed in D1b, to include "(n chosen)".)
- `bracket-results`: a Heat Result is a winner button plus Save, gated by a
  reset confirm; its refusals are about the Heat, not a field.
- `competitions-editor` `HostsField` "Save Hosts": a single button that
  saves the chip list as a whole; its refusal is about the list, shown under
  it. (Each Competition row itself posts through `useSetupRow`.)
- `organizers-editor`: not in ticket 12's list.

Not in the grep: `days-editor`, `teams-editor` and the `competitions-editor`
rows change only as callers of `useSetupRow` (each row's own `<form>` now
posts through `useActionState`; Delete stays a transition inside the hook,
in `setup-row.tsx`, via `useTransition`, since it has no fields).
`ConfirmDialog` keeps its `form` prop (from D0), so a dialog can submit a
`useActionState` form instead of calling `onConfirm` directly.

### [AI CODE REVIEW] Epic D (2026-09-27)

Two independent reviewers (opus) read `1c4d76d..136e5ba`; the orchestrator adjudicated each finding against the cited hunks. Fixes in R1 `72a8620`.

**Implementation and spec conformity**
- F1 **blocking**, resolved: the dark-scrollbar change put `color-scheme` on ThemeRoot (a non-scrolling div) while `:root` was forced `light`, so the viewport scrollbar stayed light (before/after screenshots were byte-identical). Now the edition layout's root carries `data-color-scheme`, `html:has([data-color-scheme="dark"])` lifts it; `e2e/theme.spec.ts` proves `/xi` dark, `/x` and `/history` light.
- F2 resolved: a refused setup-row Delete's error never cleared and masked later Saves.
- F3 resolved: React 19's post-action form reset blanked a focused `type="number"` Points input on an Enter-submitted refusal; Points is `type="text" inputMode="decimal"`, and the forms e2e submits with Enter and checks the value survives.
- F4 resolved: video links and Placement Points errors sat outside a `Field data-invalid` (no focus, no `aria-invalid`); rich-text fields focused the Bold button, now the editor.
- F5 resolved: unit tests for `fieldErrorsOf`, `formErrorOf`, `participantCountLabel`, `formatPointsLabel` (now worded from the shown number). **Deviation approved:** no e2e submits End War Week or Create next War Week (it would end or create a War Week mid-suite); smoke covers the actions and `ConfirmDialog`'s props are now a discriminated union.
- F6 resolved: End War Week's refusal no longer survives Cancel and reopen.
- F7 resolved: the rich-text label is `FieldTitle` (not a `<label>` labelling nothing).
- F8 resolved: Save Hosts added to the 12-AC1 keep-list; ticket 14 closeout below.
- F9 resolved: author matching uses `sameEmail` (now exported; `null` never matches).
- Coverage judged sufficient: the reviewer read every converted form, the helper and all ticket 14 items.

**Coding standards**
- S1 resolved: "member" (banned) in a comment → "Participant count".
- S2–S5 resolved: comments wrongly said MCP shows the author email (it shows the handle); one `authorHandle` and `AuthorCandidate` in lib shared by MCP and queries; dead re-export removed.
- S6 resolved: ADR 0004 "Built" section and a guide sentence record server-only validation and when a form closes over state vs reads `FormData`.
- S7 **deviation approved**: per-field `Field`/`aria-invalid`/`FieldError` wiring stays explicit, so each field visibly owns its error.
- S8–S10 resolved: `NextWarWeekActionResult` exported; settings input built key by key (no cast); `ConfirmDialog` union.
- S11 **deviation approved**: `expectRefused` stays local to each test file, as existing tests do.
- S12–S16 resolved: keep-list, `about-media.ts` header, import merge, CONTEXT.md author-display rule, duplicate skeleton PNGs removed.

Remaining risks: headless Chromium draws overlay scrollbars, so the scrollbar proof is the computed `color-scheme` on `<html>`, not pixels; admin and sign-in pages don't follow a dark theme (only the edition pages are themed wholesale).

### [CLOSEOUT] Ticket 12 (2026-09-27)

Branch `feat/hardening-d-forms-and-polish`, PR https://github.com/paul-macfarlane/jg-war-week/pull/81. Verified `pnpm gate` on `72a8620` (local Postgres 17, Chromium): exit 0; 82 files / 1411 tests; smoke 177 ok, 0 FAIL; e2e 22 passed — `test-results/hardening-d-gate/gate.txt`.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC1 every in-scope component on `useActionState` or a recorded reason | PASS | `test-results/hardening-d-docs/grep.txt` (converted and kept lists match the `[PROGRESS] 12-AC1 keep-list` above) |
| AC2 server field error under its field; focus on the first invalid field (settings, Points Entry) | PASS | `e2e/forms.spec.ts` (2 tests, in the gate run); `test-results/e2e/forms-*/` |
| AC3 `pnpm gate` | PASS | `test-results/hardening-d-gate/gate.txt` |
| Helper and parsers' field maps (unit) | PASS | `test-results/hardening-d-d0/vitest.txt`; gate run |
| Toast wording "saved"; accessibility carry-overs | PASS | aggregate review (both axes) |

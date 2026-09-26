# 18: Standardize form handling (post-hackathon)

**What to build:** Replace the hand-rolled `useState` form state in the admin forms with one standard approach, most likely React Hook Form with the Zod schemas the app already has (`@hookform/resolvers/zod`), so validation, field errors, dirty/submitting state, and server-action wiring work the same way everywhere. Raised in an earlier code review.

**Blocked by:** none (but do this only after the hackathon submission on Fri 2026-09-25 10:00 AM; judges won't see the difference)

**Status:** wontfix (superseded by `.scratch/hardening/issues/12`)

## Scope (forms today)

- `src/components/announcement-form.tsx`
- `src/components/award-form.tsx`
- `src/components/points-entry-form.tsx`
- `src/components/rich-text-editor.tsx` (needs a controlled-field adapter so it plugs into the form library)

Not in scope: non-form UI state such as `reveal-standings.tsx`, `standings-visibility-controls.tsx`, and `auth-buttons.tsx`.

## Open questions to triage

- React Hook Form, or lean on React 19 / Next server-action primitives (`useActionState`, `useFormStatus`) plus Zod, without a new dependency?
- Share one Zod schema between client validation and the server action for each form?
- A thin shared `Form`/`Field` wrapper (shadcn `form` component) or use the library directly?
- Behavior must not change: same fields, same validation messages, same redirects after save. What test coverage proves that before the refactor?

## Comments

- 2026-09-26: Superseded. The open question is decided in ADR 0004 (`useActionState` + Zod), and the work is `.scratch/hardening/issues/12`.

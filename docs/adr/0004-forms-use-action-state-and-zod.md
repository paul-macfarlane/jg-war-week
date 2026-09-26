# ADR 0004: Forms use `useActionState` with shared Zod schemas, not a form library

- Status: accepted (built in `.scratch/hardening/issues/12`; supersedes the open question in `.scratch/war-weeker/issues/18`)
- Date: 2026-09-26

Admin forms post a `FormData` to their server action through React's
`useActionState`. One Zod schema per action is shared by the client, for
field errors, and by the server, for the real check. A small helper turns Zod
issues into per-field errors.

We don't add React Hook Form. The shadcn wrappers (`EntityCombobox`,
`DatePicker`, `TimeCombobox`, `ColorField`, …) already post named hidden
inputs, so native form posts work without a library. The forms are small, and
another dependency with its own state model would be one more thing for a
single maintainer to keep up to date.

Before this, 15 components managed form state by hand with `useState` and
`startTransition`, each validating in its own way.

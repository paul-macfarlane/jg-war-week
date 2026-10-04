# ADR 0008: Test sign-in

- Status: accepted (built in Epic R10, work package regression-r10)
- Date: 2026-10-02

## Context

Sign-in is Google only, so a maintainer cannot test as a Participant, Host
or Organizer without a real Google account for each. The need is to test the
entry flow and the app as a non-admin, on staging, with real behavior.

## Decision

**Test sign-in** is a maintainer tool at `/sign-in/test`: type an
`@jahnelgroup.com` email (`+` aliases included) and a secret, and you get a
real session for that address.

**Three gates**, all checked on every request in `src/lib/test-sign-in.ts`
(`testSignInEnabled`, `testSignInRefusal`):

1. `TEST_SIGN_IN_SECRET` is set and **at least 32 characters**. A shorter
   one leaves Test sign-in off.
2. `VERCEL_ENV` is not `production`.
3. The typed secret matches (a `timingSafeEqual` over SHA-256 digests) and
   the email is a Jahnel Group email.

The gate is **not keyed on `NODE_ENV`**: smoke and e2e run `next start`,
which is "production" to Node. `VERCEL_ENV` says whether this is the
deployed production site. The secret is set on the staging Vercel
environment only, never on production. PR previews have no Vercel
environment, so they have no secret and Test sign-in stays off. When off,
the page is a 404 and the action refuses.

**Session column, banner and kill switch.** The session is marked in
`session.test_sign_in` (migration 0018, written only by Test sign-in).
Every page shows a "Test sign-in: <email>" banner. Removing the secret is
the kill switch: **a Test sign-in session counts as anonymous once Test
sign-in is off**, everywhere (`getSessionIdentity`): pages, the proxy (which
redirects to sign-in) and MCP. `/sign-in` redirects on the same identity, so
a disabled session cannot loop.

**Later Google sign-in links.** Test sign-in creates users with
`emailVerified: true`. better-auth refuses to link Google to an existing
user whose email is unverified (`requireLocalEmailVerified`), so without
this a person who was tested as would be locked out of Google. This adds no
takeover path: anyone with the secret can already sign in as that address,
and the gate keeps the code inert in production. The production better-auth
config is otherwise unchanged (apart from `/update-user` in ADR 0007).

**No impersonation.** A "View as" for Organizers was planned and dropped:
Test sign-in tests real behavior as that person, with their real access and
their real session, and View as was the riskiest access change for a
marginal benefit. Revisit only if Organizers need to debug a real person's
view in production.

## Consequences

- Testing as a Participant, Host or Organizer is a `+` alias away; adding the
  alias at `/admin/organizers` makes it an Organizer.
- Test users are real `user` rows, and Delete my account removes them like
  any other.
- A leaked secret is contained to non-production. Removing it makes every
  test session anonymous while it stays removed. Setting any secret again
  revives the unexpired ones: sessions don't record which secret made them,
  and `sessionIdentity` only rejects them while Test sign-in is off. To
  rotate, or after a suspected leak, delete the test sessions on the staging
  database (`delete from session where test_sign_in;`), then set the new
  secret.

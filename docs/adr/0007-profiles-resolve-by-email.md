# ADR 0007: Profiles resolve by email

- Status: accepted (built in Epic R10, work package regression-r10); superseded in part by ADR 0013
- Date: 2026-10-02
- Superseded in part by ADR 0013 (Remove the MCP): its MCP mentions, including "MCP returns names only" (there is no MCP).
- Extends: ADR 0001 (reads and writes stay in `src/queries` and `src/mutations`)

## Context

A Participant is a roster record an Organizer typed in, and its display name
is whatever the Organizer typed. People want to say how their own name shows
and to have a picture. The same person appears in many places (roster,
Standings, Brackets, Games, Awards, Announcements, Host names, MCP), and in
every War Week they were ever on. Copying a name onto each of those rows
would drift the moment it changed.

## Decision

A **Profile** is a person's own **Profile name** and **picture URL**, stored
once in a `profile` table keyed by lowercase email (not columns on `user`:
better-auth writes `user`, a Profile resolves for a Participant who never
signed in, and Delete my account removes it explicitly).

1. **The Profile overrides the roster name everywhere, by email, in every
   War Week**, past ones included. The roster `display_name` stays saved as
   the fallback and is what an Organizer edits. An empty Profile name means
   the roster name shows. The Organizer's roster form shows a set Profile
   name read-only, with "Set by the person".
2. **One resolver, in two forms, and no copies.** `src/queries/profile-join.ts`
   is the SQL form (`withProfile` left-joins `profile` and `user` on
   `lower(participant.email)`; `participantNameSql`, `participantImageSql`).
   `src/lib/profile.ts` is the pure TS form (`resolveProfile`,
   `profilesByEmail`) for the callers keyed by email alone: an
   Announcement's author, Host names, the account menu. Both hold the same
   rules, and no surface stores a resolved name or picture.
3. **The picture** is the Profile's picture URL, else the Google photo
   (`user.image`), else initials. The Google photo counts only when its URL
   starts with `https://lh3.googleusercontent.com/`; any other `user.image`
   is ignored. A Profile picture URL must be `https://`.
4. **better-auth's `/update-user` endpoint is disabled** (`disabledPaths`).
   Otherwise any signed-in user could set `user.image`, which now shows
   app-wide, to any string. The Google-photo rule above is the second guard.
5. **Pictures are URLs for now.** There is no upload and no Blob storage. A
   picture URL is loaded from its own host, which sees viewers' IP addresses
   (said on Privacy). Uploads can come later, with their own decision.
6. **MCP returns names only**, never emails, as before.

**Seed policy.** No seed change. Seeds carry no accounts and no Profiles, so
there is nothing in the seed to update alongside migration 0019, which meets
the policy of updating the demo seed and migration together. Both seed runs
(with `--reset`, then plain) prove idempotence with the migration applied.

## Consequences

- A person's name and picture change in one place and every surface follows,
  including the Archive.
- Anyone on a roster with an email can have a Profile before they ever sign
  in, but only a signed-in person can write theirs, and only their own
  (`profile.save`, a self action keyed on the actor's email).
- Every new surface that shows a person must go through the resolver. A
  surface that reads `display_name` directly is a bug.

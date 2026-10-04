# ADR 0012: Hosts are roster Participants

- Status: accepted (built in Epic R22, work package people-and-admin)
- Date: 2026-10-04
- Supersedes in part: ADR 0002 (its Host storage as an email, "A Host doesn't have to be a Participant", "Create next War Week copies Hosts" and the Host's Schedule Item and Announcement rights)
- Extends: ADR 0007 (email matching, case-insensitive)

## Context

A Host was stored as an email (`competition_host.email`), so an Organizer
could not make someone a Host until that person had an email on the
roster, and a Host chosen from the roster still carried a second copy of
their email. Hosts could also open Schedule, Announcements and the Finale
admin pages, none of which a Host needs to run one Competition. Regression
feedback "10/3" (items 5.2 and 5.4) asked that a Host be a person on the
roster, and that Hosts see only what is theirs.

## Decision

### A Host is a roster Participant

`competition_host` holds `participant_id` (a foreign key to `participant`,
cascade delete), not an email, and `(participant_id, competition_id)` is
unique, participant first. The Participant must be on the Competition's War
Week roster. As with Placements, Brackets and Participation, that is a
**write-time rule in the Host mutation** (`setCompetitionHosts`), not a
database constraint; a vitest proves a Participant from another War Week is
refused.

Any roster Participant may be chosen, with or without an email. A
Participant whose roster email is not `@jahnelgroup.com` can be chosen too
and is marked "Can't sign in" in the picker, which never shows an email: no
picker option, keyword or page payload carries one. They never get access,
because sign-in is unchanged (Google only, `@jahnelgroup.com` only) and the
Host lookup refuses any other domain.

### Access is worked out at request time

A signed-in session is a Host of a Competition when its email matches,
ignoring case (as Account linking, ADR 0007), the email of a roster
Participant of that Competition's War Week who hosts it. Nothing about the
Host is copied into the session or cached: `getActor` reads it per request.

**Consequence: changing a Participant's roster email moves their Host
access to whoever owns the new email.** A Host chosen before they have an
email gets access once an Organizer adds one in Roster and they sign in;
removing or changing the email removes it. Organizers who edit a roster
email should know a Host's access follows it.

### What a Host can see in admin

A Host who is not an Organizer sees only **Competitions** (the list
filtered to the Competitions they host, plus each one's admin page) and the
**Guide**. Schedule, Announcements and the Finale become Organizer-only,
and the server enforces it as for the other Organizer-only areas: the pages
use the Organizer-only gate (`src/app/admin/gate.ts`), the nav hides them
(`src/lib/admin-sections.ts`), and `can` in `src/lib/access.ts` refuses a
Host the Schedule Item, Announcement and Finale actions. A Host opening
another Competition's admin page gets the refusal page. Organizers are
unchanged. The War Week Finale at `/<edition>/finale` stays readable by any
signed-in JG user. This removes the Host's rights to link Schedule Items and
to post, edit and delete their own Announcements (ADR 0002).

### No Host copy-forward

Create next War Week no longer copies Hosts. The new War Week has an empty
roster, so there is no Participant to point at. Organizers add Hosts once
the roster exists. Seeds name a Host by the Participant's display name from
the same seed; the loader refuses a name not on that War Week's roster and
never removes a Host an Organizer added.

### Unchanged

MCP still never returns Host lists or emails. Organizers stay a typed email
on a global list: they needn't be on a roster.

## Considered options

- **Keep the email and add a Participant link.** Rejected: two sources of
  truth, and a Host still could not be chosen without an email.
- **A database constraint for the same War Week.** Rejected: the repo
  enforces cross-row rules at write time (Placements, Brackets,
  Participation), and the constraint would need a composite key on
  `participant`.
- **Keep Hosts' Schedule and Announcements rights.** Rejected: a Host runs
  one Competition; the Schedule and Announcements are the Organizers' voice
  for the whole War Week.

## Consequences

- One migration (`0033`) reshapes `competition_host`. XII is test data, so
  existing Host rows are deleted rather than converted; staging and
  production are reset and reseeded after merge.
- ADR 0002 carries a "Superseded in part" line pointing here.
- `CONTEXT.md` (Host, Access rules for Hosts), the maintainers' guide and
  the regression checklist say Hosts are roster Participants and see only
  Competitions and the Guide.

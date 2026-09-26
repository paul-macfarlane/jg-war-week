# ADR 0002: Global Organizers and per-Competition Hosts

- Status: accepted (built in `.scratch/hardening/issues/03`)
- Date: 2026-09-26
- Context: post-hackathon grilling session

## Context

At the hackathon, each War Week had its own `organizerEmails` allowlist, and
Organizer was the only role that could write. Several rules existed only to
patch around that per-edition list:

- current Organizers could also edit `complete` editions
- "Create next War Week" copied the Organizers forward
- an Organizer couldn't remove their own email

The self-email guard broke corrections to past War Weeks: a current
Organizer who isn't on an old edition's list couldn't save its settings.

The old wikis show two groups actually run War Week. Jason and JZ run the
whole thing, year after year. About 55% of Competitions from 2021 to 2026
were "hosted by" someone else, often the same person every year (Tony M runs
Catan, Tom O'Neill runs MTG). The app had no place for that second group.

## Decision

Three roles:

| Role | Scope | Can |
|---|---|---|
| **Organizer** | Global: one list across every War Week, stored in the database and managed by Organizers in `/admin` | Everything, in every War Week |
| **Host** | Per Competition: an Organizer assigns JG emails to a Competition | Everything on that Competition (setup including scoring and Placement Points, its Bracket, its Points Entries, its Schedule Items); post Announcements and edit or delete their own |
| **Participant** | Any signed-in JG user | Read |

- The per-edition `organizerEmails` list is removed. The migration seeds the
  global list from the current War Week's `organizerEmails`.
- The last Organizer can't be removed.
- A Host doesn't have to be a Participant.
- "Create next War Week", when it copies Competitions, copies their Hosts too.
- Organizer-only: creating or deleting Competitions, assigning Hosts, Teams,
  Participants, Awards, FAQ, War Week settings and lifecycle, and the
  Organizer list.
- Hosts work in the same `/admin` pages, trimmed to their Competitions.
  "Admin" is the name of that area, never a role.
- One `can(actor, action, target)` rule in `src/lib/access.ts` decides every
  write.

Google-only sign-in and the `@jahnelgroup.com` restriction are unchanged.

## Considered options

- **Keep per-edition Organizers and add Hosts.** Rejected. It keeps the
  archive-edit exception, the copy-forward rule and the self-lockout guard,
  all of which exist only because the list is per edition.
- **Name the top role "Admin".** Rejected. Hosts use the `/admin` area too,
  so a Host would click "Admin" without being one. It would also rename about
  39 files.
- **Name the middle role "Organizer" or "Assistant".** Rejected. "Organizer"
  sounds bigger than one Competition. "Assistant" reads as an AI assistant in
  an app that ships an MCP server, and suggests helping someone rather than
  owning a Competition. The wikis say "hosted by" 134 times and "organizer"
  once.
- **Keep Organizers in an env var.** Rejected. Changing it needs a redeploy,
  so Jason couldn't manage it himself.

## Consequences

- "Organizer" now means a global role, not "on this edition's list". Code and
  copy that assume per-edition Organizers change in the same refactor.
- Access and schema both change, so the plan needs a red-team review
  (`docs/agents/planning.md`), and the demo seed changes with the migration.

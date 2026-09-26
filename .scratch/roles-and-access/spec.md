# Spec: Organizers, Hosts and the write target

**Status:** ready-for-agent

**Source:** ticket `.scratch/hardening/issues/03-roles-and-access-consolidation.md`, ADR 0002 (global Organizers and per-Competition Hosts), ADR 0003 (actions take their War Week from the request). Delivered in Epic B (`.scratch/hardening/epics/B-access-and-action-layer.md`) with tickets 04, 08 and 10.

**Red-team:** required before implementation. This spec changes the Drizzle schema and the access rule (`docs/agents/planning.md`). Ticket 10's migration is reviewed in the same pass. The first review (2026-09-26) returned 1 blocking finding, 4 warnings and 7 minors, all addressed in this revision; see ticket 03's comments.

## Problem Statement

Jason and JZ run War Week every year, but the JG War Week app only knows each War Week's own `organizerEmails` list. That causes four problems:

- **Correcting a past War Week fails.** Saving its settings says "You can't remove your own email…" whenever the current Organizer isn't on that old edition's list.
- **A save can land on the wrong War Week.** Creates and the settings save write to whichever edition the `admin_edition` cookie names at submit time. With two tabs open, switching edition in one and saving in the other overwrites a different War Week's settings.
- **Hosts have no place.** About half of past Competitions were "hosted by" someone other than the Organizers, often the same person every year (Tony M runs Catan, Tom O'Neill runs MTG). A Host either gets full Organizer rights to one War Week or has to ask an Organizer to enter every result.
- **Small access bugs.** The Admin link only shows for Organizers of the current War Week. Setup input is parsed before the Organizer check. The Bracket admin pages drop the edition switcher.

## Solution

**Organizers** become one global list, stored in the database and managed by Organizers in `/admin`. Every Organizer can change everything in every War Week, so the exceptions that patched the per-edition list go away. **Hosts** are JG emails an Organizer assigns to a Competition. A Host runs that Competition, including its setup, Bracket, Points Entries and linked Schedule Items. A Host can also post Announcements for its War Week and edit or delete their own. Hosts use the same `/admin` pages, trimmed to what they can do.

One rule, `can(actor, action, target)`, decides every write and every admin page. Every server action takes its War Week from the row it changes or from a `warWeekId` the form posts. The server checks that War Week with `can`, and the order is always: authenticate, load the target, `can`, parse input, mutation. The `admin_edition` cookie only chooses what `/admin` shows.

Google-only sign-in and the refusal of non-`@jahnelgroup.com` emails are unchanged. MCP never exposes emails, the Organizer list or any Host list.

## User Stories

### Organizers

1. As an Organizer, I want to be an Organizer of every War Week at once, so that I don't have to add myself to each edition's list.
2. As an Organizer, I want to correct a past War Week's settings, Winner and highlights, so that the Archive stays accurate without a "remove your own email" error.
3. As an Organizer, I want to see the Organizer list in `/admin`, so that I know who else can change everything.
4. As an Organizer, I want to add a JG email to the Organizer list, so that JZ or a new co-organizer can help run War Week without a redeploy.
5. As an Organizer, I want adding a non-`@jahnelgroup.com` email to be refused, so that nobody outside JG is given access.
6. As an Organizer, I want adding an email that is already on the list to be refused (ignoring case), so that the list has no duplicates.
7. As an Organizer, I want to remove another Organizer, behind a confirm, so that people who've moved on lose access.
8. As an Organizer, I want to remove myself when another Organizer remains, so that I can hand War Week over.
9. As an Organizer, I want removing the last Organizer to be refused, so that nobody can lock everyone out of `/admin`.
10. As an Organizer, I want to assign Hosts to a Competition on its setup page, so that the person who runs Catan can enter its results.
11. As an Organizer, I want Host emails validated as JG emails and deduplicated, ignoring case, so that the Host list is clean.
12. As an Organizer, I want to remove a Host from a Competition, so that a Host who's stepped down can't keep changing it.
13. As an Organizer, I want "Create next War Week" with "Copy Competitions" on to copy each Competition's Hosts, so that Tony M hosts Catan again without re-entry.
14. As an Organizer, I want "Create next War Week" to stop offering "Copy Organizers", since Organizers are global.
15. As an Organizer, I want the lifecycle actions (Start, End, Reopen, Create next War Week) to be mine alone, so that a Host can't move a War Week's status.
16. As an Organizer, I want Start, End and Reopen to keep their existing status rules, so that one-live, "End XI first" and "reopen only the most recent" still hold now that every Organizer may run them.
17. As an Organizer, I want creating and deleting Competitions, Days, Teams, Participants, Awards, FAQ Items and War Week settings to stay Organizer-only, so that Hosts can't reshape the War Week.
18. As an Organizer, I want to pin and unpin any Announcement, and edit or delete any Announcement, so that I can moderate the feed.
19. As an Organizer, I want `/admin` to open on the current War Week and let me switch to any edition, so that I can manage any War Week.
20. As an Organizer, I want the Admin link in the navigation wherever I am, so that I can get to `/admin` from a past edition too.

### Write target

21. As an Organizer with two tabs open on different editions, I want each save to write to the War Week that tab's form was rendered for, so that switching edition in one tab never overwrites the other edition.
22. As an Organizer, I want a create (Day, Team, Participant, Competition, Schedule Item, FAQ Item, Award, Announcement) to post the War Week it belongs to, so that it lands in the edition I was looking at.
23. As an Organizer, I want the settings save to post the War Week it edits, so that it can never write to another War Week.
24. As an Organizer, I want a stale form whose War Week I can no longer change to be refused with a clear message, so that I'm not left guessing what happened.
25. As a maintainer, I want every action to authenticate, load its target, check `can`, and only then parse input, so that an unauthorized caller learns nothing from validation errors.
26. As a maintainer, I want actions to return a result for every refusal and never throw on one, so that forms always show a message.

### Hosts

27. As a Host, I want to sign in with my JG Google account and see an Admin link, so that I can find where to run my Competition.
28. As a Host, I want `/admin` to show only my Competitions and the pages I can use, so that I'm not confused by controls I can't use.
29. As a Host, I want to open `/admin` on the War Week where I host something (current first, then my earliest upcoming, then my newest past), so that I land in the right place.
30. As a Host, I want the edition switcher to list only the editions where I host a Competition, so that I can switch between my years.
31. As a Host, I want to edit my Competition's setup (name, description, max points, scoring, Counts Toward Team, Competition Group, Placement Points, Format), so that it's configured the way I run it.
32. As a Host, I want the existing Competition refusals (scoring change with Points Entries or Entrants, finalized Bracket) to apply to me too, so that I can't corrupt scoring.
33. As a Host, I want to set Entrants, generate, record Heat Results, reopen and finalize my Competition's Bracket, so that I can run the Bracket live.
34. As a Host, I want to add, edit and delete Points Entries on my Competitions, so that I can enter results myself.
35. As a Host, I want the Points Entry form and ledger to offer only my Competitions, so that I can't pick one I don't host.
36. As a Host, I want editing a Points Entry to be refused when it would move the entry to a Competition I don't host, so that I stay inside my own Competitions.
37. As a Host, I want to create, edit and delete Schedule Items linked to my Competitions, so that I can post qualifier and final times.
38. As a Host, I want a Schedule Item I create to require one of my Competitions as its link, so that the item stays mine to manage.
39. As a Host, I want changing a Schedule Item's link to a Competition I don't host (or to none) to be refused, so that I can't hand items to someone else.
40. As a Host, I want to post an Announcement for a War Week where I host a Competition, including "Also post to Slack", so that I can announce brackets and results.
41. As a Host, I want to edit and delete my own Announcements, so that I can fix typos.
42. As a Host, I want editing, deleting or pinning someone else's Announcement to be refused, so that I don't step on Organizers.
43. As a Host, I want every change to another Host's Competition refused with a clear message, so that Hosts don't overwrite each other.
44. As a Host, I want to see the Standings page in `/admin` and the guide, so that I can check the effect of my entries.
45. As a Host who is also a Participant, I want both to work: I keep my You highlight and I can run my Competition.
46. As someone who hosts but isn't a Participant, I want to be able to host anyway, so that a non-competing staffer can run a Competition.
47. As a former Host whose assignment was removed, I want my next action to be refused, so that access follows the current assignment and not what I loaded earlier.

### Participants and visitors

48. As a Participant with no role, I want `/admin` to say it's for Organizers and Hosts, so that I know why I can't get in.
49. As a Participant, I want the Admin link hidden, so that the navigation isn't cluttered with a place I can't use.
50. As a Participant, I want every write action to refuse me, so that nobody can script around the UI.
51. As an anonymous visitor, I want `/admin` to send me to sign-in and bring me back, as it does today.
52. As someone with a non-JG Google account, I want sign-in refused, as today.
53. As an MCP client, I want tools to keep returning only what a Participant sees, never an Organizer or Host email.

### Maintainers and data

54. As a maintainer, I want one migration set that creates the Organizer and Host tables and fills the Organizer list from the current War Week's `organizerEmails`, leaving the old column for a later drop, so that production keeps its current War Week's Organizers and a rollback still works.
55. As a maintainer, I want a fresh database loaded with `pnpm seed:all` to end up with an Organizer, so that local development and CI can use `/admin`.
56. As a maintainer, I want a seed's Organizers to be added only when missing and never removed, so that reloading a seed never takes someone's access away.
57. As a maintainer, I want CONTEXT.md's "Access rules" and "War Week lifecycle rules" rewritten, with the "Changing" note removed, so that the glossary matches the code.
58. As a maintainer, I want `/about`, the Organizer guide and `docs/maintainers-guide.md` to describe Organizers and Hosts, so that Jason can hand out Host access himself.
59. As a maintainer, I want smoke to prove that a Host is refused outside their Competition and that a create posted for one edition writes that edition whatever the cookie says, so that the wiring is checked end to end.

## Implementation Decisions

### Roles and schema

- **Organizer table.** One row per email: the JG email (unique), when it was added, and who added it. "Who added it" is nullable: rows copied by the migration or inserted by a seed load leave it null. There's no per-War Week column: an Organizer is an Organizer everywhere.
- **Competition Host table.** One row per (Competition, email): the JG email, unique per Competition, cascading when the Competition is deleted. A Host needn't match any Participant. The unique key is ordered `(email, competition_id)`, so it also serves the actor load's lookup by email.
- **Lowercase emails.** Both tables store emails lowercased and enforce it with a check constraint (`email = lower(email)`).
- **`war_week.organizer_emails` stays, unused (expand/contract).** This work stops reading and writing the column but doesn't drop it. The schema keeps it with a comment marking it deprecated, and its existing `default []` lets new War Weeks insert without it. Ticket 18 drops it later (see "Migration and deploy").

### Migration and deploy

- **One migration set, generated, never hand-edited** (`docs/maintainers-guide.md`), in drizzle-kit's order:
  1. **Tables.** `pnpm db:generate` for the two new tables and their constraints.
  2. **Copy.** `drizzle-kit generate --custom` for the data step. It inserts the distinct lowercased `@jahnelgroup.com` emails from the current War Week's `organizer_emails`, with "who added it" null. Current is picked the way the app picks it: the `live` one, else the earliest `upcoming`, else the latest `complete`. A database with no War Week gets an empty list. It ignores any email already present, so rerunning it is harmless.
  3. **Ticket 10.** Ticket 10's indexes and check constraints are generated in the same migration set, and one red-team review covers both.

  CI's schema-drift check stays green because every schema change comes from `db:generate`.
- **Deploy order.** `migrate.yml` and the Vercel deploy run separately on the same push, so either can land first:
  - Migration first: old code keeps reading `organizer_emails`, which still exists, and ignores the new tables.
  - Code first: the new code finds no `organizer` table for a moment and its pages fail until the migration finishes. Acceptable for a push to `staging`; for `main`, see the prerequisite below.
  - Instant Rollback to a pre-03 deployment works, because the column is still there. It uses the old per-edition lists, frozen as of the migration.
- **Human prerequisite before the `staging` → `main` PR merges** (post-check included):
  - **Prerequisite:** Epic B is verified on staging.
  - **Action:** Paul confirms that production's current War Week's `organizer_emails` is the intended global Organizer list. Anyone listed only on a past edition is not copied and loses `/admin`. Paul also takes a Neon branch or backup of production.
  - **Expected result:** the list is confirmed, or corrected in production's settings before the merge.
  - **Post-check after the production migration:** the `organizer` rows match the confirmed list.
- **Seed schema.** A War Week seed's `organizerEmails` becomes an optional `organizers` list of JG emails. Loading a seed inserts any listed email not already an Organizer and never removes one, the same "seed-initialized, never clobbered" treatment as keyed records. A plain seed reload never touches Hosts. `--reset` deletes the seeded War Weeks, so their Competitions and those Competitions' Hosts go with them; a staging reset wipes Host assignments. The demo seeds change in the same PR: XI's list moves to `organizers`, and the empty lists in the older seeds are dropped.

### The access rule

- **Actor.** Loaded once per request from the session: `null` when anonymous, otherwise `{ email, isOrganizer, hosts }`. `hosts` lists the (Competition id, War Week id) pairs the email hosts. A signed-in actor with no role is a Participant for access purposes. Emails compare lowercased. `getSessionEmail` already turns a non-JG session into anonymous.
- **`can(actor, action, target)`** is a pure function in the access module and the only write rule. The Organizer-list family is global and takes no target. Every other family's `target` carries the War Week id, and where it applies it also carries the Competition id (the row's current one, and the posted one for creates and edits) and the Announcement's author email. The action families:

  | Family | Actions | Who |
  |---|---|---|
  | Organizer list | view, add, remove | Organizer |
  | War Week settings | save | Organizer |
  | Lifecycle | start, end, reopen, create next | Organizer |
  | Days, Teams, Participants, FAQ Items, Awards | create, edit, delete, move | Organizer |
  | Competition | create, delete, assign Hosts | Organizer |
  | Competition | edit setup (including scoring, Placement Points, Format) | Organizer, or Host of that Competition |
  | Bracket | Entrants, generate, Heat Result, finalize, un-finalize | Organizer, or Host of that Competition |
  | Points Entry | create, edit, delete | Organizer, or Host of the entry's Competition. An edit needs the Host to host both the current and the posted Competition |
  | Schedule Item | create, edit, delete | Organizer, or Host of the linked Competition. Create needs a hosted link, and an edit needs both the current and the posted link hosted. A Host can't unlink |
  | Announcement | create | Organizer, or Host of any Competition in that War Week |
  | Announcement | edit, delete | Organizer, or its author while still a Host in that War Week |
  | Announcement | pin, unpin | Organizer |
  | Admin page | view `/admin` for a War Week | Organizer, or Host of any Competition in that War Week |

- **`can` returns a refusal message or null**, in the style of `lifecycleActionError`. That way actions return the message ("You're not a Host of Catan.", "Only an Organizer can …", "Sign in to continue.").
- **Lifecycle.** `lifecycleActionError` keeps the status rules (Start only `upcoming`, the one-live rule, Reopen only the most recently ended edition and never while a later one is upcoming) and loses its who-may branches. Who may is `can`: Organizer only.
- **Removed:**
  - `isOrganizer(email, warWeek)`, `canAdministerWarWeek`, `adminAccess`, `requireOrganizer` and `requireAdminWarWeek`;
  - the "current Organizers may edit `complete` editions" exception;
  - the self-email guard, everywhere: in `settingsGuardError`, the "can't remove your own email" state in the Organizer email-chips control, and the Organizer guide's line about it;
  - the `organizerEmails` field of the settings form and parser;
  - `copyOrganizers`.

  The email-chips control becomes a plain JG-email list used by the Hosts field and the Organizers page.

### Action layer

- **One authorize step** replaces `requireOrganizer` / `requireAdminWarWeek`. Given the action and a target reference (a row id, or a posted `warWeekId`, plus any posted Competition id), it:
  1. authenticates;
  2. validates the id's shape;
  3. loads the target row and its War Week;
  4. loads the actor;
  5. calls `can`.

  It returns `{ ok: true, actor, warWeek, ctx }` or `{ ok: false, error }`. Parsing input comes after it in every action.
- **Creates and the settings save take a `warWeekId` argument.** Every admin form passes the War Week it was rendered for. Row-level actions load the War Week from the row, as most already do. The `admin_edition` cookie is read only by the admin page loader and the edition switcher.
- **`MutationContext`** keeps `{ warWeekId, actorEmail }`, and mutations keep refusing rows of another War Week. New mutations: add Organizer, remove Organizer, and set a Competition's Hosts (replacing the list). Remove Organizer locks every `organizer` row (`SELECT … FOR UPDATE`) before counting, so two concurrent removals of the last two Organizers can't both commit: the second waits, recounts and is refused. Create next War Week copies Hosts with Competitions.
- **Actions return, never throw, on every refusal** covered here. Ticket 04 adds the catch-all for unexpected failures and the parser shape checks on top of this order.

### `/admin`

- **Page gate.** The gate loads the actor and the War Week `/admin` shows, then applies `can(actor, "admin.view", warWeek)`.
  - The shown War Week is the cookie's edition when the actor may view it. Otherwise it's the default: the current War Week for an Organizer; for a Host, the current War Week if they host there, else their earliest upcoming, else their newest past.
  - Anonymous visitors go to sign-in as today. Everyone else who is refused sees "Organizers and Hosts only".
- **Edition switcher.** Every edition for an Organizer; for a Host, the editions where they host. The Bracket admin pages pass the editions like every other page.
- **Host trimming.** A Host sees Points (their Competitions only), Brackets for their Competitions, Setup → Competitions (their Competitions, with no create, delete or Hosts field), Setup → Schedule (items linked to their Competitions), Announcements (all listed, edit and delete only on their own, no pin), Standings and the Guide. War Week settings, Days, Teams, FAQ, Awards, Organizers and lifecycle controls are hidden. The actions refuse them anyway.
- **Organizers page.** A new Organizer-only `/admin` page lists the Organizer list and adds or removes emails. It uses the shared confirm dialog for removal and toasts for results.
- **Hosts field.** Each Competition's setup page gets an email-chips field, reusing today's Organizer-email chips control, shown and saved only for Organizers.
- **Admin navigation link.** Shown to an Organizer, or to anyone who hosts a Competition in any War Week (the gate then opens their edition). It's hidden for everyone else.

## Testing Decisions

A good test checks behavior through a public interface (the rule, a mutation, or a real HTTP action call), never how the code is arranged. Three existing seams, no new one:

1. **`can` unit tests** (pure, no DB). A table-driven test over every action family in the table above. Each family is checked for the Organizer, the Host of this Competition, the Host of another Competition in the same War Week, the Host of this Competition's namesake in another War Week, a Participant, and anonymous. It also covers:
   - the Points Entry and Schedule Item "both current and posted Competition" cases;
   - Schedule Item unlinking;
   - Announcement author versus non-author;
   - the admin-page default-edition choice for Organizers and Hosts.

   This is ticket 03's "action-layer tests cover `can` … for each action family". Prior art: the access module's existing unit tests and the lifecycle rule tests.
2. **Mutation tests** against local Postgres in a rolled-back transaction. They cover:
   - adding an Organizer (JG-only, deduplicated ignoring case);
   - removing an Organizer, including removing yourself while another remains, and refusing the last one;
   - setting a Competition's Hosts;
   - Create next War Week copying Hosts with Competitions (and not without);
   - the seed loader adding missing Organizers without removing any, and idempotently;
   - the settings save no longer refusing an actor absent from any list;
   - the last-Organizer lock: two concurrent removals of the last two Organizers, on two connections, leave exactly one Organizer, and the second removal is refused.

   Prior art: the setup, lifecycle and seed-load mutation tests.
2a. **Migration copy test** (local Postgres, its own scratch database, never the smoke or test database):
   1. Apply the migrations up to the last pre-03 entry in the journal.
   2. Insert `war_week` fixtures: a `complete` edition listing `Old@jahnelgroup.com`; a `live` edition listing `Jason@JahnelGroup.com`, `jz@jahnelgroup.com`, a duplicate `jason@jahnelgroup.com` and `someone@gmail.com`; and an `upcoming` edition listing `next@jahnelgroup.com`.
   3. Apply the rest of the set.
   4. Assert the `organizer` rows are exactly `jason@jahnelgroup.com` and `jz@jahnelgroup.com`, with "who added it" null, and that `war_week.organizer_emails` is unchanged.
   5. Rerun the copy step on its own, then repeat with no `live` edition (the earliest `upcoming` wins) and with no War Week at all (no rows).

   This is the only check that exercises the copy on pre-migration data. Smoke and CI migrate an empty database before seeding, so they can't.
3. **Smoke** (real build, real sessions, real server-action calls via the existing action-call helper). It seeds a smoke Organizer into the Organizer table and a smoke Host on one XI Competition, then checks:
   - The Host can add a Points Entry on their Competition, and is refused on another Competition, on War Week settings, on a Day create and on pinning.
   - A Participant is refused on each family's representative action.
   - A create posted with `warWeekId` of edition A while the `admin_edition` cookie names edition B writes to A, and B is unchanged.
   - `/admin` shows a Host their Competitions only and shows "Organizers and Hosts only" to a Participant.
   - The Admin link shows for the Host and not for the Participant.
   - **Order of checks.** For one representative action per family, a Participant, and a Host outside their Competition, posts malformed arguments (wrong types, missing fields) and gets the access refusal, never a validation message.
   - **Former Host.** After the smoke Host's assignment is removed, their next Points Entry on that Competition is refused.

   Prior art: the existing admin gate, Points Entry, Announcement and setup smoke checks.

   **Expected smoke churn, not regressions:**
   - The smoke Organizer helper moves from appending to XI's `organizer_emails` to inserting into, and deleting from, the `organizer` table.
   - Every "Organizers only" assertion becomes "Organizers and Hosts only".
   - Checks that relied on the self-email guard or `copyOrganizers` are removed.

**Definition of Done** (the Epic B gate also applies):

- `pnpm gate` passes.
- CONTEXT.md's access and lifecycle sections are rewritten.
- `/about`, the Organizer guide and `docs/maintainers-guide.md` describe Organizers and Hosts (team rule: keep the showcase current).
- Evidence goes under `test-results/` per `docs/agents/testing.md`.

## Out of Scope

- Showing Hosts publicly ("Hosted by Tony M" on the Competition page). Host rows are emails, and emails never reach Participants. A display name would be a separate need.
- Host self-report, Host confirmation of results, or any Host-to-Host delegation. The hardening spec keeps "self-report confirmed by the Host" as a later Bracket format.
- Per-War Week Organizers, Organizer roles within a War Week, or any role beyond Organizer, Host and Participant.
- An Organizer-list CLI. Bootstrap is the seed's `organizers` list plus the migration.
- Catching unexpected database errors, parser shape checks, error boundaries and `loading.tsx` (ticket 04). Preview-alias sign-in (ticket 08). Race locks, indexes and check constraints (ticket 10). All three are in the same epic, but not in this spec.
- Changing sign-in (still Google-only, still `@jahnelgroup.com` only) or what MCP returns.

## Further Notes

- Epic B's order holds: this spec (03) first, then 04 and 08 in parallel, then 10. The migration set is 03's migration plus 10's.
- **Deploy.** The migration is expand-only, and ticket 18 drops `organizer_emails` once rolling back past Epic B is no longer an option. The production prerequisite is in "Migration and deploy".
- **Branch.** Epic B's branch is `feat/03-roles-and-access`, following the `feat/NN-<slug>` rule. The epic's earlier `feat/hardening-b-access` is superseded.
- **Access follows the current assignment.** Actor loading happens per request. A Host removed mid-session loses access on their next action, because nothing about roles is cached in the session.
- ADR 0002 names `can(actor, action, target)` in the access module, and ADR 0003 fixes the action order. This spec contradicts neither.

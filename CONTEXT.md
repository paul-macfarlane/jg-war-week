# CONTEXT

Domain glossary and vocabulary rules for the JG War Week app. Read this before
naming domain concepts in code, tests, tickets, or specs.

The product is **JG War Week** (in sentences, "the JG War Week app"; formerly
War Weeker). **War Week** alone always means the event, never the app.

## Domain glossary

| Term                          | Meaning                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **War Week**                  | One annual edition. The top-level container.                                                                                      |
| **Edition**                   | The War Week's number (XI = 11). Used in URLs (`/xi`).                                                                            |
| **Story Theme**               | The year's narrative (The Matrix, Survivor).                                                                                      |
| **Day Theme**                 | A single day's theme ("Tournament Day").                                                                                          |
| **Appearance Theme**          | Colors, logo, banner and font preset for a War Week.                                                                              |
| **Mode**                      | `teams` or `free-for-all`. Decides which leaderboard is the main one.                                                             |
| **Team**                      | A competing group. Displayed using the War Week's **Team Label**.                                                                 |
| **Team Label**                | What teams are called this year (House / Tribe / Team).                                                                           |
| **Leader** / **Leader Title** | A participant flagged as a team leader, displayed with the year's title (Captain, Head of House). A label only, not a permission. |
| **Participant**               | A person in a War Week. A record, not a user.                                                                                     |
| **Avatar**                    | A Participant's visual marker: their initials in their Team's color for now, a portrait later.                                    |
| **You**                       | The Participant the signed-in person is, in the War Week being viewed. Found by **account linking** or the "Which one is you?" pick. |
| **Account linking**           | Matching the session email to a Participant email, ignoring case. Read-time only; nothing is stored.                             |
| **Company Tag**               | An optional affiliation label on a participant (LTI, IL, …).                                                                      |
| **Organizer**                 | A signed-in `@jahnelgroup.com` user on the global Organizer list. Can change anything in any War Week (ADR 0002).                 |
| **Host**                      | A signed-in JG user an Organizer assigns to a Competition ("hosted by Tony M"). Runs that Competition; needn't be a Participant.   |
| **Admin**                     | The management area at `/admin` that Organizers and Hosts use. A place, never a role: say Organizer or Host for people.           |
| **Competition**               | Anything that awards points. Scored as team or individual. Skill divisions are separate Competitions ("MTG Advanced", "MTG Beginner"). |
| **Competition Group**         | An optional grouping of competitions ("Team Night Events").                                                                       |
| **Points Entry**              | One ledger row: points awarded to a team or participant for a competition.                                                        |
| **Placement Points**          | A Competition's optional preset points for 1st, 2nd, 3rd… (up to 5 places, highest first), offered as buttons on Points Entry.  |
| **Counts Toward Team**        | Whether an individual competition's points also go to the participant's team.                                                     |
| **Standings**                 | The main leaderboard, computed from Points Entries.                                                                               |
| **Finale**                    | The closing-ceremony screen at `/<edition>/finale`: press Start and the Standings count in from last place to first.             |
| **Award**                     | A named honor given to participants or a team. It doesn't affect points.                                                          |
| **Announcement**              | An organizer post (rich text plus video links).                                                                                   |
| **FAQ Item**                  | A question and answer pair for a War Week.                                                                                        |
| **Archive**                   | The past War Weeks shown at `/history`.                                                                                           |
| **Format**                    | How a Competition is run: `points` (Points Entries only) or `single-elimination` (a Bracket).                                     |
| **Bracket**                   | The Rounds and Heats of a non-`points` Competition.                                                                               |
| **Round**                     | One step of a Bracket, holding Heats that can be played at the same time. Round 1 is the first.                                   |
| **Heat**                      | One game between Entrants in a Bracket. Covers 1v1 and multi-entrant games.                                                       |
| **Entrant**                   | A Team or Participant entered in a Bracket.                                                                                       |
| **Seed Position**             | An Entrant's starting rank in a Bracket. Say "seed position" or "seeding", never bare "seed" (that means seed files).             |
| **Heat Result**               | The finishing order of a Heat's Entrants, with an optional score for each.                                                        |

**Reveal** is retired: Standings are never hidden any more, and the
countdown it played is now the **Finale**.

## Banned terms

Do not use these words in code (identifiers, comments, UI copy). Use the
"instead" term.

| Banned      | Use instead                                                          |
| ----------- | -------------------------------------------------------------------- |
| Event       | Competition, Announcement, or the specific thing being described     |
| League      | War Week, or nothing (there's no separate league concept)            |
| Member      | Participant                                                          |
| Match       | Competition, or the specific game/activity name                      |
| ELO         | Points, Points Entry, Standings                                      |
| Placeholder | "Coming in a later slice", stub, or name the concrete future feature |
| Tournament  | Competition                                                          |
| Admin (a person or role) | Organizer or Host; "Admin" names only the `/admin` area   |

Seed content copied verbatim from `old-wikis/` (e.g. a day theme literally
called "Tournament Day") is exempt: it is historical data, not code, and the
banned-term scan only covers `src/`, `scripts/`, and `drizzle/`.

## Schedule display rules

All Schedule Item times are ET wall-clock times; the Day supplies the date.
Now/next is computed on the ET clock, whatever the viewer's timezone.

- An item is **on now** from its start time (inclusive) to its end time
  (exclusive). An item with no end time counts as on for 60 minutes. An end
  time at or before the start time runs past midnight into the next day.
- **Up next** is every item sharing the earliest start time after now, on
  today's Day or a later one.
- Home and schedule pages accept `?at=<ISO instant>` to show the schedule as
  of that moment, for demos of a War Week that isn't on right now.
- A Schedule Item has one of six categories, each with its own fixed color
  independent of the Appearance Theme: Competition, Education, Social, Meal,
  Work, and **Other**. `other` uses neutral styling, for an item that is none
  of the other five.

## Competition and roster display rules

- A Competition page shows its description, max points, scoring and every
  Points Entry.
- The Competitions list orders Competition Groups, and Competitions within
  each, by name. Competitions with no group come last, under "Other
  Competitions" (no heading when nothing is grouped).
- A Competition's Points Entries are listed oldest first.
- The Teams page lists Teams by name, each with its Leaders first (marked
  with the Leader Title), then Participants by name. A free-for-all War Week
  shows one list of all Participants.
- A Participant's **Avatar** shows the first letter of the first and last
  words of their display name, uppercased, with no special cases ("Sir Paul
  of the Backend" → SB). Its fill is the Team color, or the Appearance
  Theme's primary color when there's no Team. It appears on the Teams page,
  the individual leaderboard and Award winners.
- **You** is highlighted with a "You" tag and an accent ring on the Teams
  roster, the individual leaderboard (home, `/leaderboard`, the Finale) and
  Award recipients. Account linking wins: when the session email matches a
  Participant, that Participant is You and the picker isn't shown. Otherwise
  the Teams page offers "Which one is you?", stored per War Week in
  `localStorage` under `ww:you:<edition>` (a Participant id; an id not in the
  War Week is ignored) with "Not me / clear" to undo. Participant emails
  never reach the client, only the matched id. Past editions use their own
  roster.

## Slack rules

- When a Slack webhook is configured, creating an Announcement can also post
  it to the War Week's Slack channel ("Also post to Slack", on by default).
  Edits, deletes, pins and seed loads never post.
- A failed Slack post never blocks publishing; the Organizer is told it
  failed.

## Access rules

> **Changing.** ADR 0002 replaces the per-edition `organizerEmails` list
> with a global Organizer list plus per-Competition Hosts. ADR 0003 makes
> every action take its War Week from the request, never from the
> `admin_edition` cookie. The rules below describe the code as it stands
> until `.scratch/hardening/issues/03` lands and rewrites this section.

- Sign-in is Google only. Any email whose domain isn't exactly
  `jahnelgroup.com` is refused: better-auth never creates a user for it,
  and a session with such an email counts as anonymous.
- An **Organizer** is a signed-in JG email on that War Week's
  `organizerEmails` (case-insensitive), checked by `isOrganizer` in
  `src/lib/access.ts`. Writes go through `canAdministerWarWeek` (below):
  admin pages via `loadAdminPage` (`src/app/admin/gate.ts`), server actions
  via `requireOrganizer` (`src/auth/organizer.ts`).
- `/admin` manages the current War Week by default. An email that doesn't
  organize the current War Week opens on its own earliest upcoming edition,
  else its newest past one. The header's edition switcher (the
  `admin_edition` cookie) picks another edition the email may administer,
  and a banner says so ("Editing the Archive: War Week X").
  Anonymous visitors are sent to sign-in; signed-in non-Organizers see
  "Organizers only".
- `canAdministerWarWeek` in `src/lib/access.ts` is the write rule: the email
  is on the target War Week's `organizerEmails`, or the target is `complete`
  and the email is on the current War Week's `organizerEmails` (so past
  results can be corrected). An Organizer of only a past edition can't
  change the current one. `requireOrganizer` applies it; every action loads
  the War Week from the row it changes or the id in the request (or, for a
  create with no row, the edition selected in `/admin`) and re-checks it on
  the server.
- Every page and API route needs a JG sign-in. Anonymous visitors to a
  page go to `/sign-in` and come back afterwards; API routes answer 401.
  Only `/sign-in`, `/api/auth/*`, `/about`, `/privacy` and `/terms` are
  public. `/about` is static copy and media (`public/about/`, written by
  `scripts/about-media.ts`): it never reads the database or the session.
  `/privacy` and `/terms` are static the same way: copy only, no database
  or session reads.
- `/api/mcp` also lets in `Authorization: Bearer <MCP_TOKEN>` (off when
  `MCP_TOKEN` is unset or blank), and anyone while `MCP_PUBLIC=true` (off by
  default; for a claude.ai connector demo). `canUseMcp` in
  `src/lib/access.ts` is the one check. Every MCP tool is read-only and
  returns only what a signed-in Participant sees: never an email or the
  Organizer allowlist. `get_leaderboard` always returns the Standings.
- Standings are always visible to every signed-in user. `/<edition>/finale`
  is readable by any signed-in JG user; only Organizers see the admin link
  to it (`/admin/standings`).

## War Week lifecycle rules

- The current War Week is picked from status, never the clock: the `live`
  one, else the next `upcoming`, else the latest `complete`.
- Status changes only through the lifecycle actions in `/admin/setup`, each
  behind a confirm, never through the settings form:
  - **Start**: `upcoming → live`
  - **End**: `live → complete`, recording the **Winner** (prefilled from
    first place in the main Standings; a tie reads "Red & Blue") and
    highlights. Both show in the Archive and stay editable in the settings.
  - **Reopen**: `complete → live`, for corrections in the live view.
  There's no way back to `upcoming`.
- At most one War Week is `live`. Start or Reopen while another is live is
  refused ("End XI first"); the `war_week_one_live` partial unique index
  refuses it in the database too.
- Who may move a War Week (`lifecycleActionError` in
  `src/lib/war-week-lifecycle.ts`, re-checked by every lifecycle action):
  - **End**: anyone who may administer it.
  - **Start**: an Organizer of that upcoming edition or of the current War
    Week. Start never reopens an ended edition.
  - **Reopen**: only an Organizer of the current War Week (who may
    administer the edition), only for the most recently ended edition, and
    not while a later edition is upcoming ("War Week XII is next; reopen
    isn't available"). So an Organizer of only a past edition can never
    make it current again.
  - **Create next War Week**: only an Organizer of the current War Week,
    copying from any edition they may administer.
- **Create next War Week** (`/admin/setup/next`) makes an `upcoming` edition
  prefilled with the next Roman numeral, edition number and year. It can
  copy Organizers (on; the creator is always one), settings with the
  Appearance Theme (on), Competitions with new ids (off) and the FAQ (off).
  Teams, roster, Days, Schedule, Points Entries, Awards and Announcements
  are never copied. It doesn't change what's current until it starts.

## Points Entry rules

- Organizers add, edit and delete Points Entries in `/admin/points`. A team
  Competition takes only Teams, an individual one only Participants of the
  same War Week; the server actions refuse anything else.
- Going over a Competition's max points shows a warning and still saves.
  Ties are just equal entries for each target.
- When a Competition has Placement Points, the form offers one button per
  place ("1st · 5"). A tap fills the Points field, which stays editable; it
  doesn't touch the note.
- An edit keeps the entry's entered-by email and entered-at time; the admin
  ledger marks it as edited.
- `/admin/points` shows the current Standings next to the ledger.

## Bracket rules

- A Competition's **Format** is `points` or `single-elimination`. Only a
  single-elimination Competition has Entrants and a Bracket. A team
  Competition's Entrants are Teams, an individual one's Participants of the
  same War Week.
- **Generate** seeds the Entrants randomly and builds the Bracket. When the
  count isn't a power of two, the top Seed Positions get byes and advance
  straight away; a bye is never a played Heat.
- Regenerating, or replacing the Entrants, before any Heat Result is free.
  After one, it needs a confirmation and clears every Heat Result.
- A knockout Heat Result needs a clear finishing order. A forfeiting
  Entrant loses. Editing a decided Heat sends every later Heat its winner
  reached back to unplayed.
- **Finalize** turns final placings (1st, 2nd, tied 3rd for both semifinal
  losers, later places tied by the Round lost in) into Points Entries
  through the Competition's Placement Points, tied places each getting that
  place's points. They're marked "From bracket", can't be edited or deleted
  in the ledger, and are replaced wholesale when the Bracket is finalized
  again. Un-finalizing deletes them; hand-entered Points Entries on the same
  Competition are never touched. A finalized Bracket can't change until it's
  un-finalized.
- Deleting a Team or Participant that is an Entrant is refused with the
  count, and so is changing a Competition's scoring or Format while it has
  Entrants.
- While a Bracket is finalized, changing the Competition's scoring or
  Placement Points is refused ("Un-finalize the Bracket first."); its name
  and description still save.

## Finale rules

- The Finale is the closing-ceremony screen at `/<edition>/finale`, for the
  projector. Organizers open it from `/admin/standings` ("Open Finale").
- It opens on a big Start button. Start, `Space`, or a click anywhere on the
  stage plays the countdown for the main leaderboard (team Standings in
  `teams` mode, individual Standings in free-for-all):
  - Rows appear from last place up to first, and tied rows appear together.
  - Totals count up from 0.
  - Every list ends together, so each first place lands at the end.
  - The whole Finale is under 8 s.
- Replay plays it again. With `prefers-reduced-motion`, Start shows the
  final state at once.
- The Finale never reorders or recomputes Standings: it plays the same
  `getStandings` rows the leaderboard shows.
- The home and leaderboard pages keep refreshing about every 10 s while the
  tab is visible, and always show the plain Standings.

## Seed idempotence rules

A seed file loads in one transaction. Loading the same file twice leaves the
same rows with the same values (only `updated_at` moves).

- `war_week` rows are upserted by `edition`, the seed's natural key.
- **Setup data** is owned by the seed. Each row is upserted by its natural
  key within the War Week, and any row absent from the seed is deleted, so
  setup always matches the seed exactly after a load:
  - Day: `(war_week_id, date)`
  - Schedule Item: `(day_id, start_time, title)`
  - Team: `(war_week_id, name)`
  - Participant: `(war_week_id, display_name)`
  - Competition: `(war_week_id, name)`
  - FAQ Item: `(war_week_id, question)`; sort order is the position in the
    seed's `faqItems` list

  Seed references between entities use these names (a Points Entry names its
  Competition, Team or Participant). Removing a Team, Participant or
  Competition from the seed also deletes its Points Entries and Award
  recipients, and renaming one counts as a removal plus an addition, so fix
  spellings before organizers start entering points.
  - Changing a Competition's `scoring` in the seed does not re-check its
    existing Points Entries; the target-kind rule is enforced in zod (seed
    files and organizer actions), not the database.
- **Organizer-owned data** is seed-initialized but never clobbered:
  - `status`, `winner` and `highlights` are applied only
    when a War Week is first inserted; the lifecycle actions and settings
    own them afterwards. A `live` seed for a new War Week while another is
    live is refused with a clear error.
  - Points Entries, Awards (with their recipients) and Announcements in a
    seed carry a `key`. The loader inserts a keyed record only when no record
    with that key exists, and never updates or deletes one. Records organizers
    create in the app have no key and are never touched by a load. Adding a
    new keyed record to a seed and reloading adds just that record.

**Setup in the UI.** Organizers can also edit setup in `/admin/setup`
(War Week settings, the Appearance Theme, Days, Teams, the roster,
Competitions, Schedule Items and FAQ Items). The seed stays the
way to bootstrap a War Week, and there's no merge: reloading a seed makes
its War Week match the seed again, overwriting settings, Days and other
setup data edited in the UI and deleting setup rows the seed doesn't list.
Once organizers edit setup in the UI, update the seed file to match or stop
reloading it. Setup screens refuse edits that would cascade: switching to
free-for-all while Teams exist, dates that leave a Day outside the War Week,
deleting a Day with Schedule Items, and an Organizer removing their own
email. Deleting a Team, Participant or Competition that Points Entries,
Awards, Schedule Items or (for a Team) Participants still refer to is
refused with the counts, and so is changing a Competition's scoring while it
has Points Entries. A Participant's email is unique within the War Week. A
Team may have more than one Leader.

**Reset exception.** `pnpm seed:load --reset` (and the Seed workflow's reset
option) deletes each seeded War Week, with all its setup and organizer-owned
data, before loading, so the War Week matches its seed exactly. It exists to reset demo data; never use
it on a War Week organizers are running.

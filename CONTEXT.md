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
| **Host**                      | A signed-in JG user an Organizer assigns to a Competition ("hosted by Tony M"). Runs that Competition; needn't be a Participant. A Schedule Item's free-text `host` field is display copy, not the Host role. |
| **Admin**                     | The management area at `/admin` that Organizers and Hosts use. A place, never a role: say Organizer or Host for people.           |
| **Competition**               | Anything that awards points. Scored as team or individual. Skill divisions are separate Competitions ("MTG Advanced", "MTG Beginner"). |
| **Competition Group**         | An optional grouping of competitions ("Team Night Events").                                                                       |
| **Points Entry**              | One ledger row: points awarded to a team or participant for a competition.                                                        |
| **Placement Points**          | A Competition's optional preset points for 1st, 2nd, 3rd… (up to 5 places, highest first), offered as buttons on Points Entry.  |
| **Counts Toward Team**        | Whether an individual competition's points also go to the participant's team.                                                     |
| **Standings**                 | The main leaderboard, computed from Points Entries.                                                                               |
| **Finale**                    | The closing-ceremony screen at `/<edition>/finale`: press Start and the Standings count in from last place to first. A finalized Bracket has its own **Bracket Finale** at `/<edition>/finale/<competitionId>`. |
| **Award**                     | A named honor given to participants or a team. It doesn't affect points.                                                          |
| **Announcement**              | A post by an Organizer or Host (rich text plus video links).                                                                      |
| **FAQ Item**                  | A question and answer pair for a War Week.                                                                                        |
| **Archive**                   | The past War Weeks shown at `/history`.                                                                                           |
| **Format**                    | How a Competition is run: `points` (Points Entries only), `single-elimination` or `heats` (a Bracket).                            |
| **Bracket**                   | The Rounds and Heats of a non-`points` Competition.                                                                               |
| **Round**                     | One step of a Bracket, holding Heats that can be played at the same time. Round 1 is the first.                                   |
| **Heat**                      | One game between Entrants in a Bracket. Covers 1v1 and multi-entrant games. May have a time and place: a Day and a start time (ET) together, and a location. |
| **Entrant**                   | A Team, Participant or Squad entered in a Bracket.                                                                                |
| **Squad**                     | A named group of Participants of one Team, entered as one Entrant in a team-scoring Bracket. Belongs to one Competition; a Participant is in at most one Squad per Competition. |
| **Self-report**               | A Participant in a Heat entering its Heat Result themselves, when the Competition allows it. It counts at once, like the Host's; the Host or an Organizer can overwrite it. |
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
- Timed Heats (a Day and a start time, every slot filled, no Heat Result
  yet) join now/next under the same rules, 60 minutes long, alongside any
  Schedule Item on the same Competition; a decided Heat, and a Heat still
  waiting for its Entrants, drops out. A Heat whose earlier Heat was
  re-recorded shows again once it's refilled with its new Entrants. Now/next
  shows a Heat as "<Competition> · <Heat name>" with a "Heat" badge and its
  Entrants, linked to the Competition. The schedule page and `get_schedule`
  list Schedule Items only.
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
- A Participant-facing Announcement card shows its author's Participant
  display name when the author's email matches a Participant's (account
  linking), else the part of the email before the `@`. Only the admin pages
  show the author's email.

## Slack rules

- When a Slack webhook is configured, creating an Announcement can also post
  it to the War Week's Slack channel ("Also post to Slack", on by default).
  Edits, deletes, pins and seed loads never post.
- A failed Slack post never blocks publishing; the poster is told it
  failed.

## Access rules

- Sign-in is Google only. Any email whose domain isn't exactly
  `jahnelgroup.com` is refused: better-auth never creates a user for it,
  and a session with such an email counts as anonymous.
- There are three roles (ADR 0002), loaded once per request as the actor
  (`getActor` in `src/auth/actor.ts`):
  - An **Organizer** is a signed-in JG email on the global Organizer list
    (the `organizer` table, lowercase). An Organizer can do everything in
    every War Week. Organizers manage the list at `/admin/organizers`: any
    Organizer can add a JG email or remove one, themselves included while
    another remains; the last Organizer can't be removed.
  - A **Host** is a signed-in JG email an Organizer assigns to a
    Competition (a `competition_host` row, set in Setup → Competitions). A
    Host runs their own Competitions: their setup (not creating, deleting or
    assigning Hosts), their Bracket, their Points Entries and the Schedule
    Items linked to them. A Host can also post Announcements in a War Week
    where they host, and edit or delete their own. Hosting is per
    Competition, so a Host of one War Week's Competition has no say in
    another War Week's.
  - Everyone else signed in is a **Participant** for access purposes and
    has one write: reporting the result of a Heat they're in when
    self-report is on (ADR 0005).
- `can(actor, action, target)` in `src/lib/access.ts` is the one access
  rule: it returns why the actor can't take the action, or null. It's pure;
  the caller loads the actor and the target. A Points Entry or Schedule Item
  edit needs the Host of both the row's current Competition and the one the
  request posts, and a Host can't unlink a Schedule Item from its
  Competition. Changing another person's Announcement, pinning and
  unpinning are Organizer-only.
- Every War Week action runs `authorize` (`src/auth/authorize.ts`) before
  it touches its input (ADR 0003), in this order:
  1. authenticate ("Sign in to continue.");
  2. check the id is shaped like a row id, else the family's "no longer
     exists" message;
  3. load the row and its War Week (a create or the settings save loads the
     War Week whose `warWeekId` it posts);
  4. load the actor;
  5. run `can`, with any Competition the request posts.
  Only then does the action parse its input, so a Participant or a Host
  outside their Competition always gets the access refusal, never a
  validation message. The Organizer list's actions run
  `authorizeOrganizerList`, which has no target. No action ever throws a
  refusal to the client.
- Every action writes to the War Week of the row it changes, or the one it
  posts. The `admin_edition` cookie only chooses which War Week `/admin`
  shows; no action takes its write target from it.
- `/admin` opens on the current War Week for an Organizer. A Host opens on
  the current War Week if they host there, else their earliest upcoming
  edition, else their newest past one. The header's edition switcher (the
  `admin_edition` cookie) picks another edition the actor may view: every
  edition for an Organizer, the editions they host in for a Host. A banner
  marks the Archive ("Editing the Archive: War Week X"). Anonymous visitors
  go to sign-in; anyone else sees "Organizers and Hosts only."
- `/admin` is trimmed for a Host (`loadAdminPage` in
  `src/app/admin/gate.ts`): Points Entries, the Brackets, Setup →
  Competitions and Setup → Schedule list only their Competitions and the
  Schedule Items linked to them. War Week settings, Days, Teams and roster,
  FAQ, Awards, the Organizer list and Create next War Week are
  Organizer-only pages and show a Host "Organizers and Hosts only." The
  Admin link on the edition pages shows for Organizers and for anyone who
  hosts a Competition.
- Every page and API route needs a JG sign-in. Anonymous visitors to a
  page go to `/sign-in` and come back afterwards; API routes answer 401.
  Only `/sign-in`, `/api/auth/*`, `/about`, `/privacy` and `/terms` are
  public. `/about` is static copy and media (`public/about/`, written by
  `scripts/about-media.ts`): it never reads the database or the session.
  `/privacy` and `/terms` are static the same way: copy only, no database
  or session reads.
- `/api/mcp` also lets in `Authorization: Bearer <MCP_TOKEN>` (off when
  `MCP_TOKEN` is unset or blank). `canUseMcp` in `src/lib/access.ts` is the
  one check. Every MCP tool is read-only and returns only what a signed-in
  Participant sees: never an email, the Organizer list or Hosts.
  `get_leaderboard` always returns the Standings. `get_bracket` returns one
  Competition's Bracket of the current War Week by name: Entrants and Heats
  by name, with places, scores, time and place, and the champion; a
  Squad's Participants by name, and never who reported a result.
- Standings are always visible to every signed-in user. `/<edition>/finale`
  and a finalized Bracket's `/<edition>/finale/<competitionId>` are readable
  by any signed-in JG user; Organizers and Hosts see the links to them in
  `/admin/standings`.
- A Heat's time and place is set by an Organizer or that Competition's Host
  (`bracket.heat-schedule`, through `authorize` like every Bracket write).
- **Self-report** (`bracket.heat-report`, ADR 0005) is the one Participant
  write. The report action runs `authorizeHeatReport`: sign-in, the
  Competition and Heat ids, the Competition row, then the Heat's facts, then
  `can`, and only then parses its input. `can` checks it before the
  Organizer shortcut, so the Heat's facts bind everyone, and refuses in this
  order: not signed in with a JG email ("Sign in to continue."); the facts
  weren't loaded ("Organizers and Hosts only."); "Self-report is off for
  this Competition."; "Your sign-in doesn't match a Participant of this War
  Week." (linked by the roster email, ignoring case — never the "Which one
  is you?" pick); "That Heat no longer exists."; "You're not in this
  Heat." (not its Participant, not on its Team Entrant, not in its Squad);
  "A bye isn't played."; "This Heat is still waiting for its Entrants.";
  "This Heat already has a result.". The mutation checks the Heat's facts
  again under the Competition row lock, so of two reports at once the
  second is refused.
- Only the Competition's Host or an Organizer changes a result already
  entered, turns self-report on or off, or writes Squads. The reporter's
  email is stored on the Heat and never sent to the client or MCP; the
  results screen shows their Participant name ("Reported by Ashley
  Schuliger").

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
- Every lifecycle action is Organizer-only: `can` refuses anyone else
  first. Then the status rules (`lifecycleActionError` in
  `src/lib/war-week-lifecycle.ts`, re-checked by every lifecycle action):
  - At most one War Week is `live`. Start or Reopen while another is live
    is refused ("End XI first"); the `war_week_one_live` partial unique
    index refuses it in the database too.
  - Start only moves an `upcoming` edition; it never reopens an ended one.
  - Reopen works only for the most recently ended edition, and not while a
    later edition is upcoming ("War Week XII is next; reopen isn't
    available").
- **Create next War Week** (`/admin/setup/next`, Organizers only) makes an
  `upcoming` edition from any edition, prefilled with the next Roman
  numeral, edition number and year. It can copy settings with the
  Appearance Theme (on), Competitions with new ids and their Hosts (off) and
  the FAQ (off). It never copies Organizers: the Organizer list is global.
  Teams, roster, Days, Schedule, Points Entries, Awards and Announcements
  are never copied. It doesn't change what's current until it starts.

## Points Entry rules

- Organizers and the Competition's Hosts add, edit and delete Points
  Entries in `/admin/points`. A team
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

- A Competition's **Format** is `points`, `single-elimination` or `heats`.
  Only a single-elimination or Heats Competition has Entrants and a
  Bracket. A team Competition's Entrants are Teams or Squads, an
  individual one's Participants of the same War Week. All of a Bracket's
  Entrants are one kind.
- **Squads.** A Host or Organizer names Squads in the builder: 1–16
  Participants of one Team, a name unique within the Competition, and a
  Participant in at most one Squad per Competition. Squads are only for
  team-scoring Brackets. A Squad's Placement Points go to its Team, so two
  Squads of one Team each earn their own Points Entry. Squads are seeded at
  random only (no By Standings). Changing a Participant's Team, or deleting
  them or their Team, is refused while they're in a Squad; deleting a Squad
  that is an Entrant is refused, and no Squad changes while the Bracket is
  finalized. Changing a Competition's scoring, or its Format to `points`,
  is refused while it has Squads.
- **Self-report** is off by default; an Organizer or the Competition's Host
  turns it on per Competition in the builder. A Participant linked by email
  then sees **Report result** on "Your next Heat" and enters the result of
  a Heat they're in that has no result yet. It counts at once and advances
  Entrants exactly as the Host's does. Turning it off refuses new reports
  and keeps the results already reported. A Host save that changes a
  reported result clears its reporter (the result is now the Host's), as
  does a later Heat being reset or refilled; re-saving the identical result
  keeps it. A re-draw takes the reports with the Heats.
- **Generate** gives the Entrants random Seed Positions and builds the
  Bracket; **By Standings** builds it with Seed Positions in the order of
  the current Standings (Team Standings for a team Competition, individual
  Standings for an individual one), Entrants on equal points, including
  every Entrant with none, in random order among themselves. In single
  elimination, when the count isn't a power of two, the top Seed Positions
  get byes and advance straight away; a bye is never a played Heat.
- Regenerating, or replacing the Entrants, before any Heat Result is free.
  After one, it needs a confirmation and clears every Heat Result.
- **Time and place.** An Organizer or that Competition's Host sets a Heat's
  time and place from the results screen ("Time & place"): a Day of the
  War Week and a start time (ET) together, and an optional location, which
  can also stand alone ("Table 3"). Any Heat but a bye can have one while
  the Bracket isn't finalized, a decided Heat included. Heat cards and
  "Your next Heat" show it as "Sunday, Feb 22 · 7:00 PM ET · Main room".
  Deleting a Day leaves its Heats untimed.
- A re-draw (Generate, Re-roll, By Standings, saving Entrants or Heat
  settings) rebuilds every Heat, so it clears every Heat time too; while
  any Heat is timed, the builder asks first ("This clears N Heat times.").
- A Heat Result needs a clear finishing order (a knockout Heat's is just its
  winner). A forfeiting Entrant loses in a knockout Heat, and in a Heat of
  more than two finishes behind everyone who didn't forfeit. A forfeiter
  advances only when fewer than the advancing number didn't forfeit, and
  not every Entrant of a Heat may forfeit. Changing the
  winner of a decided knockout Heat, or a Heats Heat's result so different
  Entrants advance or in a different order, sends the later Heats that
  followed from it back to unplayed; an edit that changes nothing about who
  advances (scores only, or a knockout winner unchanged) changes nothing
  downstream.
- **Heats** settings (the Format's "Heat settings" form) are Entrants per
  Heat (2–8) and how many advance from each. Each Round deals the Entrants
  into Heats snake-style by Seed Position, so Heat sizes in a Round differ
  by at most one; the top few of each Heat advance, ranked by place then by
  Heat, into the next Round, Round after Round until one Heat, the Final, is
  left. A setting that would never end (as many or more advance than a
  Round sends on) is refused at Generate. A Heat before the Final with no more
  Entrants than advance is a bye, decided without being played.
- **Finalize** turns final placings into Points Entries through the
  Competition's Placement Points, tied places each getting that place's
  points. In single elimination that's 1st, 2nd, tied 3rd for both
  semifinal losers, later places tied by the Round lost in; in Heats it's
  the Final Heat's order, then everyone else tied by the Round they went
  out in. They're marked "From bracket", can't be edited or deleted in the
  ledger, and are replaced wholesale when the Bracket is finalized again.
  Un-finalizing deletes them; hand-entered Points Entries on the same
  Competition are never touched. A finalized Bracket can't change until
  it's un-finalized.
- Deleting a Team or Participant that is an Entrant is refused with the
  count, and so is changing a Competition's scoring or Format while it has
  Entrants.
- While a Bracket is finalized, changing the Competition's scoring or
  Placement Points is refused ("Un-finalize the Bracket first."); its name
  and description still save.
- Ending a War Week never refuses on an unfinalized Bracket; it only warns,
  naming it, because its placings aren't in the Standings until it's
  finalized.

## Finale rules

- The Finale is the closing-ceremony screen at `/<edition>/finale`, for the
  projector. Organizers and Hosts open it from `/admin/standings` ("Open
  Finale").
- It opens on a big Start button. Start, `Space`, or a click anywhere on the
  stage plays the countdown for the main leaderboard (team Standings in
  `teams` mode, individual Standings in free-for-all):
  - Rows appear from last place up to first, and tied rows appear together.
  - Totals count up from 0.
  - Every list ends together, so each first place lands at the end.
  - The whole Finale is under 8 s.
- Replay plays it again. With `prefers-reduced-motion`, Start still has to be
  pressed (or `Space`, or a click on the stage) — reduced motion only skips
  the count-in animation once pressed, jumping straight to the final state.
  It never auto-starts: the ceremony needs a deliberate start.
- The Finale never reorders or recomputes Standings: it plays the same
  `getStandings` rows the leaderboard shows.
- The home and leaderboard pages keep refreshing about every 10 s while the
  tab is visible, and always show the plain Standings.
- **Bracket Finale.** A finalized Bracket has its own Finale at
  `/<edition>/finale/<competitionId>`, readable by any signed-in JG user and
  not found for any other Competition. It plays the Bracket's final placings
  (places and names, no points) from last place to first, tied places
  together, and ends on the champion card ("Champion of <Competition>").
  Start, Replay and reduced motion work as in the Finale. It reads nothing
  from the Standings and changes nothing. It's linked from the Bracket's
  champion card ("Play the Finale"), the results screen once finalized, and
  `/admin/standings` ("Finale: <Competition>").

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
- **Organizers** in a seed's `organizers` list are added to the global
  Organizer list when missing, ignoring case. A load only ever inserts
  them: it never removes an Organizer, even with `--reset`.
- **Squads** and reporters aren't in seeds, and neither is a Competition's
  self-report setting. A reload that removes or moves a Participant leaves
  their Squads to the Organizer.
- **Hosts** aren't in seeds. A plain reload never touches the Hosts of a
  Competition the seed keeps; `--reset` deletes the War Week's
  Competitions, and their Hosts go with them.
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
  - A Competition's `format` is applied only on insert, like `bracketConfig`
    (its Heats settings): a reload never turns an Organizer's Bracket back
    into `points`, changes its Format, or undoes its Heats settings.

**Setup in the UI.** Organizers can also edit setup in `/admin/setup`
(War Week settings, the Appearance Theme, Days, Teams, the roster,
Competitions with their Hosts, Schedule Items and FAQ Items); a Host edits
only their own Competitions and the Schedule Items linked to them. The seed
stays the way to bootstrap a War Week, and there's no merge: reloading a
seed makes its War Week match the seed again, overwriting settings, Days and
other setup data edited in the UI and deleting setup rows the seed doesn't
list. Once organizers edit setup in the UI, update the seed file to match or
stop reloading it. Setup screens refuse edits that would cascade: switching
to free-for-all while Teams exist, dates that leave a Day outside the War
Week, and deleting a Day with Schedule Items. Deleting a Team, Participant
or Competition that Points Entries, Awards, Schedule Items or (for a Team)
Participants still refer to is refused with the counts, and so is changing
a Competition's scoring while it has Points Entries. A Participant's email
is unique within the War Week. A Team may have more than one Leader.

**Reset exception.** `pnpm seed:load --reset` (and the Seed workflow's reset
option) deletes each seeded War Week, with all its setup and organizer-owned
data, before loading, so the War Week matches its seed exactly. It exists to reset demo data; never use
it on a War Week organizers are running.

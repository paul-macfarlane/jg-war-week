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
| **Day description**           | An optional plain-text line (up to 280 characters) about a Day, set in the Day form. Shows under the Day Theme on the Schedule and in Home's Now/Next "Today" header. |
| **Appearance Theme**          | Colors, logo, banner and font preset for a War Week, in both color schemes: the Organizer's five colors plus whatever the other scheme derives or overrides. |
| **Display**                   | A viewer's own choice of Light, Dark or System (the default), stored per device (`ww:display`) and never synced to their account. Not a Participant's display name — see **Participant**. |
| **Color scheme**              | `light` or `dark`, the CSS term for which of a War Week's two palettes a page renders.                                            |
| **Base palette**              | An Appearance Theme's five Organizer-set colors, for whichever scheme its background reads as.                                   |
| **Derived palette**           | The other color scheme's five colors, computed from the base palette (`derivePalette`) unless overridden.                        |
| **Override**                  | An Organizer's per-color replacement of one derived-palette color in Settings.                                                    |
| **Mode**                      | `teams` or `free-for-all`. Decides which leaderboard is the main one.                                                             |
| **Team**                      | A competing group. Displayed using the War Week's **Team Label**.                                                                 |
| **Team Label**                | What teams are called this year (House / Tribe / Team).                                                                           |
| **Leader** / **Leader Title** | A participant flagged as a team leader, displayed with the year's title (Captain, Head of House). A label only, not a permission. |
| **Participant**               | A person in a War Week. A record, not a user.                                                                                     |
| **Profile**                   | A person's own Profile name and picture URL, stored once by email (ADR 0007). It overrides the roster name and picture wherever that email is on a roster, in every War Week, past ones too. Set on the Profile page, opened from the Account menu. |
| **Profile name**              | The name a person sets on their Profile. Empty means the roster name shows. An Organizer's roster form shows a set one read-only, "Set by the person".  |
| **Avatar**                    | A person's visual marker: their Profile's picture URL (`https://` only), else their Google photo, else their initials in their Team's color. |
| **Account menu**              | The avatar button in the top-right of the participant and admin headers, opening the viewer's name and email, Profile, Display, Admin (Back to War Week in admin), the Slack channel and Sign out. |
| **You**                       | The Participant the signed-in person is, in the War Week being viewed. Found by **account linking** only (the roster email matches the session email). |
| **Account linking**           | Matching the session email to a Participant email, ignoring case. Read-time only; nothing is stored.                             |
| **Test sign-in**              | A maintainer tool at `/sign-in/test` for testing as any `@jahnelgroup.com` address (`+` aliases included) on staging, by typing a secret. Never on production (ADR 0008). |
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
| **Finale**                    | The closing-ceremony slideshow at `/<edition>/finale`: the War Week's **Finale slides**, one full screen at a time, stepped through by the presenter. A finalized Bracket has its own **Bracket Finale** at `/<edition>/finale/<competitionId>`. |
| **Finale slide**              | One full-screen step of the Finale: a built-in (Title, By the numbers, Awards, Champions, **Standings countdown**, Winner) or a **Custom slide**. Each War Week orders and hides its slides in admin → Finale. |
| **Award**                     | A named honor given to participants or a team. It doesn't affect points.                                                          |
| **Announcement**              | A post by an Organizer or Host (rich text, videos included).                                                                      |
| **FAQ Item**                  | A question and answer pair for a War Week.                                                                                        |
| **Archive**                   | The past War Weeks shown at `/history`.                                                                                           |
| **Recent results**            | Home's section of the latest results: finalized Brackets, closed `games` and `participation` Competitions and Points Entries, newest first, up to 5. |
| **Format**                    | How a Competition is run: `points` (Points Entries only), `games` (decided by Games, once or recurring; not a Bracket), `participation` (decided by who took part, ticked by the Host or checked in by the Participants themselves), or `single-elimination` or `heats` (a Bracket, for tournaments).                            |
| **Bracket**                   | The Rounds and Heats of a non-`points` Competition.                                                                               |
| **Round**                     | One step of a Bracket, holding Heats that can be played at the same time. Round 1 is the first.                                   |
| **Heat**                      | One game between Entrants in a Bracket. Covers 1v1 and multi-entrant games. May have a time and place: a Day and a start time (ET) together, and a location. |
| **Entrant**                   | A Team, Participant or Squad entered in a Bracket or a fixed-list `games` Competition.                                           |
| **Squad**                     | A named group of Participants of one Team, entered as one Entrant in a team-scoring Bracket — "a pair or group from one Team, playing as one entrant". Belongs to one Competition; a Participant is in at most one Squad per Competition. |
| **Self-report**               | A Participant in a Heat entering its Heat Result themselves, when the Competition allows it. It counts at once, like the Host's; the Host or an Organizer can overwrite it. |
| **Seed Position**             | An Entrant's starting rank in a Bracket. Say "seed position" or "seeding", never bare "seed" (that means seed files).             |
| **Heat Result**               | The finishing order of a Heat's Entrants, with an optional score for each.                                                        |
| **Game**                      | One recorded contest in a `games` Competition, logged by a player in it or by the Host: a head-to-head result, a score, or a finishing order. A Game is never part of a Bracket; that is a Heat. |
| **Game Type**                 | How a `games` Competition's Games are decided, one per Competition: `head-to-head` (a winner, or a draw when allowed), `best-score` (each Game records a score; higher or lower is better, counted as best or total) or `ranked` (a finishing order). |
| **Finish Points**             | A `ranked` `games` Competition's points per finishing position within one Game, set by the Host. Summed across Games for its leaderboard. Not Placement Points, which go to the Standings. |
| **Log a Game**                | A Participant's write, recording one Game they played in a `games` Competition, in seconds, from their phone.                    |
| **Close** / **Reopen**        | A `games` or `participation` Competition's Finalize / Un-finalize: Close turns its leaderboard's places (or, for Participation, who took part) into Points Entries; Reopen withdraws them. |
| **Entrants open** / **fixed Entrant list** | A `games` Competition's Entrants are either open (anyone eligible may log a Game) or a fixed list the Host sets, like a Bracket's. |
| **Enroll** / **Withdraw**     | A Participant's writes entering or leaving a fixed-list Competition themselves, when its "Participants can enroll" switch is on. |
| **Participation**             | A `participation` Competition: scored by who took part (Black Midnight, a daily workout, HQ attendance). The Host or an Organizer ticks Participants as having **taken part**, and Participants can **Check in** themselves; points land at **Close**. The Format, not a Participant's act. |
| **Check in** / **Check out**  | A Participant's write saying they took part in a `participation` Competition, when its **Self check-in** switch is on (ADR 0009). Check out removes only their own check-in, never a tick the Host made. |
| **Award Category**            | A global name that groups Awards across War Weeks (War Week MVP, Grow, Black Midnight…). Managed by Organizers at `/admin/awards`; archived, never deleted. An Award has at most one. |

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
| News        | Announcement (the page, nav item and route are all "Announcements")  |
| Admin (a person or role) | Organizer or Host; "Admin" names only the `/admin` area   |

(Exception: "the Jahnel Group admins" on Privacy and Terms means the
company's administrators, who act on data requests. It is not an app role,
so it is allowed there.)

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
  the individual leaderboard and Award winners. A **Profile** picture
  replaces the initials (shown through an image that falls back to them).
- **You** is highlighted with a "You" tag and an accent ring on the Teams
  roster, the individual leaderboard (home, `/leaderboard`, the Finale) and
  Award recipients. Account linking wins: when the session email matches a
  Participant, that Participant is You; otherwise nobody is. There is no
  self-pick. The roster admin shows "No email: won't be linked when they sign
  in" on a Participant row without an email. Participant emails never reach
  the client, only the matched id. Past editions use their own roster.
- **The Team shows in team events.** In a teams War Week, wherever a
  Participant appears in a Competition or scoring context (Standings,
  Brackets and Heats, Games, Recent results, Points Entry ledgers, Awards,
  the Finale, Now/Next), their Team shows: by name where there's room, as the
  individual leaderboard's Team tag does, and at least by the Team color
  where there isn't (the initials Avatar's fill; a Profile picture hides it,
  so a pictured Avatar needs another mark, such as a Team-colored ring).
  Never by color alone where the name fits.
  Free-for-all War Weeks have no Teams. Ticket 83 audits the surfaces that
  don't yet.
- A Participant-facing Announcement card shows its author's Profile name,
  else their Participant display name when the author's email matches a
  Participant's (account linking), else the part of the email before the
  `@`. The admin pages show the same name; the email is only used for the
  edit/ownership check.
- **Roster import** (`/admin/roster`, Organizers only; Hosts can't): paste
  from Google Sheets or upload a CSV (name, email, Team, Company Tag,
  Leader; a free-for-all's are name, email, Company Tag; headers
  forgiving; at most 500 rows or 256 KB). The preview marks each row Add,
  Update (matched by email, case-insensitive, listing the changes),
  Unchanged or Error; Import commits the valid rows in one transaction,
  and refuses if the roster changed since the preview. A Team that doesn't
  exist is an Error: import never creates one. On Update an empty cell
  clears that field; a column that isn't in the file leaves it alone.

## Profile rules

- A **Profile** is keyed by lowercase email in the `profile` table and
  resolves by that email wherever the email is on a roster, in every War Week
  (ADR 0007). One resolver, in two forms: `src/queries/profile-join.ts`
  (SQL) and `src/lib/profile.ts` (pure TS). No surface copies a resolved
  name or picture.
- **Profile name:** empty means the roster name shows. It shows on the
  roster, Standings, Brackets, Games, Awards, Recent results, ledgers,
  Announcement "Posted by", Host names and MCP (names only, never emails).
- **Avatar picture:** the Profile's picture URL (`https://` only), else the
  Google photo (only a `https://lh3.googleusercontent.com/` URL counts),
  else initials. "Use Google photo" clears the picture URL. The Profile page
  previews Light and Dark side by side. There is no upload; a picture URL is
  loaded from its own host, which sees viewers' IP addresses.
- better-auth's `/update-user` endpoint is disabled, so a Profile is only
  written through the Profile page.
- **Delete my account** (on the Profile page, behind a typed-email confirm)
  removes the login (`user`, `session`, `account`), the Profile and the
  person's Organizer-list entry; it is refused for the last Organizer. It
  keeps roster records, results, Awards, Announcements, history, Host
  assignments (`competition_host`) and the email audit columns, which show
  the roster name again. Signing in again creates a fresh account that
  re-links by email.

## Light and dark Display rules

- A viewer picks a **Display** — Light, Dark or System — from the Account
  menu (the avatar button in the top-right of the participant and admin
  headers). **System** is the default and follows the OS's
  `prefers-color-scheme`. The choice is stored per device, in
  `localStorage["ww:display"]`, never on the account and never synced across
  devices.
- An Appearance Theme's five Organizer-set colors are the **base palette**,
  for whichever color scheme its background reads as. The **derived
  palette**, for the other scheme, is computed from it: background and
  foreground swap, and the primary and accent colors keep their hue but move
  toward the new text color only as far as WCAG AA (4.5:1) needs. An
  Organizer may **override** any of the derived palette's five colors in
  Settings; a background change across light and dark clears every override
  that hasn't itself been touched.
- Every themed surface follows the viewer's Display: the edition pages, the
  Finale, the Archive, `/about`, `/admin`, sign-in, install, privacy and
  terms. The installed app's chrome color does not follow it (it stays
  fixed). A Participant's **Avatar** fill is always the base palette's
  primary color, whichever scheme is showing.

## Slack rules

- When a Slack webhook is configured, creating an Announcement can also post
  it to the War Week's Slack channel ("Also post to Slack", on by default).
  Edits, deletes, pins and seed loads never post.
- A failed Slack post never blocks publishing; the poster is told it
  failed.

## Access rules

- Sign-in is Google only, plus **Test sign-in** where it is on: a secret of
  at least 32 characters is set (`TEST_SIGN_IN_SECRET`) and `VERCEL_ENV` is
  not `production`. It is typed alongside a JG email, marks its session
  (`session.test_sign_in`), shows a "Test sign-in: <email>" banner on every
  page, and counts as anonymous everywhere (pages, proxy, MCP) once it is
  off. There is no impersonation (ADR 0008). Any email whose domain isn't exactly
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
    Competition (a `competition_host` row, set in Admin → Competitions). A
    Host runs their own Competitions: their setup (not creating, deleting or
    assigning Hosts), their Bracket, their Points Entries and the Schedule
    Items linked to them, and for a `participation` Competition its
    settings, who took part, Close and Reopen (`participation.settings`,
    `.mark`, `.close`, `.reopen`). A Host can also post Announcements in a War Week
    where they host, and edit or delete their own. Hosting is per
    Competition, so a Host of one War Week's Competition has no say in
    another War Week's.
  - Everyone else signed in is a **Participant** for access purposes. Their
    writes are each found by account linking, checked in `can` and again in the mutation: reporting
    the result of a Heat they're in when self-report is on (ADR 0005);
    logging a Game they're a player in (or on a Team that is), and editing
    or deleting a Game they logged, in a `games` Competition until it
    closes (ADR 0006); enrolling or withdrawing — themselves, their
    Team, or a Squad they join or leave — in a Competition whose
    "Participants can enroll" switch is on (ADR 0006); and, the fourth of
    these kinds, **Check in** or Check out of a `participation`
    Competition whose Self check-in switch is on (ADR 0009).
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
  `src/app/admin/gate.ts`): Points Entries, the Brackets, Admin →
  Competitions and Admin → Schedule list only their Competitions and the
  Schedule Items linked to them. War Week settings, Days, Teams and roster,
  FAQ, Awards, the Organizer list and Create next War Week are
  Organizer-only pages and show a Host "Organizers and Hosts only." The
  Account menu's Admin item shows for Organizers and for anyone who hosts a
  Competition.
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
- **Award Categories** are global (no War Week), so every `award-category.*`
  action (create, rename, archive, restore) is Organizer-only and takes no
  target, like the Organizer list. A Host or Participant is refused. Awards
  themselves stay Organizer-only too.
- Standings are always visible to every signed-in user. `/<edition>/finale`
  and a finalized Bracket's `/<edition>/finale/<competitionId>` are readable
  by any signed-in JG user; Organizers and Hosts see the links to them in
  `/admin/finale`.
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
  Week." (linked by the roster email, ignoring case); "That Heat no longer exists."; "You're not in this
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
- Status changes only through the lifecycle actions in `/admin/settings`, each
  behind a confirm, never through the settings form:
  - **Start**: `upcoming → live`
  - **End**: `live → complete`, recording the **Winner**: computed
    read-only from first place in the main Standings at End (a tie reads
    "Tie: Red & Blue"; blank when nobody has points), correctable
    afterwards in Settings. Both the Winner and highlights show in the
    Archive.
  - **Reopen**: `complete → live`, for corrections in the live view.
  - **Unstart**: `live → upcoming`, for an edition started by mistake. Only
    while nothing is scored: refused once the edition has a Points Entry, a
    Heat result or a Game. Never for an edition that has been ended before
    (it has a Winner, which Reopen keeps): "This War Week has been ended;
    Unstart isn't available."
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
- **Create next War Week** (on `/admin/settings`, Organizers only) makes an
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

## Games rules

- A `games` Competition is decided by Games its players log, never a
  Bracket. Its Format is **fixed at create**: choosing `games` on the
  create form asks for a Game Type (`head-to-head`, `best-score` or
  `ranked`) and neither ever changes afterwards — add a new Competition to
  run it another way.
- The leaderboard ranks per Game Type, ties sharing the higher rank
  (standard competition ranking): head-to-head by most Games won (a draw,
  when allowed, counts for neither side); best-score by each player's best
  or total score, in the configured direction; ranked by Finish Points
  summed across Games. An Entrant with no Game is unranked, listed last
  with "—", and gets no Placement Points at Close.
- **Best of** (head-to-head only, off or 3/5/7) needs a fixed list of
  exactly two Entrants; it's decided the instant one side has a majority
  of the wins, which stops a Participant's logging (a Host or Organizer
  can still correct a Game). **Draws** are allowed or not, set per
  Competition; when off, every head-to-head Game needs a winner.
- An optional **logging close time**: after it, a Participant can no
  longer log, edit or delete a Game. A **Host or Organizer** may log, edit
  or delete any Game at any time the Competition is open, even after the
  logging close time and after a Best of is decided — they're the
  correction path, as with Bracket results.
- **Who may log, edit or delete a Game.** To log: a Participant linked by
  email who is a player in the posted
  Game, or on a Team that is, while logging is open for them; or a Host or
  Organizer, always. To edit or delete: the Participant who logged it,
  while logging is still open for them and, for an edit, still a player of
  the edited set; or a Host or Organizer. Another player in the Game can't
  touch it — they ask the Host.
- **Close** turns the leaderboard's places into Placement Points Entries
  with the Bracket's tie rule (tied places share that place's points),
  marked generated and un-editable in the ledger; **Reopen** deletes them
  again (hand-entered Points Entries on the same Competition are never
  touched). A Best of prompts Close once it's decided.
- A **closed** `games` Competition refuses every Game write, from
  everyone, Organizers included: Reopen it, make the correction, Close it
  again.
- A War Week ending is not a rule here either: a `games` Competition left
  open when its War Week ends still takes Games until the Host closes it,
  and its page keeps showing the leaderboard and log in the Archive.
- Games aren't seeded (like Squads and reporters); every Game comes from
  logging, in the app or through the smoke and e2e flows.
- A new `games` Competition starts **open to everyone**: any linked
  Participant (or their Team, in team scoring) may log without enrolling,
  until the Host switches it to a fixed list.
- A Games setting that would change the meaning of Games already logged is
  refused: switching to a fixed list while a player who's logged a Game
  isn't on it, turning Draws off while a logged Game is a draw, or turning
  Best of on when the logged Games don't fit it (more than two Entrants, or
  a decision already past what the chosen length allows).
- A Competition with any Game logged can't be deleted; delete its Games
  first, or leave the Competition in place.

## Participation rules

- A `participation` Competition is decided by who took part. Its Format is
  chosen at create and kept, like `games`' (its scoring decides how it pays). Its setup page
  is `/admin/competitions/<id>/participation`: Points per Participant (N,
  more than 0), for a team Competition how Teams score, the **Self check-in**
  switch (off by default) with an optional check-in close time, and the
  took-part list the Host or an Organizer ticks.
- **Scoring**: *individual* gives N to each Participant who took part.
  *Team* is either **ranked by headcount** (each Team's headcount ranks its
  place, ties sharing the higher place, and the Competition's Placement
  Points pay each place; a place without Placement Points gets nothing) or
  **per person** (N × headcount to each Team). A new team Competition starts
  ranked by headcount, one point per Participant.
- **Team scoring needs a Team.** A Participant on no Team can't be ticked or
  check in to a team Competition ("Only Participants on a <Team Label> can
  take part in a team Competition."). A Team is counted at **Close**, as it
  is then, so moving a Participant before Close moves the count.
- Nothing is scored until **Close**. Close turns who took part into Points
  Entries marked generated and "From participation", un-editable in the
  ledger; **Reopen** deletes them again (hand-entered Points Entries on the
  same Competition are never touched). Nobody ticked closes with no entries.
  A **closed** Competition refuses every tick, untick, check-in and
  settings save, from everyone, Organizers included: Reopen, correct, Close.
- **Check in** (ADR 0009): a linked Participant checks themselves in while
  Self check-in is on, the optional close time hasn't passed and the
  Competition isn't closed. **Check out** removes only their own
  check-in; a tick the Host or an Organizer made stays ("The Host marked you;
  ask them to remove it."). A Host or Organizer ticks and unticks anyone
  until Close, and checking themselves in is bound by the same rule as any
  Participant. A Participant whose check-in the Host removed can check in
  again while check-in is open; the Host turns Self check-in off or sets a
  close time to stop that.
- Who ticked someone is kept for audit and never sent to a page, an action
  payload or MCP (`get_participation`: names, Teams and whether they checked
  in themselves).
- Changing a Competition's scoring is refused while anyone is marked ("Remove
  who took part before changing its scoring."), and so is deleting it ("Remove
  who took part first.").
- A War Week ending isn't a rule here: the End War Week confirm only warns,
  naming a Participation Competition left open with anyone marked (linked to
  its setup page), because its points aren't in the Standings until Close.
- Recent results shows a closed Participation Competition as one row: in
  team scoring its top Team, in individual scoring how many took part.
- Who took part isn't seeded, like Games.

## Award Category rules

- An **Award Category** is global: one list across every War Week, managed
  by Organizers in a Categories section on `/admin/awards`. Seven come from
  a migration: War Week MVP, Billable Hours Champ, Black Midnight, Grow,
  Grind, Serve, Inspire.
- Names are trimmed, at most 80 characters and unique ignoring case. A
  Category is **renamed**, **archived** and **restored**, never deleted. An
  archived Category stays on the past Awards that have it (and is labeled
  archived) but can't be picked for another Award; restoring it makes it
  pickable again. An Award has one Category or none ("None" in the Award
  form's Category select).
- A seeded Category has a stable key, so renaming never breaks a seed.
- `/<edition>/awards` groups Awards under their Category's heading, linked
  to its page, then "Other Awards" for those with none; with no Category on
  any Award there are no headings. The Award's own name always shows here.
- **Through the years**: `/history` lists every Category that has an Award
  under "Awards through the years", and `/history/awards/<categoryId>` shows
  that Category's Awards by War Week, newest first, with their recipients
  (Profile names). An Award's own name shows there only when it adds to its
  Category's ("MVP 1st Place" under War Week MVP). It is keyed by id, so a rename never breaks the link; an
  unknown or malformed id is a 404.

## Enrollment rules

- **"Participants can enroll"** is a per-Competition switch, off by
  default, offered only on a Bracket or a fixed-list `games` Competition —
  never on a `points` Competition, an open-to-everyone `games`
  Competition, or a Best of (the Host sets those two Entrants by hand).
- Enrollment closes at the first of five conditions: the Bracket is built
  (has Heats); an optional Entrant limit is reached; an optional close
  time passes; the Competition is closed by the Host; or, for a `games`
  Competition, its first Game is logged.
- **Team scoring.** Any Participant on a Team can enter or withdraw their
  whole Team (a Leader is a label, never a permission). In a Squads
  Bracket (one with at least one Host-created Squad), Participants join or
  leave a Squad the Host created instead of entering a Team: their own
  Team's Squad only, at most 16 Participants, one Squad per Competition
  per Participant; the last Participant in a Squad can't leave it ("Ask
  the Host to remove the Squad."). Once any Squad exists, Team enrollment
  is refused, so an enrolled Team can never block the Host's Squads.
- **Individual scoring.** A Participant enters or withdraws themselves.
- A Participant may withdraw (or leave a Squad) any time before enrollment
  closes. After it closes, only the Host or an Organizer removes an
  Entrant.

## Finale rules

- The Finale is the closing-ceremony slideshow at `/<edition>/finale`, for
  the projector. Organizers and Hosts open it from `/admin/finale` ("Open
  Finale"); anyone signed in may watch it. One Finale slide fills the
  screen at a time, over the edition's navigation; Exit goes back to the
  edition.
- **Slide list.** Each War Week has an ordered list of Finale slides. With
  nothing saved it plays the default order: Title, By the numbers, Awards,
  Champions, Standings countdown, Winner. In admin → Finale an Organizer
  moves a slide (drag on a pointer device, or Move up/down) and hides or
  shows it; each change saves at once, and the first one saves the whole
  list. A hidden slide keeps its place in the list and is skipped by the
  Finale. A built-in missing from a saved list is added at its end. Hosts
  see the list but can't change it. With every slide hidden, the Finale
  says "Nothing to show yet."
- **Keys.** `→`, `Space`, `PageDown` or a click on the stage: next. `←` or
  `PageUp`: back. `Escape`: back to the first slide. `Space` (and `Enter`)
  on a focused button or link work that control instead, and a click on a
  link, button or video in a slide never advances. Next on the last slide
  does nothing.
- **Steps.** A slide may reveal its content in steps; Next shows the
  current slide's next step before moving on. Back shows the previous
  slide in its final state, every step shown.
- **Nothing auto-advances.** Every step and slide waits for the presenter.
- **Standings countdown.** The countdown slide plays the main leaderboard
  (team Standings in `teams` mode, individual Standings in free-for-all)
  and starts when the presenter arrives on it with Next: no Start button.
  - Rows appear from last place up to first, and tied rows appear together.
  - Totals count up from 0.
  - Every list ends together, so each first place lands at the end.
  - The whole countdown is under 8 s.
  - Next while it plays jumps to its final state; Next once it's done goes
    on. Replay plays it again and never advances. Arriving by Back shows
    the final state.
- With `prefers-reduced-motion` a slide shows its final state on arrival
  and still waits for Next.
- The Finale never reorders or recomputes Standings: it plays the same
  `getStandings` rows the leaderboard shows, read once when the page loads
  (reload for the latest).
- The home and leaderboard pages keep refreshing about every 10 s while the
  tab is visible, and always show the plain Standings.
- **Bracket Finale.** A finalized Bracket has its own Finale at
  `/<edition>/finale/<competitionId>`, readable by any signed-in JG user and
  not found for any other Competition. It plays the Bracket's final placings
  (places and names, no points) from last place to first, tied places
  together, and ends on the champion card ("Champion of <Competition>").
  It opens on a big Start button (Start, `Space` or a click on the stage
  plays it), Replay plays it again, and with `prefers-reduced-motion` Start
  still has to be pressed and shows the final state. It reads nothing
  from the Standings and changes nothing. It's linked from the Bracket's
  champion card ("Play the Finale"), the results screen once finalized, and
  `/admin/finale` ("Finale: <Competition>").

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
- **Squads**, reporters, Games and who took part aren't in seeds, and neither is a
  Competition's self-report setting, a `games` Competition's Entrants or its
  logging close time, or the enrollment switch, Entrant limit and close
  time. A reload that removes or moves a Participant leaves their Squads to
  the Organizer.
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
    (its Heats settings), `gameType`, `gameConfig` and `entrantsOpen`: a
    reload never turns an Organizer's Bracket back into `points`, changes
    its Format, undoes its Heats settings, or touches a `games`
    Competition's Game Type, Games settings, or open-to-everyone switch
    once it exists.
  - A `participation` Competition's four columns — `participationPoints`,
    `participationTeamScoring`, `selfCheckIn` and `checkInClosesAt` — are
    insert-only too (defaults: 1 point, `ranked` in team scoring, Self
    check-in off, no close time), so a reload never undoes what a Host set.
    The one thing a reload does touch is the team scoring, which follows the
    Competition's `scoring`: kept while team, `ranked` on becoming team, none
    otherwise.
  - An Award's `category` in a seed is a seeded Category's **key**, never
    its name; an unknown key fails the load naming it. It is applied when
    the Award is inserted. The one exception to "never updated" is
    fill-if-empty: a seeded Award that has no Category and was never edited
    in the app (`updated_at` still equals `created_at`) gets the seed's. An
    Organizer's choice, "None" included, is never overwritten.
  - **Award Categories** themselves come from a migration, not a seed, are
    global, and survive `--reset`.

**Setup in the UI.** Organizers can also edit setup in `/admin`: War Week
settings and the Appearance Theme in `/admin/settings`, Days and Schedule
Items in `/admin/schedule`, Teams and the roster in `/admin/roster`,
Competitions with their Hosts in `/admin/competitions` and FAQ Items in
`/admin/faq`; a Host edits
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

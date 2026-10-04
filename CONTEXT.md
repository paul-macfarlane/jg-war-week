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
| **Host**                      | A signed-in JG user an Organizer assigns to a Competition ("hosted by Tony M"), **picked from the roster by name** (email beneath), not typed. Runs that Competition; needn't be a Participant. A Schedule Item's free-text `host` field is display copy, not the Host role. |
| **Admin**                     | The management area at `/admin` that Organizers and Hosts use. A place, never a role: say Organizer or Host for people.           |
| **Competition**               | Anything that awards points. Scored as team or individual. Skill divisions are separate Competitions ("MTG Advanced", "MTG Beginner"). |
| **Competition Group**         | An optional grouping of competitions ("Team Night Events").                                                                       |
| **Competition page** (admin)  | A Competition's one admin page, `/admin/competitions/<id>`: its **Settings** on top, each field autosaving, and the Format's **run area** below it (Entrants and the Bracket tree, Entrants and Games with Log a Game, Record placements, or who took part, and Finalize, Close or Reopen). The Competitions list's Edit opens it; Add Competition creates one in a sheet and then opens it. Organizers and that Competition's Hosts use it; a Participant is refused. |
| **Settings lock**             | A Competition's settings lock as it progresses, and the page and the server refuse a locked change with the same one-line reason. Name, description, Group, Hosts and Placement Points (and points per Participant) **never lock**. Format, scoring, counts toward team, Score direction and a Best score Competition's count and direction lock **once any result exists** (an Entrant is one); a Head-to-head Competition's draws and Best of, and a Head-to-head or Best score Competition's open or fixed Entrant list, lock **once it has a Game** ("Locked once the Competition has a Game.": a Best of needs its two fixed Entrants first); heat size, how many advance, the 3rd place game, the Bracket's Entrants and building the Bracket lock **once a Heat Result exists**; self-enroll, Entrant limit, close times, self-report and check-in lock **only while Finalized or Closed**. While Finalized or Closed everything but the never-locking settings is locked until Reopen (Un-finalize for a Bracket). A points setting changed while Finalized or Closed applies at the next Finalize or Close. |
| **Competition description**   | Rich text (the Announcement editor: headings, lists, links, images by URL), edited in the Competition page's Settings and shown in full on the Participant Competition page. |
| **Points Entry**              | One ledger row: points awarded to a Team or Participant. Every Points Entry is either **generated** by a Competition's result (Finalize or Close) or **Discretionary**. Nobody types one against a Competition. |
| **Discretionary points**      | Points with no Competition behind them: a Team or Participant, a number of points and a required reason ("Subjective Points"). Organizers only, in Admin → Discretionary points; edited and deleted there. The admin page's name; the ledger row is still a Points Entry. |
| **Placement Points**          | A Competition's points for 1st, 2nd, 3rd… : an open list, highest first, never increasing, each 0 or more, with any number of places (a Bracket's has at most 4). Finalize or Close turns a result into Points Entries through it; a place beyond the list earns nothing. A Competition's top prize is its 1st place. |
| **Counts Toward Team**        | Whether an individual competition's points also go to the participant's team.                                                     |
| **Standings**                 | The main leaderboard, computed from Points Entries.                                                                               |
| **Finale**                    | The closing-ceremony slideshow at `/<edition>/finale`: the War Week's **Finale slides**, one full screen at a time, stepped through by the presenter. A finalized Bracket has its own **Bracket Finale** at `/<edition>/finale/<competitionId>`. |
| **Finale slide**              | One full-screen step of the Finale: a built-in (Title, By the numbers, Awards, Champions, **Standings countdown**, Winner) or a **Custom slide**. Each War Week orders and hides its slides in admin → Finale. |
| **Custom slide**              | An Organizer's own Finale slide: a heading (unique among the War Week's Custom slides), a rich-text body (the editor's images and video by URL) and an optional background color. It's added just before the Standings countdown, then moved, edited, hidden or deleted like any slide; a built-in is hidden, never deleted. Its text colors are overridden so they read on the background. |
| **Award**                     | A named honor given to participants or a team. It doesn't affect points.                                                          |
| **Announcement**              | A post by an Organizer or Host (rich text, videos included).                                                                      |
| **FAQ Item**                  | A question and answer pair for a War Week.                                                                                        |
| **Archive**                   | The past War Weeks shown at `/history`.                                                                                           |
| **Recent results**            | Home's section of the latest results: finalized Brackets, finalized Placements, closed Head-to-head, Best score and Participation Competitions and Discretionary points, newest first, up to 5. |
| **Format**                    | How a Competition is run, one of five: **Placement** (one result recorded on a sheet), **Head-to-head** and **Best score** (decided by Games players log, once or recurring), **Participation** (decided by who took part, ticked by the Host or checked in by the Participants themselves), or **Bracket** (a tournament: Entrants play Heats, Round after Round, to a final). "Single elimination" and "Heats" are retired as Format names: a Bracket is one Format, and a head-to-head knockout is just a Bracket of 2 per Heat with 1 advancing. Chosen when the Competition is created, and changeable between any Formats until the Competition has a result. |
| **Placement** (Format)        | A Competition whose one result is recorded on one sheet, with no Games and no Bracket. A new Competition starts as one.            |
| **Placement** (row)           | A Team's or Participant's row on a Placement sheet: a **Place** (1, 2, 3…, or none yet) and an optional **Score**. Ties share a Place.  |
| **Record placements**         | The run area of a Placement Competition on its Competition page, where an Organizer or its Host adds rows (search, or Add everyone), sets Places and Scores, then **Finalizes**. |
| **Score direction**           | A Placement Competition's setting for its Scores: none, **higher wins** or **lower wins**. With a direction, Places fill from Scores and stay editable. Set in the Competition page's Settings, and locked once any result exists. |
| **Bracket**                   | The one Format for tournaments, and the Rounds and Heats of such a Competition. Set by a **heat size** (Entrants per Heat) and **how many advance** from each Heat; 2 per Heat with 1 advancing is a head-to-head knockout (the "Head-to-head (single elimination)" preset in the Competition page's Settings), and may have a **3rd place game**. |
| **Round**                     | One step of a Bracket, holding Heats that can be played at the same time. Round 1 is the first.                                   |
| **Heat**                      | One game between Entrants in a Bracket. Covers 1v1 and multi-entrant games. Has no Day, time or location of its own: it isn't scheduled. Once played it shows its **recorded time**, when its Heat Result was recorded ("Recorded <time>"). |
| **3rd place game**            | An optional extra Heat of a head-to-head (2 per Heat, 1 advancing) Bracket of at least 4 Entrants, beside the final in the last Round: the two semifinal losers play it for 3rd and 4th. Off by default; set in the Competition page's Settings, and locked once a Heat Result exists. |
| **Recorded time**             | When a played Heat's Heat Result was recorded (shown as "Recorded <time>", and `recordedAt` in `get_bracket`). It is the time the result was saved, never a scheduled time. |
| **Entrant**                   | A Team, Participant or Squad entered in a Bracket or a fixed-list Head-to-head or Best score Competition.                                           |
| **Squad**                     | A named group of Participants of one Team, entered as one Entrant in a team-scoring Bracket — "a pair or group from one Team, playing as one entrant". Belongs to one Competition; a Participant is in at most one Squad per Competition. |
| **Self-report**               | A Participant in a Heat entering its Heat Result themselves, when the Competition allows it. It counts at once, like the Host's; the Host or an Organizer can overwrite it. |
| **Seed Position**             | An Entrant's starting rank in a Bracket. Say "seed position" or "seeding", never bare "seed" (that means seed files).             |
| **Heat Result**               | The finishing order of a Heat's Entrants, with an optional score for each.                                                        |
| **Game**                      | One recorded play in a Head-to-head or Best score Competition, logged by a player in it or by the Host: a head-to-head result (a winner, or a draw when allowed) or a score. A Game is never part of a Bracket; that is a Heat. |
| **Log a Game**                | A Participant's write, recording one Game they played in a Head-to-head or Best score Competition, in seconds, from their phone.                       |
| **Finalize** / **Reopen**     | A Placement Competition's turning its Places into generated Points Entries through its Placement Points (ties share a Place and its full points; unplaced rows earn nothing), and withdrawing them. A Bracket's pair is Finalize / Un-finalize. |
| **Close** / **Reopen**        | A Games or Participation Competition's Finalize / Un-finalize: Close turns its leaderboard's places (or, for Participation, who took part) into Points Entries; Reopen withdraws them. |
| **Entrants open** / **fixed Entrant list** | A Head-to-head or Best score Competition's Entrants are either open (anyone eligible may log a Game) or a fixed list the Host sets, like a Bracket's. |
| **Enroll** / **Withdraw**     | A Participant's writes entering or leaving a fixed-list Competition themselves, when its "Participants can enroll" switch is on. |
| **Participation**             | A Participation Competition: scored by who took part (Black Midnight, a daily workout, HQ attendance). The Host or an Organizer ticks Participants as having **taken part**, and Participants can **Check in** themselves; points land at **Close**. The Format, not a Participant's act. |
| **Check in** / **Check out**  | A Participant's write saying they took part in a Participation Competition, when its **Self check-in** switch is on (ADR 0009). Check out removes only their own check-in, never a tick the Host made. |
| **Award Category**            | A global name that groups Awards across War Weeks (War Week MVP, Grow, Black Midnight…). Managed by Organizers at `/admin/awards`; archived, never deleted. An Award has at most one. |

**Reveal** is retired: Standings are never hidden any more, and the
countdown it played is now the **Finale**.

Epic R16 retired **Game Type** (head-to-head and best score are Formats now),
**ranked** Games and **Finish Points**, **Max Points** (a Competition's top
prize is its 1st place Placement Points), the `points` and `games` Formats,
Participation's per-person team scoring, and the Points page: **Points Entry**
survives only as the ledger-row term, and **Discretionary points** is the
page and the idea.

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
- A Heat has no time of its own, so no Heat joins now/next, the schedule
  page or `get_schedule`: they list Schedule Items only. A Competition's own
  Schedule Items are unchanged.
- Home and schedule pages accept `?at=<ISO instant>` to show the schedule as
  of that moment, for demos of a War Week that isn't on right now.
- A Schedule Item has one of six categories, each with its own fixed color
  independent of the Appearance Theme: Competition, Education, Social, Meal,
  Work, and **Other**. `other` uses neutral styling, for an item that is none
  of the other five.

## Competition and roster display rules

- A Competition page shows its rich-text description in full, scoring, its result (a Placement sheet, a Bracket, Games, or who took part) and every Points Entry it generated.
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
  roster, the individual leaderboard (home, `/leaderboard`, the Finale),
  Award recipients on the Awards page and Participation lists; a Bracket
  marks Your Entrant (yourself, or your Team or Squad in a team Bracket)
  "You", and a Head-to-head or Best score Competition's leaderboard marks your enrolled Team "Your Team".
  Team Standings rows are never highlighted. Account linking wins: when the session email matches a
  Participant, that Participant is You; otherwise nobody is. There is no
  self-pick. The roster admin shows "No email: won't be linked when they sign
  in" on a Participant row without an email. Participant emails never reach
  the client, only the matched id. Past editions use their own roster.
- **The Team shows in team events.** In a teams War Week, wherever a
  Participant appears in a Competition or scoring context (Standings,
  Brackets and Heats, Placements, Games, Recent results, Points Entry ledgers, Awards,
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
    Competition (a `competition_host` row, picked from the roster by name in the Competition page's Settings by an Organizer). A
    Host runs their own Competitions: their Competition page (not creating, deleting or
    assigning Hosts; a Host sees the Hosts read-only by name and no emails), their Bracket, their Placements (`placement.edit`,
    `.finalize`, `.reopen`) and the Schedule Items linked to them, and for a
    Participation Competition its
    settings, who took part, Close and Reopen (`participation.settings`,
    `.mark`, `.close`, `.reopen`). A Host can also post Announcements in a War Week
    where they host, and edit or delete their own. Hosting is per
    Competition, so a Host of one War Week's Competition has no say in
    another War Week's.
  - Everyone else signed in is a **Participant** for access purposes. Their
    writes are each found by account linking, checked in `can` and again in the mutation: reporting
    the result of a Heat they're in when self-report is on (ADR 0005);
    logging a Game they're a player in (or on a Team that is), and editing
    or deleting a Game they logged, in a Head-to-head or Best score Competition until it
    closes (ADR 0006); enrolling or withdrawing — themselves, their
    Team, or a Squad they join or leave — in a Competition whose
    "Participants can enroll" switch is on (ADR 0006); and, the fourth of
    these kinds, **Check in** or Check out of a Participation
    Competition whose Self check-in switch is on (ADR 0009). A Participant
    never records a Placement (ADR 0010).
- `can(actor, action, target)` in `src/lib/access.ts` is the one access
  rule: it returns why the actor can't take the action, or null. It's pure;
  the caller loads the actor and the target. A Schedule Item edit needs the
  Host of both the row's current Competition and the one the request posts,
  and a Host can't unlink a Schedule Item from its Competition. Changing another person's Announcement, pinning and
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
- `/admin` opens on Competitions, in the current War Week for an Organizer. A Host opens on
  the current War Week if they host there, else their earliest upcoming
  edition, else their newest past one. The header's edition switcher (the
  `admin_edition` cookie) picks another edition the actor may view: every
  edition for an Organizer, the editions they host in for a Host. A banner
  marks the Archive ("Editing the Archive: War Week X"). Anonymous visitors
  go to sign-in; anyone else sees "Organizers and Hosts only."
- `/admin` is trimmed for a Host (`loadAdminPage` in
  `src/app/admin/gate.ts`): the Placements, the Brackets, Admin →
  Competitions and Admin → Schedule list only their Competitions and the
  Schedule Items linked to them. Discretionary points, War Week settings,
  Days, Teams and roster, FAQ, Awards, the Organizer list and Create next
  War Week are
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
  by name, with places, scores, when a played Heat was recorded, which Heat is the 3rd place game, the Bracket's heat size, how many advance and whether it has a 3rd place game, and the champion (the final's winner); a
  Squad's Participants by name, and never who reported a result.
  `get_placements` returns one Placement Competition's rows by place, with
  names, Teams, Scores and points, and whether it's finalized;
  `get_discretionary_points` the current War Week's Discretionary points,
  names and reasons. Neither carries an email.
- **Discretionary points** (`discretionary.create`, `.edit`, `.delete`, ADR
  0010) are Organizer-only: a Host or Participant is refused, and a Host
  opening `/admin/discretionary-points` sees "Organizers and Hosts only."
  The target Team or Participant must be in the request's War Week, and
  every read and write scopes by `points_entry.war_week_id`. An edit or
  delete refuses a generated entry (one with a Competition).
- **Placements** (`placement.edit`, `.finalize`, `.reopen`, ADR 0010) are the
  Organizers' and that Competition's Hosts'; a Participant is refused.
- **Award Categories** are global (no War Week), so every `award-category.*`
  action (create, rename, archive, restore) is Organizer-only and takes no
  target, like the Organizer list. A Host or Participant is refused. Awards
  themselves stay Organizer-only too.
- Standings are always visible to every signed-in user. `/<edition>/finale`
  and a finalized Bracket's `/<edition>/finale/<competitionId>` are readable
  by any signed-in JG user; Organizers and Hosts see the links to them in
  `/admin/finale`.
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

## Points Entry and Discretionary points rules

- A **Points Entry** is one ledger row for a Team or Participant. Every one
  is **generated** (by a Competition's result: a Placement's Finalize, a
  Bracket's Finalize, a Games or Participation Competition's Close) or
  **Discretionary**. There is no hand-typed entry against a Competition.
- Every Points Entry carries its War Week (`points_entry.war_week_id`), and
  every read scopes by it; a Competition join, where a read needs the
  Competition's name, is a left join.
- **Discretionary points** are given by Organizers only (a Host is refused),
  in `/admin/discretionary-points`: a Team (in a team-scoring War Week) or a
  Participant, a number of points and a **reason**, which is required and
  non-blank (stored as the entry's note). The target must be in the
  request's War Week; the server refuses anything else.
- A Participant's Discretionary points count for them and, in a teams War
  Week, toward their Team. Ties are just equal entries.
- An edit (target, points, reason) keeps the entry's entered-by email and
  entered-at time, and the admin ledger marks it as edited. A delete goes
  through a `ConfirmDialog`. Neither touches a generated entry.
- A Discretionary entry shows in Standings, in a Team's "where points came
  from" as "Discretionary: <reason>", in Recent results and in the Finale's
  totals.
- `/admin/discretionary-points` shows the current Standings next to the
  ledger. `/admin/points` and `/admin/points/<id>` redirect there.
- A generated entry's note names its source: "From placement", "From
  head-to-head", "From best score", "From bracket", "From participation".
  It is un-editable and replaced or removed only by its Competition's
  Finalize, Close or Reopen.

## Placement rules

- A **Placement** Competition holds one result on one sheet, the run
  area of its Competition page (`/admin/competitions/<id>`). A
  team Competition's rows are Teams, an individual one's Participants of the
  same War Week; each row has a Place and an optional Score. Organizers and
  the Competition's Hosts record it; a Participant sees it, read-only, on
  the Competition page (place, name, Score, points).
- Add a row by search, or **Add everyone**; adding, removing and Add everyone
  save at once, and Place and Score edits save with one Save button.
- **Score direction** (none, higher wins, lower wins) is set in the
  Competition page's Settings, and locks once any row exists. With a direction, Places fill from Scores as they're typed and stay
  editable, for ties and judgement.
- **Finalize** turns Places into generated Points Entries through the
  Competition's Placement Points. Tied rows share a Place and its full
  points, and the next Place is skipped (1, 1, 3); rows with no Place and
  Places beyond the list earn nothing. It refuses a row with a Score and no
  Place ("Give every row with a Score a Place, or clear its Score.", naming
  the rows) and a sheet with nobody placed, and is disabled while the sheet
  has unsaved edits. **Reopen** withdraws the entries.
- Rows can't change while Finalized (Reopen first). Changing the Format or
  scoring is refused once any row exists ("Locked once the Competition has
  a result."); the Settings lock table is under **Settings lock**.
- A Finalized Placement shows in Recent results and in the Finale's
  Champions.

## Bracket rules

- A Competition's **Format** is Placement, Bracket,
  Head-to-head, Best score or Participation. Only a Bracket Competition has a Bracket (and its Entrants are the Bracket's). A team Competition's Entrants are Teams or Squads, an
  individual one's Participants of the same War Week. All of a Bracket's
  Entrants are one kind.
- **Squads.** A Host or Organizer names Squads in the Competition page's run area: 1–16
  Participants of one Team, a name unique within the Competition, and a
  Participant in at most one Squad per Competition. Squads are only for
  team-scoring Brackets. A Squad's Placement Points go to its Team, so two
  Squads of one Team each earn their own Points Entry. Squads are seeded at
  random only. Changing a Participant's Team, or deleting
  them or their Team, is refused while they're in a Squad; deleting a Squad
  that is an Entrant is refused, and no Squad changes while the Bracket is
  finalized. Changing a Competition's scoring is refused while it has
  Squads; a Format change deletes them.
- **Self-report** is off by default; an Organizer or the Competition's Host
  turns it on per Competition in its Settings. A Participant linked by email
  then sees **Report result** on "Your next Heat" and enters the result of
  a Heat they're in that has no result yet. It counts at once and advances
  Entrants exactly as the Host's does. Turning it off refuses new reports
  and keeps the results already reported. A Host save that changes a
  reported result clears its reporter (the result is now the Host's), as
  does a later Heat being reset or refilled; re-saving the identical result
  keeps it. A re-draw takes the reports with the Heats.
- A Bracket's **heat size** (Entrants per Heat, 2–8) and **how many
  advance** from each Heat are set in the Competition page's Settings and lock once a Heat Result
  exists; a new Bracket is 2 and 1: the "Head-to-head (single elimination)" preset, a straight
  1v1 knockout. Anything else (4 per Heat, 2 advancing…) plays several
  Entrants at once. One Format: there is no separate single-elimination or
  Heats Format, and nothing but heat size and advancing tells them apart.
- **Generate** gives the Entrants random Seed Positions and builds the
  Bracket. There is no seeding by Standings. At 2 per Heat with 1 advancing,
  when the count isn't a power of two, the top Seed Positions get byes and
  advance straight away; a bye is never a played Heat.
- The **3rd place game** is offered only at 2 per Heat with 1 advancing and
  at least 4 Entrants (the server refuses it otherwise). It is a Heat beside
  the final, between the two semifinal losers, and the final is always the
  last Round's other Heat: the champion, Finalize and the Finale all read the
  final, never the 3rd place game. Turning it on or off rebuilds the Heats.
  Once any Heat Result exists the server refuses the change, as it does a
  heat size or advancing change: there is no forced save and no reset.
  Finalize needs it recorded when it is on.
- Regenerating, or replacing the Entrants, before any Heat Result is free.
  Once a Heat Result exists they are locked ("Locked once a Heat has a
  result."): nothing clears Heat Results to start over.
- **No Heat time or place.** A Heat has no Day, start time or location, no
  Time & place form, and no Heat is on the schedule or in Now/Next. When a
  Heat Result is saved the Heat stores its **recorded time**; a played Heat
  shows "Recorded <time>", and a re-record sets it again.
- **Recording.** One **Bracket tree** serves everyone: the Organizer or the
  Competition's Host on the Competition page's run area, and Participants on the Competition page. Whoever may record a Heat
  sees **Record result** on an unplayed Heat in the tree (an outline **Edit**
  on a recorded one, for those who may change it); a self-reporting
  Participant sees it only on their own Heat. There is no List view. On a
  phone the tree scrolls sideways in its own region, never the page.
- A Heat Result needs a clear finishing order (a head-to-head Heat's is just its
  winner). There is no Forfeit: a Heat that isn't played isn't recorded. Changing the
  winner of a decided knockout Heat, or a bigger Heat's result so different
  Entrants advance or in a different order, sends the later Heats that
  followed from it back to unplayed; an edit that changes nothing about who
  advances (scores only, or a knockout winner unchanged) changes nothing
  downstream.
- Anything but 2 per Heat with 1 advancing: each Round deals the Entrants
  into Heats snake-style by Seed Position, so Heat sizes in a Round differ
  by at most one; the top few of each Heat advance, ranked by place then by
  Heat, into the next Round, Round after Round until one Heat, the Final, is
  left. A setting that would never end (as many or more advance than a
  Round sends on) is refused at Generate. A Heat before the Final with no more
  Entrants than advance is a bye, decided without being played.
- **Finalize** turns final placings into Points Entries through the
  Competition's Placement Points, tied places each getting that place's
  points. Places come only from the final and the 3rd place game, never
  beyond 4th (a Bracket's Placement Points are capped at 4): at 2 per Heat
  with 1 advancing, the final gives 1st and 2nd, and the 3rd place game
  3rd and 4th; without one, both semifinal losers tie 3rd and there is no
  4th. A Bracket with more per Heat places the final Heat's order, up to
  4th. Nobody else is placed and earns no points.
  They're marked "From bracket", can't be edited or deleted in the
  ledger, and are replaced wholesale when the Bracket is finalized again.
  Un-finalizing deletes them. A finalized Bracket can't change until
  it's un-finalized.
- Deleting a Team or Participant that is an Entrant is refused with the
  count, and so is changing a Competition's scoring or Format once it has
  Entrants (any result locks them).
- While a Bracket is finalized, its Settings lock ("Locked while the
  Competition is Finalized or Closed. Reopen or Un-finalize it first.") except the
  never-locking ones; a Placement Points change applies at the next
  Finalize.
- Ending a War Week never refuses on an unfinalized Bracket; it only warns,
  naming it, because its placings aren't in the Standings until it's
  finalized.

## Games rules

- A Head-to-head or Best score Competition is decided by
  Games its players log, never a Bracket. Its Format can change until the
  Competition has a result (any Game or Entrant).
- The leaderboard ranks per Format, ties sharing the higher rank (standard
  competition ranking): Head-to-head by most Games won (a draw, when
  allowed, counts for neither side); Best score by each player's best or
  total score, in the configured direction. An Entrant with no Game is
  unranked, listed last with "—", and gets no Placement Points at Close.
  Games are logged, edited and deleted by Participants on the Competition
  page, and by a Host or Organizer from the admin Competition page's
  **Entrants and Games** run area (**Log a Game**, Edit, Delete).
- **Best of** (Head-to-head only, off or 3/5/7) needs a fixed list of
  exactly two Entrants; it's decided the instant one side has a majority
  of the wins, which stops a Participant's logging (a Host or Organizer
  can still correct a Game). **Draws** are allowed or not, set per
  Competition; when off, every head-to-head Game needs a winner. Draws,
  the Best of and whether the Entrants are open or a fixed list can change
  until the Competition has a Game ("Locked once the Competition has a
  Game."); a Best score Competition's count and direction lock once it has
  any result.
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
  marked generated ("From head-to-head" or "From best score") and
  un-editable in the ledger; **Reopen** deletes them again. A Best of
  prompts Close once it's decided.
- A **closed** Head-to-head or Best score Competition refuses every Game write, from
  everyone, Organizers included: Reopen it, make the correction, Close it
  again.
- A War Week ending is not a rule here either: a Head-to-head or Best score Competition left
  open when its War Week ends still takes Games until the Host closes it,
  and its page keeps showing the leaderboard and log in the Archive.
- Games aren't seeded (like Squads and reporters); every Game comes from
  logging, in the app or through the smoke and e2e flows.
- A new Head-to-head or Best score Competition starts **open to everyone**: any linked
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

- A Participation Competition is decided by who took part. Its Format is
  chosen at create and changeable until anyone is marked, like a Head-to-head or Best score Competition's (its scoring decides
  how it pays). Its Settings and the **Who took part** list are on its Competition page (`/admin/competitions/<id>`):
  for an individual Competition, Points per Participant (N, more than 0);
  for a team Competition, its Placement Points; the **Self check-in**
  switch (off by default) with an optional check-in close time; and the
  took-part list the Host or an Organizer ticks.
- **Scoring**: *individual* gives N points to each Participant who took part
  (toward their Team when the Competition counts toward team). *Team* ranks
  the Teams by headcount (ties sharing the higher place) and awards each
  place its Placement Points; a place without Placement Points gets nothing.
  There is no per-person team mode. A new team Competition starts with
  Placement Points 3, 2, 1. The setup shows N only for individual scoring
  and Placement Points only for team scoring.
- **Team scoring needs a Team.** A Participant on no Team can't be ticked or
  check in to a team Competition ("Only Participants on a <Team Label> can
  take part in a team Competition."). A Team is counted at **Close**, as it
  is then, so moving a Participant before Close moves the count.
- Nothing is scored until **Close**. Close turns who took part into Points
  Entries marked generated and "From participation", un-editable in the
  ledger; **Reopen** deletes them again. Nobody ticked closes with no entries.
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
- Changing a Competition's scoring is refused once anyone is marked ("Locked
  once the Competition has a result."), and so is deleting it ("Remove who
  took part first.").
- A War Week ending isn't a rule here: the End War Week confirm only warns,
  naming a Participation Competition left open with anyone marked (linked to
  its Competition page), because its points aren't in the Standings until Close.
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
  default, offered only on a Bracket or a fixed-list Head-to-head or Best score Competition —
  never on a Placement or Participation Competition, an open-to-everyone
  Head-to-head or Best score Competition, or a Best of (the Host sets those two Entrants by hand).
- Enrollment closes at the first of five conditions: the Bracket is built
  (has Heats); an optional Entrant limit is reached; an optional close
  time passes; the Competition is closed by the Host; or, for a Games
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
- **Built-in slides.** Each wears the War Week's Appearance Theme at
  projector scale; a slide with nothing to show is skipped.
  - **Title:** War Week, the edition and year and the Story Theme, with the
    War Week's logo and banner when set.
  - **By the numbers:** Competitions run (with at least one Points Entry),
    Games logged, Heats played (a bye isn't played), Points Entries,
    **Points handed out** (the sum of every Points Entry, generated ones
    included: not a Standings total) and Participants (the roster). Only
    non-zero figures show; with every figure zero the slide is skipped.
  - **Awards:** one Award revealed per step, grouped by Award Category
    (Categories by name, the uncategorized last as "Other Awards"). The
    War Week's **Awards layout**, set by an Organizer in admin → Finale:
    "All on one slide", or "One slide per Category" (each slide named
    "Awards: <Category>", the uncategorized "Other Awards"). No Awards: no
    slide.
  - **Champions:** every finalized Bracket's champion and the winner of every
    Finalized Placement and every closed Games or team-scoring Participation
    Competition, ties listed together, by the rule Recent results uses but never capped, in
    the order they were decided. An individual-scoring Participation
    Competition has no winner and isn't listed.
  - **Winner:** the main Standings' first place, from the same
    `getStandings` rows as the countdown; a tie for first shows as "Tie: A
    & B", as the Winner on End reads it. Skipped while there are no
    Standings rows or every total is zero (and the countdown with no rows).
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
- With `prefers-reduced-motion` animations are skipped (the countdown
  shows its final state); steps still wait for Next.
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
  - Finale slide: `(war_week_id, kind, heading)` (a built-in's heading is
    null, so each built-in is once per War Week and a Custom slide is
    unique by its heading); sort order is the position in the seed's
    `finaleSlides` list, which also sets `hidden`, and a Custom slide's body
    and background. Synced like FAQ Items: a row absent from the list is
    deleted and ids stay the same across loads. A seed that omits
    `finaleSlides` leaves the War Week's rows alone, so an Organizer's list
    survives the reload.

  Seed references between entities use these names (a Placement names its
  Competition and its Team or Participant). Removing a Team, Participant or
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
  Competition's self-report setting, a Head-to-head or Best score Competition's Entrants or its
  logging close time, or the enrollment switch, Entrant limit and close
  time. A reload that removes or moves a Participant leaves their Squads to
  the Organizer.
- A Competition's seed **description** is plain text or rich-text content; the loader stores plain text as rich text, one paragraph per line, so a seed restores descriptions after migration 0030 reset them.
- **Hosts** aren't in seeds. A plain reload never touches the Hosts of a
  Competition the seed keeps; `--reset` deletes the War Week's
  Competitions, and their Hosts go with them.
- **Organizer-owned data** is seed-initialized but never clobbered:
  - `status`, `winner` and `highlights` are applied only
    when a War Week is first inserted; the lifecycle actions and settings
    own them afterwards. A `live` seed for a new War Week while another is
    live is refused with a clear error.
  - Discretionary points, Placements, Awards (with their recipients) and
    Announcements in a seed carry a `key`. The loader inserts a keyed record only when no record
    with that key exists, and never updates or deletes one. Records organizers
    create in the app have no key and are never touched by a load. Adding a
    new keyed record to a seed and reloading adds just that record.
  - A Competition's `format` is applied only on insert, like `bracketConfig`
    (its Heats settings), `gameConfig`, `entrantsOpen`, `scoreDirection` and a
    seeded Finalize (`finalized`, `finalizedAt` and `finalizedByEmail`,
    given together): a reload never turns an Organizer's Bracket back into a
    Placement, changes its Format, undoes its Heats settings, or touches a
    Head-to-head or Best score Competition's settings or open-to-everyone switch once it exists.
    Its `scoring` and `placementPoints` do follow the seed.
  - A Participation Competition's `participationPoints` (individual only),
    `selfCheckIn` and `checkInClosesAt` are insert-only too (defaults: 1
    point, Self check-in off, no close time), so a reload never undoes what a
    Host set. An individual Competition keeps its Host's N; a team one has
    none.
  - **Placements** (`{key, competition, team|participant, place, score?}`)
    are inserted only when absent and never updated. A seeded Finalize's
    generated entries have the seed key `placement:<placement key>` and are
    written only while the Competition is still Finalized with no generated
    entries. **Discretionary points** (`{key, team|participant, points,
    reason, enteredByEmail, enteredAt}`) are idempotent on
    `(war_week_id, seed_key)`. A seed's old `pointsEntries` list is refused.
  - An Award's `category` in a seed is a seeded Category's **key**, never
    its name; an unknown key fails the load naming it. It is applied when
    the Award is inserted. The one exception to "never updated" is
    fill-if-empty: a seeded Award that has no Category and was never edited
    in the app (`updated_at` still equals `created_at`) gets the seed's. An
    Organizer's choice, "None" included, is never overwritten.
  - A War Week's `finaleAwardsLayout` (the Finale's Awards layout) is
    insert-only: set from the seed when the War Week is first inserted
    (default "All on one slide"), then owned by the Organizer's setting.
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

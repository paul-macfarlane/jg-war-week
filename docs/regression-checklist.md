# Regression checklist

The agent-run regression suite for JG War Week. An agent works through it
line by line, with no human in the loop, and reports what passed, what
failed and what it couldn't check. Each line names what to do and what
counts as a pass, so the run doesn't depend on remembering what to look at.

## What it covers, and what it doesn't

- **`pnpm gate` comes first.** Typecheck, lint, unit tests, build, smoke and
  the Playwright e2e flows run in CI on every PR and assert the core flows
  automatically. This checklist doesn't repeat their assertions.
- **This checklist covers what the gate can't judge:** every page, at
  both viewports, as every role. It checks that each page wears the right
  theme, fits a phone, says true and current things, and shows only what its
  reader needs. It also walks the flows Organizers, Hosts and Participants
  actually use end to end, the way a person would.
- **Not part of CI.** Nothing runs it automatically. An agent runs it on
  demand: before War Week each year, or whenever someone asks for a
  regression pass (all of it, or the sections they name).

## Running it

- **Verdicts:** each line is `PASS`, `FAIL` or `BLOCKED`, with the
  meanings in `docs/agents/testing.md`. `BLOCKED` means the line couldn't be
  exercised; say why. A line that "looks fine" without its check having run
  is not `PASS`.
- **Findings:** don't fix anything during the run. Each `FAIL` becomes a
  ticket under `.scratch/<feature>/issues/` with `Status: needs-triage`,
  holding the line, the viewport, the role, the screenshot path and what
  was expected. List the tickets in the run's report.
- **Judgment lines:** lines marked *(judgment)* ask whether a page carries
  more than it needs. For each, list the page's sections and the one need
  each serves (a named Participant, Host or Organizer need). `FAIL` any
  section that repeats another, serves no need, or crowds the page's main
  job off the first screen on a phone.

## Keeping it current

A PR that changes a page, a flow or a role's access updates that page's
lines here in the same PR: new pages get lines, removed features lose
theirs. Updating a line doesn't mean running it; runs stay on demand. A
line that no longer matches the app is a bug in this file.

## Setup

- Seed the current edition's demo and build: `docker compose up -d`, then,
  in a shell with the local database's `DATABASE_URL` and
  `DATABASE_DRIVER` exported (the local values are in `.env.example`),
  `pnpm build && pnpm seed:demo:<edition>` (e.g. `pnpm seed:demo:xii`).
  Then start the server the way `playwright.config.ts` does, with the e2e
  secret and no Google, or every signed-in page 500s on the session check:

  ```sh
  BETTER_AUTH_SECRET=e2e-only-secret-never-used-in-production \
    BETTER_AUTH_URL=http://localhost:3200 GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= \
    TEST_SIGN_IN_SECRET=<a string of 32 or more characters> \
    pnpm start -p 3200
  ```

  The demo makes `<edition>` the one live War Week,
  so it is the "current War Week" (`getCurrentWarWeek`: live, else next
  upcoming, else latest complete) every themed page reads. Port 3200 is the
  one `e2e/session.ts` signs cookies for.
- **Two passes, one per Mode.** Lines marked *(teams)* or *(free-for-all)*
  run only in that pass; the rest run in both.
  - **Free-for-all pass:** `pnpm seed:demo:xii` (XII, free-for-all, live;
    XI and earlier are the Archive).
  - **Teams pass:** `pnpm seed:demo` (the demo XI, teams mode, live, with
    two Teams, Captains, Awards, FAQ and `games` Competitions).
  - Each pass reseeds with `--reset`, which wipes only the seeded War Weeks
    in the local database: a War Week the run creates (Lifecycle) survives
    it, so delete that one yourself. Never run against a hosted database.
- **Navigation, for the lines below.** Participant pages: the phone tab bar
  is Home, Schedule, Competitions, Leaderboard, More (Announcements is
  More's first item); the desktop top nav adds Announcements. Admin: one
  flat nav, Points, Competitions, Schedule, Roster, Announcements, Awards,
  FAQ, Finale, Settings, Organizers, Guide (a Host sees Points,
  Competitions, Schedule, Announcements, Finale, Guide); the phone bar is
  Points, Competitions, Schedule, Announcements, More. The avatar button
  (**Account menu**) at the top right of both headers holds the account.
- **Run order:** Public Pages, then Admin as an Organizer (it links the
  Participant account and assigns the Host the later sections use), then
  Host, then User Pages.
- **Accounts:** sign in without Google with **Test sign-in** at
  `/sign-in/test`: type the email and the secret. The local server needs
  Test sign-in on, so start it with
  `TEST_SIGN_IN_SECRET=<a 32+ character string>` in its environment (as
  `playwright.config.ts` does for e2e) and no `VERCEL_ENV=production`.
  Use `+` aliases of one JG address as the accounts:
  - **Organizer:** `regression+organizer@jahnelgroup.com`, added at
    `/admin/organizers` by the first Organizer.
  - **Linked Participant:** `regression+participant@jahnelgroup.com`, after
    the Admin run puts that email on a Participant.
  - **Unlinked:** `regression+unlinked@jahnelgroup.com`, a JG account on
    no roster.
  - **Host:** `regression+host@jahnelgroup.com`, after the Admin run makes
    it a Host of one Competition.
  - **Driver:** `scripts/regression/driver.ts` signs in for you with
    `e2e/session.ts` (the e2e accounts `e2e-organizer@`, `e2e-host@`,
    `e2e-participant@` and `e2e-unlinked@jahnelgroup.com`, signed with the
    e2e secret the server was started with); use it for the page-basics
    checks, and Test sign-in for the lines below that need the real flow.
    `openAs(browser, role, width)` gives a signed-in page at a checklist
    viewport, and `pageBasics(page, dir)` runs the theme check, the
    no-horizontal-scroll and clipping checks, and saves a full-page
    screenshot. From the shell,
    `pnpm tsx scripts/regression/driver.ts <role> <width> test-results/<run>/checklist --tag=<pass> <path>...`
    prints one JSON line of results per page. Roles: `organizer`, `host`,
    `participant`, `unlinked`, `anon`.
- **Viewports:** run every line at laptop **1440×900** and iPhone
  **390×844**.
- **Theme check:** a page "wears the current War Week" when its themed root
  (`[data-theme-root]`) carries the inline `--light-*`, `--dark-*` and
  `--font-sans` of `warWeekThemeStyle` (`src/lib/theme.ts`) for the current
  War Week, taken from `seeds/demo/<edition>.json`'s colors and font (or, to
  compare against the app itself, sign in and read `/<edition>`'s root,
  since `/<edition>` is not public), and the screenshot shows that
  edition's colors and font, not a past edition's. Two by-design
  exceptions: `/admin` wears the edition being edited (an Archive edition
  picked in the switcher wears its own theme), and the History list and
  each Archive view (`/history`, `/<past edition>`) wear each past
  edition's own theme.
- **No horizontal scroll:** on each page,
  `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
  That alone cannot catch clipping (`/about`'s root has `overflow-hidden`),
  so also check that no visible text element (`h1,h2,h3,p,li,a,button,span`)
  has a `getBoundingClientRect()` that extends past the viewport's left or
  right edge.
- **Page basics:** every signed-in page below also gets the theme check,
  the no-horizontal-scroll check and a screenshot. Those three are implied by
  each line and not repeated.
- Save a screenshot per page per viewport under
  `test-results/<run>/<page>-<pass>-<width>/` (e.g.
  `admin-announcements-ffa-390/`, `admin-announcements-teams-390/`, so the
  two passes don't overwrite each other) and record each line's verdict in
  the run's report (the ticket's closeout when a ticket asked for the run).

## Public Pages

`/sign-in`, `/about`, `/privacy`, `/terms`, signed out.

- [ ] **Sign-in wears the current War Week.** Open `/sign-in`; its colors
      and font match the current War Week (theme check above).
- [ ] **About wears the current War Week, stills included.** Open `/about`;
      the page passes the theme check, and every still (the hero Standings,
      the Finale poster and each "What it does" card) shows the current
      War Week's colors, not a past edition's. If not, refresh them:
      `pnpm build && pnpm seed:demo:<edition>`, then
      `pnpm tsx scripts/about-media.ts`.
- [ ] **About is up to date, without redundancy or salesy copy.** Read
      `/about` against the app today: every "What it does" card describes a
      feature that exists, in the app's navigation order; nothing is said
      twice; no hackathon leftovers, maintainer pitch or over-promise; no
      copy assumes Teams mode (the current War Week may be free-for-all).
- [ ] **Privacy and Terms are up to date and name the admins.** Read
      `/privacy` and `/terms`: everything they say is true of the app today,
      nothing is said twice, they pass the theme check, and the contact line
      reads "Contact the Jahnel Group admins."
- [ ] **Footer shows the current year.** Every public page's footer reads
      "© <this year> Jahnel Group".
- [ ] **Nothing is cut off on a phone.** At 390×844, every public page passes
      the no-horizontal-scroll check, and no text is clipped (read the
      screenshot: every heading and paragraph wraps fully).

## Admin, as an Organizer

`/admin/**` as the Organizer, in the current War Week unless a line says
otherwise. Every create, edit and delete below ends with the change visible
on the matching War Week page.

- [ ] **Lands on the current War Week, on Points.** Open `/admin`; it
      redirects to `/admin/points` (there is no Overview or Setup hub). The
      header names the current War Week, and the edition switcher (in the
      header at 1440, in More at 390) lists every edition. Switch to a past
      edition: the banner reads "Editing the Archive: War Week <X>". Switch
      back.
- [ ] **Flat admin nav.** At 1440 the side nav lists Points, Competitions,
      Schedule, Roster, Announcements, Awards, FAQ, Finale, Settings,
      Organizers, Guide, in that order, current page highlighted. At 390 the
      bottom bar is Points, Competitions, Schedule, Announcements, More, and
      More's Sheet holds the other seven plus the edition switcher; More is
      highlighted on a page that lives in it (e.g. Settings).
- [ ] **Old Setup URLs redirect.** `/admin/setup` and `/admin/setup/war-week`
      land on `/admin/settings`; `/admin/setup/days` and
      `/admin/setup/schedule` on `/admin/schedule`; `/admin/setup/teams` on
      `/admin/roster`; `/admin/setup/competitions` on `/admin/competitions`;
      `/admin/setup/faq` on `/admin/faq`.
- [ ] **Account menu in admin.** The header's right side is the avatar
      alone at 1440 and 390. Opening it shows the name and email, Display
      (Light, Dark, System), Profile, "Back to War Week", "Join the Slack channel"
      (when the War Week has a Slack URL) and Sign out. Enter opens it,
      arrows move, Escape closes. Display changes restyle admin and survive
      a reload.
- [ ] **Every list row has Edit and Delete.** On Competitions, Schedule
      (Days and Items), Roster (Teams and Participants), Announcements,
      Awards, FAQ and Organizers, each row shows a visible **Edit** and a
      **Delete** button (touch targets at least 44px at 390). Edit opens the
      form in a dialog at 1440 and a bottom sheet at 390 (Announcements'
      Edit goes to its own page); Delete opens a confirm and ends in a
      toast. There is no whole-row hidden button. Schedule, FAQ and Awards
      have no `/new` or `/[id]` page: `/admin/schedule/new`,
      `/admin/faq/new` and `/admin/awards/new` redirect to their list.
- [ ] **Settings autosave and show.** In Settings, change the Story Theme,
      the dates (DateRangePicker: picking the end date leaves it open until
      Done), the Slack URL and one Appearance Theme color. There is no Save
      button; the heading shows "Saving…" then "Saved" after each change.
      The preview shows both schemes, and `/<edition>` shows the new Story
      Theme, dates and color after a reload. Reload Settings: every change
      persisted. Restore the originals.
- [ ] **Settings refuse bad input at the field.** A Slack URL that isn't
      `https` (e.g. `http://jahnelgroup.slack.com/x`) shows "Slack URL must
      be an https URL." at its field (text that isn't a URL at all is
      stopped earlier by the browser's own "Please enter a URL."). An end
      date before the start date shows "Start date must not be after the
      end date." at Dates: the DateRangePicker can't produce one (a second
      tap before the first just reorders the range), so set the form's
      `startDate` and `endDate` inputs in the page (e.g. `2027-02-26` and
      `2027-02-21`) and let it autosave. Each time the error shows at the field, the value
      stays typed in the field, and nothing is saved (reload Settings to
      confirm the old value).
- [ ] **Settings: Team fields follow Mode.** In Settings,
      *(free-for-all)* Team Label and Leader Title are hidden and Roster
      has no Team controls; set Mode to Teams (it autosaves) and they show
      with their saved values. Restore the Mode.
- [ ] **Days.** On `/admin/schedule` the Days sit together with their
      Schedule Items on one page. Add a Day inside the War Week with a Day
      Theme (Add Day, a dialog or sheet); it shows on
      `/<edition>/schedule`. Give it a Day description (up to 280 characters); it shows under the Day
      Theme on `/<edition>/schedule` and, for today's Day, in Home's Now/Next
      Today header. Edit it through its Edit button. The Day picker greys out dates that already have
      a Day (not the edited Day's own date) and dates outside the War Week,
      so the form can't post a duplicate (the server's "There's already a
      Day on <date>." is unit-tested in `src/mutations/setup.test.ts`).
      Delete the added Day through its Delete button and confirm. When every date already has
      a Day (the XI demo), widen the War Week's dates by one in settings
      first and restore them after.
- [ ] **Roster: add, link, edit, delete.** On `/admin/roster`, add a
      Participant (on a Team, *(teams)*); edit an existing Participant's email to
      `e2e-participant@jahnelgroup.com` (this is the linked Participant the
      User Pages use; pick one in the top five of the Standings, e.g. Cass
      Comet in the XII demo or Anthony Conway in the XI demo, so the
      Standings show the You highlight);
      a Participant row without an email shows "No email: won't be
      linked when they sign in"; delete the added Participant through its
      confirm.
      *(teams)* Add a Team, mark a Leader (e.g. the added Participant, on
      the new Team, as Captain); the Captain title shows on
      `/<edition>/teams`; delete the Team (a Team with Participants can't
      be deleted, so delete its Participant first).
- [ ] **Roster import.** On `/admin/roster` as an Organizer, Import: paste
      rows from a sheet (name, email, team, company tag, leader). The
      preview badges each row Add, Update (matched by email, shows the
      changes), Unchanged or Error (an unknown Team is an Error, never
      created); Import adds and updates only the valid rows. As a Host
      there is no Import and the server refuses it. Delete what you added.
- [ ] **Competitions, one of each Format.** Create a `points` Competition
      with Placement Points 5/3/1, a `single-elimination` Competition, and a
      `games` Competition with `head-to-head` (Add Competition lands on its
      Games page: set Entrants to "A fixed list", turn on "Participants can
      enroll", Save settings); assign `e2e-host@jahnelgroup.com` as Host of
      the `points` one (the Hosts field is on its Edit form, not Add). Each
      shows on `/<edition>/competitions` (when the War Week has Groups, as
      the XI demo does, one without a Group is under the Other
      Competitions tab).
- [ ] **Run a Bracket end to end.** In the `single-elimination`
      Competition's Bracket setup, pick Entrants and Save Entrants, then
      Generate (or By Standings) to seed and build it. *(teams)* A new
      Competition scores by Team: Add Squad two Squads per Team, set
      Entrants are to Squads and press All Squads; the finalized Placement
      Points go to each Squad's Team. On its results
      screen, give a Heat a Day, time and location with Time & place (it
      shows in Home's Up next with `?at=` set just before that time), record
      every Heat (a dialog at 1440, a bottom sheet at 390), and finalize.
      The finalized Bracket's Placement Points appear in Points Entries and
      the Standings, and "Play the Finale" opens its Bracket Finale.
- [ ] **Close a `games` Competition.** Log two Games as the Organizer in
      a `head-to-head` Competition with Placement Points (Log a Game on its
      public Competition page), then Close on its Games page: its top
      finishers get Placement Points and the Standings move. Reopen
      withdraws them. *(teams)* Add it with Scoring Individual and Counts
      toward the Team on, so the Team Standings move.
- [ ] **Points Entries.** Add a Points Entry with a Placement Points button,
      edit its points, delete it; `/<edition>/leaderboard` follows each
      change within about 10 s without a reload.
- [ ] **Schedule Items.** On `/admin/schedule`, add a Schedule Item on a
      Day, linked to a Competition; it shows on `/<edition>/schedule` under
      that Day with its time in ET and links to the Competition. Edit it
      (sheet or dialog, no separate page), then delete it (confirm and
      toast).
- [ ] **Announcements.** Post an Announcement with a heading, a quote, a
      link, a captioned image (by URL) and a video (the editor's Video
      button), then pin it. The form has no Video links field, and the
      editor's toolbar buttons show their keyboard shortcut in a tooltip. It
      shows first on the Announcements
      page and as the pinned card on Home, with every element rendered.
      Pinned Announcements sort newest first and a demo's are dated in its
      War Week, after anything posted today, so unpin the seeded pinned one
      first and pin it again at the end. Unpin, then delete. The admin list
      shows "Posted by <name>" (the poster's display name or the part of
      their email before the @, never the email) and no video count. MCP `get_announcements` returns no
      `videoUrls`; the video shows as its URL in the plain-text body.
- [ ] **Awards.** Give an Award to two Participants (and a Team,
      *(teams)*); it shows on `/<edition>/awards`. Delete it.
- [ ] **FAQ.** Add an FAQ Item and move it first; `/<edition>/faq` shows it
      first. Delete it.
- [ ] **Organizers.** Add `e2e-extra@jahnelgroup.com`, then remove it
      through its confirm. The last Organizer can't be removed: with only
      one Organizer listed, its Remove control is gone and the page says
      "The last Organizer can't be removed." If others are listed, delete
      their rows from the local `organizer` table for this check and put
      them back after; never remove a real Organizer in the app.
- [ ] **Lifecycle.** On Settings (the Lifecycle box and Create next War
      Week live there, not on a separate page; the seed-overwrite warning
      shows there too, and only there), Create next War Week makes an Upcoming edition (copy
      settings only). Start on it is refused while the current one is live
      ("End <X> first."). End the current War Week: its confirm names any
      generated Bracket that isn't finalized and any open `games`
      Competition with at least one Game, and on End it records the Winner
      from first place. Unstart on a live edition with nothing scored (an edition freshly
      started, e.g. XII) goes back to Upcoming behind a confirm; on one with
      a Points Entry, Heat result or Game it is refused. Reopen makes it live again. Reopen is refused while
      a later edition is upcoming ("War Week <Y> is next; reopen isn't
      available."), so before Reopen delete the edition this line created
      from the local database (`delete from war_week where edition =
      '<new>'`; `--reset` doesn't remove it). In the teams pass XII is
      upcoming too: delete it as well; the closing `pnpm seed:demo`
      restores it.
- [ ] **Finale links.** `/admin/finale` links to the Finale and to each
      finalized Bracket's Finale; both open.
- [ ] **Forms behave the same everywhere.** On a long form (Competition),
      resize from 1440 to 390 (crossing 768) with typed input: the input
      survives the dialog-to-sheet switch. At 820 the add-Participant and
      *(teams)* Squad (Bracket setup → Add Squad) forms are dialogs; at
      390, bottom sheets. Every delete
      above used `ConfirmDialog`, and every save and delete showed a toast.
- [ ] **The Guide is true.** Read `/admin/guide`: every step names a page
      and control that exists and works as described (it is written for the
      flat nav: Settings, Schedule, Roster, no Setup hub).
- [ ] **No admin page carries more than it needs.** *(judgment)* Apply the
      judgment rule to every admin page (Points through Guide), every list
      page and every form.

## Admin, as a Host

`/admin/**` as `e2e-host@jahnelgroup.com`, Host of one `points`
Competition (from the Organizer run).

- [ ] **Six sections, trimmed to their Competitions.** The admin nav is
      Points, Competitions, Schedule, Announcements, Finale, Guide at 1440;
      at 390 the bar is Points, Competitions, Schedule, Announcements, More
      (Finale and Guide in More). Points Entries (its Competition picker and
      its Brackets and Games lists), Competitions and Schedule list only the
      Host's Competition and its Schedule Items. Each row has Edit and
      Delete where the Host may use them.
- [ ] **Organizer-only pages refuse.** Settings, Roster, FAQ, Awards and
      Organizers (open their URLs directly) each show "Organizers and Hosts
      only."; there is no Lifecycle box, no Create next War Week and no
      Add Competition or Days editor.
- [ ] **Account menu as a Host.** The avatar menu offers "Back to War Week"
      in admin and Admin on participant pages (a Host is not a plain
      Participant), plus Display and Sign out.
- [ ] **What a Host can do works.** Add, edit and delete a Points Entry on
      their Competition; post an Announcement, edit it and delete it. They
      can't create or delete a Competition or assign Hosts: no Add
      Competition, Delete or Hosts control (the server's refusal is
      unit-tested in `src/lib/access.test.ts`).
- [ ] **Not a Host elsewhere.** Switch to another edition (if offered), or
      set the `admin_edition` cookie to a past edition, and open another
      War Week's admin URL (e.g. `/admin/points/<an XI Points Entry id>`,
      `/admin/brackets/<a Competition they don't host>`; the teams demo has
      no Points Entries outside XI, so use `/admin/brackets/<an X
      Competition id>`): nothing to manage there.

## User Pages

Every War Week page, signed in as the **linked Participant** unless a line
says otherwise. Run each line again as the **unlinked** account and check
that nothing personal shows (no You highlight, no Log a Game).

- [ ] **Home.** `/<edition>` shows the hero, Now/Next for the time given by
      `?at=` (pick a time with a Schedule Item and a timed Heat), the
      pinned Announcement, Recent results and the top of the Standings: *(free-for-all)*
      with the linked Participant highlighted as You; *(teams)* the Team
      Standings, which carry no You (it marks individual rows: Leaderboard,
      Teams). With a `games` Competition open, the
      "Log a Game" shortcut shows for the linked Participant only. There is no
      "Join the Slack channel" button on Home (it moved to the account
      menu). The XII
      demo has no timed Heat: as the Organizer, generate a Bracket with the
      linked Participant in it (e.g. Chess Heats) and time an unplayed Heat,
      then use a `?at=` just before it.
- [ ] **Recent results.** After a Bracket is finalized or a `games`
      Competition closed and Points Entries are added, Home's Recent
      results lists up to 5 rows newest first (a champion, a winner, a
      Competition's Points Entries grouped in one row, e.g. "Trivia: Red 10,
      Blue 5"), each linking to its Competition, with "All Competitions"
      opening `/<edition>/competitions`. With nothing scored the section is
      hidden. It follows a new result within about 10 s.
- [ ] **Navigation.** At 390 the tab bar is Home, Schedule, Competitions,
      Leaderboard, More, with the current page's tab highlighted:
      Competitions on `/<edition>/competitions` and on a Competition page,
      More on Announcements, Roster, Awards, FAQ and About. At 1440 the top
      nav is Home, Schedule, Competitions, Leaderboard, Announcements, More.
- [ ] **Log a Game from a phone.** At 390, log a head-to-head Game from
      Home's shortcut against another Entrant; it shows in that
      Competition's Game log as the newest Game, and its leaderboard
      updates. As the unlinked account, there's no shortcut and no Log a
      Game on the Competition page (the server's refusal of a posted Game
      is unit-tested in `src/lib/access.test.ts`).
- [ ] **Enroll and withdraw.** In the self-enroll Competition, the linked
      Participant enrolls, withdraws and enrolls again; the Entrant list
      follows each step.
- [ ] **Schedule.** `/<edition>/schedule` lists every Day with its Day
      Theme, Day description (when it has one) and Items in time order (ET),
      filterable by Day; each linked
      Competition opens.
- [ ] **Competitions.** `/<edition>/competitions` lists every Competition.
      Open one of each Format: a `points` Competition shows its Points
      Entries; a Bracket shows the tree (one Round at a time at 390, with a
      List toggle) and its champion once finalized; a `games` Competition
      shows its leaderboard with the Game Type's columns and the Game log
      newest first, with the "Mine" filter.
- [ ] **Teams show in team events.** *(teams)* Wherever a Participant
  appears in a Competition or scoring context (individual Standings, a
  Bracket's entrants and Heat results, the Games leaderboard and Game log,
  Recent results, a Competition's ledger, Award recipients, the Finale,
  Now/Next), their Team shows by name where there's room, else by its
  color, including for a Participant whose Avatar is a Profile picture (`CONTEXT.md`, "The Team shows in team events").
- [ ] **Leaderboard.** `/<edition>/leaderboard` shows the main Standings
      (Team Standings *(teams)*, individual Standings *(free-for-all)*), the
      points breakdown per row, and the linked Participant highlighted.
- [ ] **Announcements.** The Announcements page (`/<edition>/announcements`;
      at 390 it is More's first item and More is highlighted there)
      lists the pinned Announcement first, renders rich text (headings, quotes, captioned images) and videos, and
      shows who posted each by name, never an email.
- [ ] **Roster.** `/<edition>/teams` *(teams)* shows each Team in its
      color with its Captain and Participants; *(free-for-all)* the
      Participants. The linked Participant is highlighted.
- [ ] **Awards and FAQ.** `/<edition>/awards` and `/<edition>/faq` show
      their content, or a plain empty state when there is none (XII demo).
- [ ] **History.** `/history` lists every past War Week with its Story
      Theme and Winner; open three past editions, including the oldest:
      each shows its archive view.
- [ ] **Finale.** `/<edition>/finale` opens on Start. Pressing Start counts
      the main Standings in from last place to first, ties together, within
      8 s (`FINALE_MAX_MS`; time it in the page, from the Start click to
      `[data-finale="done"]`: a frame or two over 8000 ms is the animation
      clock, Playwright's own waits add more), ending in the same order as
      the Leaderboard. Replay works. With `prefers-reduced-motion` it still
      waits for Start, then jumps to the end.
- [ ] **Account menu.** The avatar button at the top right (at 1440 and
      390; no email text, no Sign out button beside it) opens a menu with
      the name and email, Profile, Display, "Join the Slack channel" (when the War
      Week has a Slack URL; it opens it) and Sign out; for the Organizer and
      the Host it also has Admin, which opens `/admin/points`; for a plain
      Participant (the linked or the unlinked account, never a Host) there
      is no Admin item. Enter opens it, arrows move,
      Escape closes.
- [ ] **Test sign-in banner.** Signed in through `/sign-in/test`, every page
      (public ones, admin and participant pages) shows a "Test sign-in:
      <email>" strip with that email, above the page. Open `/sign-in/test`
      with Test sign-in off (restart the server without
      `TEST_SIGN_IN_SECRET`): it is a 404, and the old test session counts as
      signed out (a page goes to `/sign-in`). A wrong secret and a non-JG
      email are each refused with a message.
- [ ] **Profile page.** "Profile" in the account menu opens
      `/<edition>/profile`. It has a Profile name field (a hint says what
      shows when it is empty: the roster name), a Picture URL field and a
      "Use Google photo" button that clears it, and a Light and a Dark
      preview side by side (stacked or fitting at 390, no horizontal
      scroll). Save a name and an `https://` picture URL: both preview at
      once and persist after a reload; an `http://` URL is refused at the
      field. Empty both and save: the roster name returns.
- [ ] **Profile name and picture show everywhere.** As the linked
      Participant, set a Profile name and an `https://` picture URL, then
      check the name and picture on the Teams roster, the Leaderboard
      (Standings), a Competition's Games and Awards, and Recent results on
      Home. Open a past War Week the same email is on: it shows the Profile
      name too. As the Organizer, the roster form shows that name read-only
      with "Set by the person".
- [ ] **Delete my account.** At the bottom of the Profile page, "Delete my
      account" opens a confirm that needs the email typed (the button stays
      disabled until it matches, ignoring case). As the only Organizer it is
      refused with a message, and the account stays. As the linked
      Participant it signs you out to `/`; sign in again with the same
      address and the Teams roster shows the roster name again, not the
      Profile name, with Awards, results and Announcements intact.
- [ ] **Display.** In the account menu, Light, Dark and System each restyle
      every page above, and the choice survives a reload. In Dark, text
      passes contrast (axe) on Home, Leaderboard and a Competition.
- [ ] **More.** Every link in More (the page at 1440, the sheet at 390:
      Announcements *(390 only)*, Roster, Awards, FAQ, War Week history,
      Install app, About) opens its page. More has no "Signed in as" or
      Display rows; Admin is in the account menu, not here.
- [ ] **Access.** Signed out, `/<edition>` goes to
      `/sign-in?callbackURL=%2F<edition>` (finish it with Test sign-in at
      `/sign-in/test` and check it returns to `/<edition>`). As the linked Participant, `/admin` (which redirects to
      `/admin/points`) shows "Organizers and Hosts only."
- [ ] **No page carries more than it needs.** *(judgment)* Apply the
      judgment rule to every page above, at 390 first.

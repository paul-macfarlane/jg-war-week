# Regression checklist

The agent-run regression suite for JG War Week. An agent works through it
line by line, with no human in the loop, and reports what passed, what
failed and what it couldn't check. Each line names what to do and what
counts as a pass, so the run doesn't depend on remembering what to look at.

## What it covers, and what it doesn't

- **`pnpm gate` comes first.** Typecheck, lint, unit tests, build, smoke and
  the Playwright e2e flows run in CI (on PRs into `main`) and assert the
  core flows automatically. This checklist doesn't repeat their assertions.
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
    two Teams, Captains, Awards, FAQ and Head-to-head and Best score Competitions).
  - Each pass reseeds with `--reset`, which wipes only the seeded War Weeks
    in the local database: a War Week the run creates (Lifecycle) survives
    it, so delete that one yourself. Never run against a hosted database.
- **Navigation, for the lines below.** Participant pages: the phone tab bar
  is Home, Schedule, Competitions, Leaderboard, More (Announcements is
  More's first item); the desktop top nav adds Announcements. Admin: one
  flat nav, Competitions, Discretionary points, Schedule, Roster,
  Announcements, Awards, FAQ, Finale, Settings, Organizers, Guide (a Host
  sees only Competitions and Guide); the phone bar
  reads Competitions, Points, Schedule, News, More (the short labels read
  in full to assistive tech). The avatar button
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
  - **Host:** `regression+host@jahnelgroup.com`, after the Admin run puts
    that email on a roster Participant and makes them a Host of one
    Competition (a Host is a roster Participant).
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
  picked in the switcher wears its own theme), and each Archive view
  (`/<past edition>`) wears that past edition's own theme. `/history` and
  `/history/awards/<id>` wear the current War Week, like any participant
  page; only the edition cards on `/history` show their own colors.
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

- [ ] **Lands on the current War Week, on Competitions.** Open `/admin`; it
      redirects to `/admin/competitions` (there is no Overview, Setup hub or
      Points page). The header names the current War Week, and the edition
      switcher (in the header at 1440, in More at 390) lists every edition.
      Switch to a past edition: the banner reads "Editing the Archive: War
      Week <X>". Switch back.
- [ ] **Flat admin nav.** At 1440 the side nav lists Competitions,
      Discretionary points, Schedule, Roster, Announcements, Awards, FAQ,
      Finale, Settings, Organizers, Guide, in that order, current page
      highlighted. At 390 the bottom bar reads Competitions, Points,
      Schedule, News, More (the short labels for Discretionary points and
      Announcements, set in Inter in both Display font presets: check it with
      each at 390, no label wrapping or clipped), while the tabs' accessible
      names stay "Discretionary points" and "Announcements"; More's Sheet
      holds the other six plus the edition switcher and spells them out in
      full; More is highlighted on a page that lives in it (e.g. Settings).
      The side column at 1440 still reads "Discretionary points" and
      "Announcements".
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
      form in a dialog at 1440 and a bottom sheet at 390 (only Competitions'
      Edit goes to its own page); Delete opens a confirm and ends in a
      toast. There is no whole-row hidden button. Schedule, FAQ and Awards
      have no `/new` or `/[id]` page: `/admin/schedule/new`,
      `/admin/faq/new` and `/admin/awards/new` redirect to their list;
      `/admin/announcements/new` and `/admin/announcements/<id>` answer 404.
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
      `/<edition>/schedule`. Give it a Day description (up to 280
      characters, counted under the field); it shows under the Day Theme on
      `/<edition>/schedule` and, for today's Day, in Home's Now/Next Today
      header. Edit it through its Edit button. The Day picker greys out
      dates that already have a Day (not the edited Day's own date) and
      dates outside the War Week, so the form can't post a duplicate (the
      server's "There's already a Day on <date>." is unit-tested in
      `src/mutations/setup.test.ts`). Delete the added Day through its
      Delete button and confirm. When every date already has a Day (the XI
      demo), widen the War Week's dates by one in settings first and
      restore them after.
- [ ] **Roster: search.** On `/admin/roster` at 1440 and 390, Add
      Participant and Import (Organizer) sit at the top, above the list. The
      search box filters the list by name or email (case-insensitive, no
      cap) and shows "N of M"; a query that matches no one shows "No one
      matches '<q>'"; clearing it brings everyone back. In the 100-Participant
      scale demo, a part of a name or an email finds the person.
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
      rows from a sheet without a header (*(teams)* name, email, Team,
      Company Tag, Leader; *(free-for-all)* name, email, Company Tag, as
      the hint says). The preview badges each row Add, Update (matched by
      email, shows the changes, a cleared field in bold), Unchanged or
      Error (an unknown Team is an Error, never created); Import adds and
      updates only the valid rows. As a Host there is no Import and the
      server refuses it. Delete what you added.
- [ ] **Competitions, one of each Format.** Create a Placement Competition
      with Placement Points 5/3/1, a Bracket Competition, and a
      Head-to-head Competition (Add Competition creates it in a sheet and
      opens its Competition page: on the Bracket turn on "Participants can
      enroll", on the Head-to-head pick its two Entrants; each saves as you
      change it); assign
      the roster Participant whose email is `e2e-host@jahnelgroup.com` as
      Host of the Placement one (the Hosts field is in its page's Settings,
      not in Add; see the Competition page lines below). The Format select
      offers Placement, Bracket, Head-to-head, Best score
      and Participation (no Single-elimination or Heats, no "Games" Format or Game Type). Only the
      Bracket offers "Participants can enroll"; no Format offers a "closes at" time. Each
      shows on `/<edition>/competitions` (when the War Week has Groups, as
      the XI demo does, one without a Group is under the Other
      Competitions tab).
- [ ] **Placement Points: 20 places at 390.** At 390, in a new
      Competition's page Settings, add Placement Points places up to 20 with
      "add a place": every place is reachable with no sideways scroll, a
      place can be removed from anywhere in the list, and there is no 5·3·1
      quick fill; a list that rises (1, 3) is refused. On a Bracket the list
      stops at 4 places with the message naming the limit.
- [ ] **Record placements: add rows.** On the Placement Competition's
      page, under "Record placements", add a row by search (Teams for a team
      Competition, Participants for an individual one): it saves at once, and
      there is neither an Add everyone button nor a 5 · 3 · 1 button (assert
      neither exists). Remove one. Edit a Place and press Save.
- [ ] **Record placements: Score direction and unit.** Set Score direction to Higher
      wins and type Scores: the Places fill from the Scores (highest first);
      switch to Lower wins and they refill (lowest first); the Places stay
      editable (make two tie: 1, 1, then 3, and a Place set against the
      Scores shows "set by hand"). Set it to none and Places are manual. Set
      the Score unit to "sec": the Score column header reads "Score (sec)"
      and the unit never locks.
- [ ] **Score direction and unit on every scored Format.** In the Settings of
      a Bracket, a Head-to-head and a Best score Competition, Score direction
      and Unit are offered (Best score: higher or lower only, never none;
      Participation shows neither). In a Group Bracket Match, once every
      Entrant has a Score the places follow the Scores; in a Head-to-head
      Match the higher or lower Score wins, equal Scores record a Draw when
      draws are allowed and otherwise need a pick shown as "set by hand".
- [ ] **Record placements: Score without a Place.** Type a Score on a row
      and clear its Place: Close is refused with "Give every row with a
      Score a Place, or clear its Score.", naming the row(s). A sheet with
      nobody placed refuses too, and Close is disabled while there are
      unsaved edits.
- [ ] **Record placements: Close and Reopen.** Close behind its
      confirm: the Standings move (ties share the place's points, 1st gets
      the 1st Placement Points, unplaced rows nothing), the Competition
      shows in Home's Recent results and in the Finale's Winners, and its
      page shows the Placements as the results table (Rank, name, Score,
      War Week points, with the Winner marked and Top finishers above it) for a
      Participant. Before Close the points header says "Provisional" and
      Close removes the badge. Rows can't change while Closed. Reopen withdraws the
      points from the Standings. Changing the Format while rows exist is
      locked ("Locked once the Competition has a result.").
- [ ] **Record placements: a Participant is refused.** As the linked
      Participant, open `/admin/competitions/<id>`: "Organizers and Hosts
      only." and no page; their Competition page shows the result read-only.
- [ ] **Discretionary points: give, edit, delete.** On
      `/admin/discretionary-points` (the page opens with the Standings beside
      the ledger), give points to a Team or Participant with a reason (an
      empty Reason is refused), edit its points and reason, then delete it
      behind a confirm; `/<edition>/leaderboard` follows each change within
      about 10 s, and the points breakdown reads "Discretionary: <reason>".
      `/admin/points` redirects to this page. *(Host refused: see Admin, as a
      Host.)*
- [ ] **MCP: `get_placements` and `get_discretionary_points`.** Call each
      against a signed-in session or `MCP_TOKEN`: `get_placements` for the
      Placement Competition by name returns its Score direction, Placement
      Points, closed state and rows by place with names, Teams, Scores and
      points; `get_discretionary_points` returns the current War Week's
      entries by name and reason. Neither output contains an `@`. For a
      Placement Competition `get_bracket` points to `get_placements`.
- [ ] **Run a Bracket end to end.** On the Bracket Competition's page
      (Format "Bracket"), leave the Bracket kind on Head-to-head (the toggle
      beside Group; 2 per Match, 1 advancing, no size fields shown), pick Entrants and Save Entrants, then
      Generate to build it. There is no By Standings button and no Time &
      place. *(teams)* A new Competition scores by Team: Add Squad two
      Squads per Team, set Entrants are to Squads and press All Squads; the
      closed Placement Points go to each Squad's Team. Record every Match from the tree on the same page (a
      dialog at 1440, a bottom sheet at 390); no Match has a Forfeit option,
      and each played Match shows "Recorded <time>". Close. The closed
      Bracket's Placement Points appear in Points Entries and the
      Standings, and its Competition page shows **Top finishers** (1st and 2nd,
      each with points, 1st marked Winner) in place of the old Champion card, with no
      Points Entries section and no "Play the finale" button on the page or in the admin
      Bracket. `/<edition>/finale/<competitionId>` for that Competition shows
      the 404 page, and `/admin/finale` has no "Bracket Finales" section.
- [ ] **Bracket: 3rd place match.** In a head-to-head Bracket of at least 4
      Entrants (a new Bracket of 4 or 8), turn on the Bracket's 3rd place
      match switch: the tree shows it beside the Final, labelled "3rd place
      match"; with 3 Entrants, or on a Group Bracket, the switch is off or
      absent with a reason. Record the semifinals, the
      final and the 3rd place match and Close: the Winner is the
      final's winner whichever Match was recorded last, and Points Entries
      give 1st, 2nd, 3rd and 4th their Placement Points (a fifth place is
      refused: Placement Points stop at 4); Top finishers lists the same four
      places with their points. Once any Match has a result the
      switch can't change. Without the 3rd place match, only 1st and 2nd are
      placed: Close gives Placement Points to 1st and 2nd only (the semifinal
      losers get none), and Top finishers shows 1st and 2nd only (a semifinal loser is neither placed nor shown).
      A Group Bracket shows the final Match's order.
- [ ] **Bracket admin: Entrants and Seed Positions fold.** At 1440 and 390,
      on a Bracket's admin page there is no Round 1 Preview list. While
      no Match has a result the Squads, Entrants and Seed Positions show
      open as before. Once any Match has a result they fold into one closed
      "Entrants and Seed Positions (N)" collapsible, opened by keyboard, and
      the lock reason stays visible above it. The seeded Ping Pong already
      has results, so it only shows the folded state: check the unlocked
      state on a new Bracket. On the 64-Entrant scale Bracket at 1440 the
      page is about 7,700 px tall (was about 12,000), and never scrolls
      sideways.
- [ ] **Bracket tree: full width and Jump to your Match.** From 768 up the
      Participant page's tree uses the full width of the page (not a narrow
      column); at 390 it scrolls sideways only in its own "Rounds" region.
      As an Entrant, "Jump to your Match" scrolls to and highlights your next
      unplayed Match; once you're out, or the Bracket is Closed, it goes to
      your last played one. A signed-in Participant who isn't an Entrant
      (and any Organizer or Host not entered) sees no Jump button.
- [ ] **Bracket tree: one tree, admin and Participant.** Open the same
      Bracket on its admin Competition page and on its public Competition page: both
      show the one tree (Rounds left to right at 1440), with no List toggle
      anywhere. An unplayed Match has a solid "Record result" in the admin
      tree and a recorded one an outline "Edit"; the Participant tree shows
      neither unless self-report is on and the Match is their own. A Bracket
      of more per Match (a Group Bracket of 4 with 2 advancing, e.g. Chess Matches) is the same
      tree of Match boxes, with every Entrant that advances highlighted and
      the Match result form marking "Advances" beside those places (only 1st
      highlighted, "Wins", in the final). At 390 the tree scrolls sideways
      inside its own "Rounds" region and the page itself never scrolls
      sideways.
- [ ] **Head-to-head and Best score settings show what was saved.** On a Head-to-head or Best
      score Competition's page, change a setting (Draws or Best of 1/3/5/7;
      for Best score, direction, unit label, Max attempts and, in team
      scoring, Team score): it saves as you change it, and the fields keep
      the saved values with no reload; reload and come back later, and they
      are still there. There is no Best/Total (count) control and no
      Finish Points table. The page's Settings show Placement Points as what
      each place earns in the Standings.
- [ ] **Self-report: one setting.** Create a Competition of each Format: the
      "Participants can log their own results" switch is off on every one,
      and only Bracket, Head-to-head and Best score show it (Placement and
      Participation never do). With it off, a linked Participant has no
      Report result / Log a Match / Log an Attempt and a posted one is
      refused with the server's message. Turn it on: the Participant records
      their own Bracket Match, logs a Head-to-head Match as one of the two
      Entrants and a Best score Attempt as themselves (no participant picker),
      and edits or deletes a result they could have logged, including one a
      Host logged; another Participant cannot. Closed, nobody can.
- [ ] **Head-to-head: two Entrants, Best of.** A Head-to-head Competition
      shows exactly two Entrants (no enrollment, no "open to everyone"), and
      Log a Match has two fixed rows and no player picker. In a Best of 3,
      log 2–0: the series is decided, Log a Match is disabled with a visible
      reason and the server refuses a third. Delete or edit a Match and
      logging reopens. With draws allowed, a series whose Matches all play
      out with no majority (win, Draw, Draw) is drawn: it takes no more
      Matches, names no series Winner, and Close gives both Entrants the
      higher place's full points.
- [ ] **League: set up and pair.** Add Competition, Format League (a new
      one is Round robin; Swiss shows a Rounds field). At 1440 and 390 add 5
      Participants with the picker (no email in any option) and press Pair
      rounds: 5 rounds, each Entrant sits out once. Clear pairings, switch to
      Swiss with 6 Entrants, Pair round 1: 3 Matches; Pairing, rounds, Score
      direction and the Entrants now read "Locked once round 1 is paired.";
      Score unit and self-report stay editable. Edit pairings swaps two
      Entrants and the round shows it; swapping to a repeat pairing shows the
      warning before saving. After one result in the round the control is
      disabled with its reason and the server refuses the swap.
- [ ] **League: record, Close, Reopen.** Record result opens a dialog at 1440
      and a bottom sheet at 390; record a win, a draw and a loss. Pair next
      round is disabled until the round is done, and the standings follow
      (W, D, L, Match points, Buchholz). Close is disabled with "Finish every
      Match before closing." naming the unplayed Matches until the last
      round is played (or, Swiss, until every played round is complete and
      no next round can pair without a repeat Match: Pair next round reads
      "Every pairing would repeat a Match. Close the League."); then Close writes Placement Points ("From league") to
      the Standings and Reopen withdraws them. *(teams)* In Team scoring the
      points go to Teams.
- [ ] **League: self-report and enroll.** With self-report on, a linked
      player records their own Match from the Participant page and the other
      player edits it; a non-player sees no Record result. With it off,
      neither does. "Participants can enroll" is offered; a Participant
      enrolls and withdraws until round 1 is paired, then sees "Enrollment is
      closed: round 1 is paired."
- [ ] **League: Participant page.** Open XII's Chess Round Robin and Chess
      Swiss as the linked Participant at 1440 and 390: the table (Rank,
      Participant, W, D, L, Match points, H2H and SB or Buchholz, War Week
      points with Provisional while open, every header sorting), Top
      finishers only when Closed, the rounds with your Match highlighted and
      "Your next Match" naming the round and opponent. No sideways scroll at
      390 (the stats fold under the name), and no email anywhere on the page
      or the admin page.
- [ ] **Best score: Max attempts and Team score.** Set Max attempts per person
      to 3: the Attempt form says "N attempts left", a fourth is refused for
      a Participant and for an Organizer, and Max attempts cannot be lowered
      below the most any one person has. At 1 the button reads "Update your
      score" and saving edits the one Attempt. There is no Entrant list and
      no enroll button. In team scoring, the Team score field (Best member or
      Sum of members) shows, and each Team's row follows the choice.
- [ ] **Group Bracket: edit, bye, lock.** On a Group Bracket (Bracket kind
      Group, e.g. 11 Entrants at 4 per Match, 2 advancing) press Generate,
      then in the tree set one Match to advance 1, move an Entrant to another
      Match of the same Round and change the Round's defaults ("Edit <Round>
      settings"): the later Rounds re-project; a Match short of Entrants shows
      as a bye. Record a Match: that Round locks. Close and the Final's order
      gives places 1 to 4 their points.
- [ ] **Bracket: edit a result only along the latest path.** Record two
      Matches that feed a Final and the Final. Each semifinal's Edit and
      Clear result are disabled with "A later Match already used this result.
      Change that Match first." as visible text (also at 390), and a posted
      change is refused by the server. Clear the Final, then a semifinal's
      Edit is offered again. In a Group Bracket, once any later round has a
      result, every earlier Match's Edit and Clear result are disabled with
      "A later round already has a result. Change that round first."
- [ ] **Close a Head-to-head Competition.** In a Best of 3 Head-to-head
      Competition with Placement Points, log one Match as the Organizer (Log
      a Match on its public Competition page): Close is disabled with "Finish
      the series before closing." and the server refuses it. Log a second
      Match so the series is decided (or drawn), then Close in its run area: its top
      finishers get Placement Points ("From head-to-head" in the leaderboard's points breakdown) and
      the Standings move. Reopen withdraws them. *(teams)* Add it with
      Scoring Individual and Counts toward the Team on, so the Team Standings
      move. Every Format uses the same Close and Reopen words (Placement,
      Bracket, Head-to-head, Best score and Participation); a Closed one takes
      no writes from anyone until Reopen. Do the same with a Best score
      Competition ("From best score");
      its Competitions-list Edit opens its page, whose run area logs Attempts
      ("Log an Attempt").
- [ ] **Run a Competition as Participation.** Add a Participation
      Competition (Add Competition opens its Competition page, whose run area
      reads "Who took part"). Settings: *(individual)* Points per
      Participant; *(teams)* Placement Points 3/2/1 by headcount (there is no
      per-Participant N and no per-person mode); turn on
      Self check-in. Tick two Participants, untick one, then Close: the
      generated Points Entries ("From participation") appear in the leaderboard's points breakdown
      and the Standings move. Closed, the ticks and the Settings are disabled with their reason (the server's
      refusals are covered by unit tests and smoke). Reopen withdraws them. Changing the scoring while anyone is ticked is locked ("Locked once the
      Competition has a result."), and deleting the Competition is refused
      with the count.
- [ ] **Competition page: settings autosave.** Open a Competition from
      the list's Edit: one page, Settings on top and the Format's run area
      below it. Change the name, Group and a Placement Points place: each
      saves on its own (no Save button), "Saved" shows by the Settings
      heading (no toast), and it is still there after a reload. Check at 1440 and 390: no sideways scroll.
- [ ] **Competition page: locks with reasons.** On a Competition with a
      result (a recorded Placement, a Match, an Attempt or an Entrant), Format, scoring and
      counts toward team are disabled with "Locked once the Competition has
      a result."; Score direction locks per Format once play has started
      there, and the Score unit never locks; on a Head-to-head
      Competition with its two Entrants and no Match, Draws and
      Best of still save (choose Best of 3: "Saved", kept after a reload),
      and once a Match is logged they are
      disabled with "Locked once the Competition has a Match or Attempt."; name, description, Group, Hosts and
      Placement Points still save. In a Bracket with a recorded Match, the
      Bracket kind, Entrants per Match, how many advance, the 3rd place match,
      the Entrants and Generate
      are disabled with "Locked once a Match has a result." Close
      (any Format): everything but name, description,
      Group, Hosts, Placement Points and the Score unit is disabled with "Locked while the
      Competition is Closed. Reopen it first."; a Placement
      Points change then says "Applies at the next Close."
      Reopen unlocks the fields that only the Closed state locked
      (self-report, enrollment, check-in, Max attempts). There are no
      "closes at" fields anywhere. There
      is no Reset bracket and no "confirm to clear and start over".
- [ ] **Competition page: change the Format.** On a new Competition with no
      result, change the Format between Placement, Bracket, Head-to-head,
      Best score and Participation: each applies the new Format's
      defaults and shows its run area. Add a result and the Format locks.
- [ ] **Competition page: Hosts picker.** In the Hosts field, search the
      roster by name: each option is avatar, name and Team (the Team only in a
      teams War Week), never an email, and an email typed finds no one. A
      Participant with no email is pickable; a non-@jahnelgroup.com one is
      pickable and marked "Can't sign in". Pick one (it saves at once),
      remove it, and open the Competition as that Host once their roster email
      is set (with no email nobody signs in as them: the admin page refuses).
      Create next War Week copies no Hosts.
- [ ] **Competition page: rich-text description.** Write a description with
      a heading, a list, a link and an image by URL; it saves on its own.
      On `/<edition>/competitions/<id>` the Participant sees it formatted,
      above the results (back link, group, name and facts, description, enroll
      button, then the results); a long one clamps after a few lines with
      "Show more" (and "Show less"), at 1440 and 390. There is no image upload.
- [ ] **Competition page: Log a Match or Attempt from admin.** On a Head-to-head
      Competition, Log a Match, edit it and delete it from the admin page;
      on a Best score Competition, Log an Attempt, then edit and delete it
      from the person's expanded row ("N more attempts"); the Competition's page
      and results follow.
- [ ] **Competition page: retired routes redirect.** Open
      `/admin/competitions/<id>/bracket`, `/games`, `/participation`,
      `/admin/brackets/<id>` and `/admin/placements/<id>`: each lands on
      `/admin/competitions/<id>` (a 308).
- [ ] **Schedule Items.** On `/admin/schedule`, add a Schedule Item on a
      Day, linked to a Competition; it shows on `/<edition>/schedule` under
      that Day with its time in ET and links to the Competition. Edit it
      (sheet or dialog, no separate page), then delete it (confirm and
      toast).
- [ ] **Announcements.** New Announcement opens a dialog at 1440 and a
      full-height sheet at 390, with the rich-text body; Edit opens the same
      one. Post an Announcement with a heading, a quote, a
      link, a captioned image (by URL) and a video (the editor's Video
      button), then pin it. The form has no Video links field, and the
      editor's toolbar buttons show their keyboard shortcut in a tooltip. It
      shows first on the Announcements page and as the pinned card on Home,
      with every element rendered.
      Pinned Announcements sort newest first and a demo's are dated in its
      War Week, after anything posted today, so unpin the seeded pinned one
      first and pin it again at the end. Unpin, then delete. The admin list
      shows "Posted by <name>" (the poster's display name or the part of
      their email before the @, never the email) and no video count. MCP
      `get_announcements` returns no `videoUrls`; the video shows as its URL
      in the plain-text body.
- [ ] **Awards.** Give an Award to two Participants (and a Team,
      *(teams)*); it shows on `/<edition>/awards`. Delete it.
- [ ] **Award presets.** On `/admin/awards`, Add Award: the Preset picker
      offers every past Award name (case-insensitive, each once) and the seven
      former Category names (War Week MVP, Billable Hours Champ, Black
      Midnight, Grow, Grind, Serve, Inspire). Pick one: the name and its most
      recent description fill in, and both stay editable. A brand-new name
      saves and is then offered as a preset. There is no Category anywhere in
      `/admin/awards` (no Categories section, no Category select).
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
      generated Bracket that isn't closed, any open Head-to-head or Best score
      Competition with at least one Match or Attempt and any open Participation
      Competition with anyone ticked (linked to its Competition page), and on End it records the Winner
      from first place. Unstart on a live edition with nothing scored (an
      edition freshly started, e.g. XII) goes back to Upcoming behind a
      confirm; on one with a Points Entry (a Closed Placement's included), Match result, Match or Attempt it is
      refused. Reopen makes it live again. Reopen is refused while a later
      edition is upcoming ("War Week <Y> is next; reopen isn't
      available."), so before Reopen delete the edition this line created
      from the local database (`delete from war_week where edition =
      '<new>'`; `--reset` doesn't remove it). In the teams pass XII is
      upcoming too: delete it as well; the closing `pnpm seed:demo`
      restores it.
- [ ] **Unstart a reopened edition.** On the edition the Lifecycle line
      reopened (ended before, so it has a Winner), Unstart is refused:
      "This War Week has been ended; Unstart isn't available." It stays
      live.
- [ ] **Finale links.** `/admin/finale` links to the Finale and it opens;
      there is no Bracket Finales section and no Finale link per Bracket.
- [ ] **Finale slide list.** `/admin/finale` lists the Finale slides in
      order (Title, By the numbers, Awards, Winners, Standings countdown,
      Winner, plus the demo's Custom "Thank you" before Standings or after
      Winner, per the seed). Move a slide with its Move up/down buttons
      (1440 and 390) and by dragging it at 1440: the order changes at once
      and survives reload. Hide a slide: it shows as hidden and keeps its
      place; Show brings it back. Open the Finale: hidden slides are
      skipped and the rest play in the saved order.
- [ ] **Custom slides.** Add Custom slide (a heading, a body with an image
      by URL, a background color): it appears just before Standings
      countdown, and in the Finale shows heading, body and background. On a
      dark background and on a light one the text stays readable (4.5:1; run
      the page's axe check or read the colors). Editing changes it; adding a
      second one with the same heading is refused ("There's already a Custom
      slide called <heading>."); delete asks first and removes it. A
      built-in has Hide/Show but no Delete.
- [ ] **Awards slide.** `/admin/finale` has no Awards layout control; the
      Finale plays one Awards slide that reveals one Award per step.
- [ ] **Forms behave the same everywhere.** On a long form (Competition),
      resize from 1440 to 390 (crossing 768) with typed input: the input
      survives the dialog-to-sheet switch. At 820 the add-Participant and
      *(teams)* Squad (Competition page → Add Squad) forms are dialogs; at
      390, bottom sheets. Every delete
      above used `ConfirmDialog`, and every save and delete showed a toast.
- [ ] **The Guide is true.** Read `/admin/guide`: every step names a page
      and control that exists and works as described (it is written for the
      flat nav: Settings, Schedule, Roster, no Setup hub). Its "What a
      Participant email does" note matches where You and "Your Team" show:
      You on the roster, the individual leaderboards, Award recipients on
      the Awards page, Participation lists and Your Entrant in a Bracket
      (the Team or Squad in a team Bracket); "Your Team" on a Head-to-head or Best score
      leaderboard; no highlight on Team Standings rows.
- [ ] **No admin page carries more than it needs.** *(judgment)* Apply the
      judgment rule to every admin page (Competitions through Guide), every list
      page and every form.

## Admin, as a Host

`/admin/**` as `e2e-host@jahnelgroup.com`, Host of one Placement
Competition (from the Organizer run).

- [ ] **Two sections: Competitions and Guide.** The admin nav is
      Competitions and Guide at 1440 (no Discretionary points, Schedule,
      Announcements or Finale); at 390 the bar is Competitions and More
      (Guide in More). Competitions lists only the Host's Competition, with
      its Edit.
- [ ] **Organizer-only pages refuse.** Schedule, Announcements, Finale, Settings, Roster, FAQ, Awards and
      Organizers (open their URLs directly) each show "Organizers and Hosts
      only."; there is no Lifecycle box, no Create next War Week and no
      Add Competition or Days editor.
- [ ] **Account menu as a Host.** The avatar menu offers "Back to War Week"
      in admin and Admin on participant pages (a Host is not a plain
      Participant), plus Display and Sign out.
- [ ] **What a Host can do works.** Record placements on their Competition
      (add rows, set Places, Close, Reopen) and see the Standings move. They
      can't post Announcements or change Schedule Items (the server refuses
      them), and can't create or delete a Competition or assign Hosts: no Add
      Competition or Delete, and the Competition page's Hosts are shown
      read-only by name with no emails (the server's refusal is
      unit-tested in `src/lib/access.test.ts` and the mutation tests). Their
      Competition page's settings autosave and show the same lock reasons as
      an Organizer's; a Host logs a Match or Attempt from it.
- [ ] **A Host can't give Discretionary points.** `/admin/discretionary-points`
      shows "Organizers and Hosts only." and no form (server-refused in
      `src/lib/access.test.ts`); `/admin/points` redirects there and shows
      the same. A Host can't open another Competition's
      `/admin/competitions/<id>` either.
- [ ] **The Finale is not a Host's.** `/admin/finale` shows "Organizers
      and Hosts only." and no slide list; the War Week Finale at
      `/<edition>/finale` still plays for the Host, as for any signed-in JG
      user.
- [ ] **Not a Host elsewhere.** Switch to another edition (if offered), or
      set the `admin_edition` cookie to a past edition, and open another
      War Week's admin URL (e.g. `/admin/competitions/<a Competition they don't host>`; use `<an X
      Competition id>` when the demo has no other): nothing to manage there.

## User Pages

Every War Week page, signed in as the **linked Participant** unless a line
says otherwise. Run each line again as the **unlinked** account and check
that nothing personal shows (no You highlight, no Log a Match or Log an Attempt).

- [ ] **Home.** `/<edition>` shows the hero (with no Banner URL set, as in
      the XII demo, no banner block and no "War Week" eyebrow: the hero
      names "War Week XII" once, and at 390 the Log a Match or Log an Attempt heading is on the
      first screen), Now/Next for the time given by
      `?at=` (pick a time with a Schedule Item; a Match has no time and never shows here), the
      pinned Announcement, Recent results and the top of the Standings: *(free-for-all)*
      with the linked Participant highlighted as You; *(teams)* the Team
      Standings, which carry no You (it marks individual rows: Leaderboard,
      Teams). With a Head-to-head or Best score Competition open, the
      "Log a Match" / "Log an Attempt" shortcut shows for the linked Participant only. There is no
      "Join the Slack channel" button on Home (it moved to the account
      menu). Home's
      "Your next Match", for a linked Participant in a generated Bracket
      (generate Chess Matches as the Organizer), names the Round and opponent
      with no time or place.
- [ ] **Recent results.** After a Bracket or Placement is closed or a
      Head-to-head or Best score Competition closed and Discretionary points are given, Home's
      Recent results lists up to 5 rows newest first (a Bracket's winner, a
      Head-to-head or Best score winner, a closed Placement, a Discretionary points entry with its reason), each linking to its Competition (a closed Participation Competition is a
      row too: *(teams)* its top Team, else how many took part), with "All Competitions"
      opening `/<edition>/competitions`. With nothing scored the section is
      hidden. It follows a new result within about 10 s.
- [ ] **Navigation.** At 390 the tab bar is Home, Schedule, Competitions,
      Leaderboard, More, with the current page's tab highlighted:
      Competitions on `/<edition>/competitions` and on a Competition page,
      More on Announcements, Roster, Awards, FAQ and About. At 1440 the top
      nav is Home, Schedule, Competitions, Leaderboard, Announcements, More.
- [ ] **Log a Match from a phone.** With self-report on, at 390, log a Head-to-head Match from
      Home's shortcut as one of its two Entrants; it shows in that
      Competition's Matches list as the newest Match, and its results
      update. Log an Attempt on a Best score Competition the same way: the
      person's row shows their best Attempt and "N more attempts" expands the
      rest. As the unlinked account, there's no shortcut and no Log a
      Match or Log an Attempt on the Competition page, and none with self-report
      off (the server's refusal of a posted one is unit-tested in
      `src/lib/access.test.ts`).
- [ ] **A Participation Competition page.** In the Participation
      Competition (Self check-in on), the page says how it scores, shows
      "Took part" with the ticked Participants by name and *(teams)* each
      Team's count. The linked Participant's **Check in** adds them
      ("You're checked in") and **Check out** removes them; one the Host
      ticked can't be checked out ("The Host marked you; ask them to remove
      it."). With Self check-in off, or once closed, there is no Check in
      button (closed shows the Closed badge); for a
      Participant on no Team, or when the Host marked them, the button is
      disabled with its reason, e.g. *(teams)* a Participant on no Team is
      told only those on a Team can take part. As the unlinked account there
      is no Check in. At
      390 the button and list fit without sideways scrolling.
- [ ] **Enroll and withdraw.** In the self-enroll Bracket, the linked
      Participant enrolls, withdraws and enrolls again; the Entrant list
      follows each step.
- [ ] **Schedule.** `/<edition>/schedule` lists every Day with its Day
      Theme, Day description (when it has one: in the XI demo, Sun Feb 22
      "The Matrix Has You" reads "Opening Sunday: Black Midnight from 12:01
      AM, …") and Items in time order (ET), filterable by Day; each linked
      Competition opens.
- [ ] **Competitions.** `/<edition>/competitions` lists every Competition;
      when there are Groups the Group tabs wrap onto more lines instead of
      scrolling sideways, and every tab (Other Competitions too) shows at
      390. Each row shows its status: Not started, Underway (a Bracket adds
      "Round N of M" or "Final"), Closed, or Done · Winner: X (a tie reads
      "Winners: A, B"; a Closed Placement or Bracket with no Placement
      Points is just Done), a description preview of two lines at most, and
      no max-points badge.
      Open one of each Format: a Placement Competition shows Top finishers and its
      results table (Rank, name, Score, War Week points; no "Score" text in cells; a Participant can't edit); a Bracket shows the one tree (no List toggle; at 390 it
      scrolls sideways in its own region) and Top finishers once closed; a Best score Competition shows Top finishers and a
      results table with one row per person (best Attempt) and an expandable
      "N more attempts" row; a Head-to-head Competition with a fixed list of
      two Entrants (always two) shows the series view (Matches with both Scores and the
      Winner or Draw, the series score, the series Winner once decided, and
      each Entrant's Placement Points; a drawn series says so and names no
      series Winner) and no leaderboard; a League shows Top finishers once
      Closed, its table (W, D, L, Match points, H2H and SB or Buchholz, War
      Week points) and its rounds). On every one: no Points Entries
      section anywhere on the page.
- [ ] **Scale: 100 Participants.** Run `pnpm seed:demo:scale`, then
      `pnpm seed:demo` when done. At both viewports: the admin roster lists all
      100 Participants (the search box finds one by name or email) and `/xii/leaderboard` everyone with points, with no
      sideways scroll; a
      Placement sheet lists its rows with names wrapping (not truncating)
      at 390; the 64-Entrant Bracket tree scrolls sideways only in its own
      "Rounds" region; as an Organizer, the Discretionary points and Award
      pickers find a Participant by display name (never by email) with no
      cap on the list.
- [ ] **Teams show in team events.** *(teams)* Wherever a Participant
  appears in a Competition or scoring context (individual Standings on
  Home, `/leaderboard` and the Finale; a Bracket's tree (color), Top
  finishers and Match result form; the Head-to-head series and results
  table, Best score and Placement results and Top finishers; Recent results;
  Award recipients on `/awards`, `/history/awards/<slug>` and the Finale's
  Awards steps (color); the admin Placement sheet, Participation list,
  Discretionary points and Awards; Now/Next shows no Participant), their
  Team shows by name where there's room, else by its
  color, in XI at 1440 and 390, and a free-for-all War Week shows none, including for a Participant whose Avatar is a Profile picture (`CONTEXT.md`, "The Team shows in team events").
- [ ] **Leaderboard.** `/<edition>/leaderboard` shows the main Standings
      as the results table (Team Standings *(teams)*, individual Standings
      *(free-for-all)*): Rank, name, War Week points, the points breakdown
      per row in an expandable row, the first place marked "Winner", and the
      linked Participant highlighted. Every header sorts (the header's
      `aria-sort` follows) and it opens sorted by Rank. At 390 the table
      fits with no sideways scroll and no column's data is dropped.
- [ ] **Competition page: results table and Provisional points.** At 1440
      and 390, on an open Placement, Best score and team Participation
      Competition: the
      results table has Rank, name, Score (with its unit; no Score column
      when no row has a Score) and War Week points, with no "Score" text
      inside cells; click each header and the rows reorder; the Winner's
      row carries a mark and the word "Winner"; on a Competition whose rows
      have no points and no Score, or are all tied, no row says Winner. The
      points header shows a
      "Provisional" badge whose tooltip opens by keyboard (Tab to it) and
      by tap, saying "Points become final when the Competition is Closed.";
      Close the Competition and the badge is gone with the same points.
      No Points Entries section appears on any Participant Competition page.
- [ ] **Competition page: Manage link.** As an Organizer and as that
      Competition's Host, a **Manage** button (outline) on
      `/<edition>/competitions/<id>` opens `/admin/competitions/<id>`.
      Repeat from a past edition's Competition page while `/admin` shows the
      current War Week: Manage opens that Competition's admin page. As a
      Host of another Competition and as a Participant the button is absent,
      and both are refused at the admin route ("Organizers and Hosts
      only."); an anonymous visitor is sent to `/sign-in`. There is no
      "Close it" link on a Head-to-head or Best score page.
- [ ] **Free-for-all Competition pages.** *(free-for-all)* The Participant
      Competition page and list, the admin New Competition form, the admin
      Competitions list and the Competition page's Settings show no
      Individual/Team choice and no "Individual" label; a Competition that
      is already Team shows "Team".
- [ ] **MCP: `get_bracket` and `get_games` words.** Call each against the
      Bracket and the Head-to-head and Best score Competitions: `get_bracket`
      returns the Bracket kind, `matchSize`, `advancing` (per Match),
      `thirdPlaceMatch`, `closed`, each
      Round's `matches` and a `winner` (the final's winner once Closed;
      null before); `get_games` returns `closed`, the Score direction and
      unit, Best of, draws, Max attempts and Team score, a leaderboard and
      `matches` (Head-to-head) or `attempts` (Best score), with no count
      (best/total) field. `get_placements` shows the direction and unit. No field or
      description says Heat, Champion, Finalize or Game, and there is no `@`.
- [ ] **Announcements.** The Announcements page (`/<edition>/announcements`;
      at 390 it is More's first item and More is highlighted there)
      lists the pinned Announcement first, renders rich text (headings,
      quotes, captioned images) and videos, each player titled "Video:
      <Announcement title>", and shows who posted each by name, never an
      email.
- [ ] **Roster.** `/<edition>/teams` *(teams)* shows each Team in its
      color with its Captain and Participants; *(free-for-all)* the
      Participants. The linked Participant is highlighted.
- [ ] **Awards and FAQ.** `/<edition>/awards` and `/<edition>/faq` show
      their content, or a plain empty state when there is none (XII demo).
      Awards are listed flat, with no headings; each Award's name links to
      its through-the-years page (`/history/awards/<slug>`).
- [ ] **Top nav is centred.** At 1440, on `/<edition>` and `/history`, the
      links in the header's top nav sit in the header's true centre (their
      midpoint within a few px of the viewport's midpoint, with the brand on
      the left and the avatar on the right); a long tagline truncates
      rather than pushing them off centre.
- [ ] **Cursors.** At 1440, hover a link, a button, a tab and a menu item
      on a participant page and in admin: each shows the pointer cursor; a
      disabled button (e.g. Save settings on a closed Participation
      Competition), a disabled toggle and a disabled tab show not-allowed
      (menu and list items stay inert but keep the plain cursor).
- [ ] **Buttons follow the rule.** On the admin Competitions, Roster and
      Schedule lists, the primary action ("Add Competition", "Add Team",
      "Add Participant", etc.) is a solid button, secondary ones are
      outline (on the Competition page's Bracket section, Add Squad sits outline beside the solid
      Generate), and only icon or tertiary actions are ghost.
- [ ] **History wears the War Week chrome.** `/history` and an Award name page
      (`/history/awards/<slug>`) show the current War Week's top nav (at
      1440), phone tab bar (at 390) and footer, in the current War Week's
      Appearance Theme and the viewer's Display; there is no "Back to War
      Week" link; the edition cards keep their own colors.
- [ ] **History.** `/history` lists every past War Week with its Story
      Theme and Winner; open three past editions, including the oldest:
      each shows its archive view (an edition with no Banner URL shows no
      banner block and names the War Week once in the hero). "Awards
      through the years" lists each Award name (`/history/awards` lists them
      all); open "Billable Hours Champ": `/history/awards/billable-hours-champ`
      shows War Weeks VIII, V and IV together, newest first, with
      recipients, and an unknown slug (or an old Category id) is a 404 page.
- [ ] **Finale slideshow.** `/<edition>/finale` opens full screen (over the
      edition nav, with a small Exit link back to the edition) on the Title
      slide, showing no Standings. `→`, `Space` or a click on the stage
      goes next (an Awards slide first shows its Awards one per press);
      `←` goes back to the previous slide in its final state; `Escape`
      returns to the first slide; Next on the last slide does nothing.
      Nothing auto-advances: leave it 10 s on a slide and it stays. A click
      on a link or video in a slide doesn't advance it. Hidden slides and
      slides with nothing to show (no Awards, no closed Competitions, no
      Standings rows) are skipped. With every slide hidden it says "Nothing
      to show yet." (an Organizer also sees "Set up the Finale").
- [ ] **Finale slides.** Step through the demo's Finale: By the numbers shows
      only non-zero figures ("Points handed out" among them); Awards lists
      each Award once, one per step; Winners lists each closed Bracket's winner
      and the winner of each Closed Placement and each closed Head-to-head, Best score or
      team-scoring Participation Competition, ties together; Winner is the first place of the Standings, a
      tie shown as "Tie: A & B". No slide scrolls at 1440 (1920x1080 is the
      projector) or at 390.
- [ ] **Finale Standings countdown.** Arriving on Standings countdown with
      → starts it (no Start button): rows appear from last place to first,
      ties together, totals counting up from 0, within 8 s (`FINALE_MAX_MS`;
      time it in the page, from the → press to `[data-finale="done"]`: a
      frame or two over 8000 ms is the animation clock, Playwright's own
      waits add more), ending in the same order as the Leaderboard. Only rows
      ranked 10th or better count down (ties at 10th included), then a line
      "...and N more Participants scored" (Teams in a teams War Week), which
      counts only left-out rows that have points and is hidden at 0; the
      Leaderboard still lists everyone. Check it in the 100-Participant scale
      demo (the line shows) and in the XI demo (no line when 10 or fewer). → while
      it plays jumps to its final state; Replay plays it again and doesn't
      advance. Arriving by ← shows the final state. With
      `prefers-reduced-motion` every slide shows its final state on arrival
      and still waits for →.
- [ ] **Account menu.** The avatar button at the top right (at 1440 and
      390; no email text, no Sign out button beside it) opens a menu with
      the name and email, Profile, Display, "Join the Slack channel" (when the War
      Week has a Slack URL; it opens it) and Sign out; for the Organizer and
      the Host it also has Admin, which opens `/admin/competitions`; for a plain
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
      (Standings), a Competition's Matches and Awards, and Recent results on
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
      `/admin/competitions`) shows "Organizers and Hosts only." in the current
      War Week's colors and font (theme check), with the footer.
- [ ] **No page carries more than it needs.** *(judgment)* Apply the
      judgment rule to every page above, at 390 first.

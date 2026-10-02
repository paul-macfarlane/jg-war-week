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

- Seed the current edition's demo and build: `docker compose up -d`, then
  `pnpm build && pnpm seed:demo:<edition>` (e.g. `pnpm seed:demo:xii`), then
  `pnpm start -p 3200`. The demo makes `<edition>` the one live War Week,
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
    in the local database. Never run against a hosted database.
- **Run order:** Public Pages, then Admin as an Organizer (it links the
  Participant account and assigns the Host the later sections use), then
  Host, then User Pages.
- **Accounts:** sign in without Google using `e2e/session.ts` from a
  Playwright script against port 3200. It writes a session for the email
  and sets the cookie with the server's own secret, so there's no need to
  read any `.env` file. Once Test sign-in (ticket 62) ships, use
  `/sign-in/test` instead.
  - **Organizer:** `asOrganizer(context)` (`e2e-organizer@jahnelgroup.com`).
  - **Linked Participant:** `signIn(context, "e2e-participant@jahnelgroup.com")`,
    after the Admin run puts that email on a Participant.
  - **Unlinked:** `signIn(context, "e2e-unlinked@jahnelgroup.com")`, a JG
    account on no roster.
  - **Host:** `asHost(context)` (`e2e-host@jahnelgroup.com`), after the
    Admin run makes it a Host of one Competition.
- **Viewports:** run every line at laptop **1440×900** and iPhone
  **390×844**.
- **Theme check:** a page "wears the current War Week" when its themed root
  (`[data-theme-root]`) carries the inline `--light-*`, `--dark-*` and
  `--font-sans` of `warWeekThemeStyle` (`src/lib/theme.ts`) for the current
  War Week, taken from `seeds/demo/<edition>.json`'s colors and font (or, to
  compare against the app itself, sign in and read `/<edition>`'s root,
  since `/<edition>` is not public), and the screenshot shows that
  edition's colors and font, not a past edition's.
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
  `test-results/<run>/<page>-<width>/` and record each line's verdict in the
  run's report (the ticket's closeout when a ticket asked for the run).

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

- [ ] **Lands on the current War Week.** Open `/admin`; the header names the
      current War Week, and the edition switcher lists every edition.
      Switch to a past edition: the banner reads "Editing the Archive: War
      Week <X>". Switch back.
- [ ] **Settings save and show.** In War Week settings, change the Story
      Theme, the dates (DateRangePicker), the Slack URL and one Appearance
      Theme color, then save. The preview shows both schemes, and
      `/<edition>` shows the new Story Theme, dates and color after a
      reload. Restore the originals.
- [ ] **Settings refuse bad input at the field.** A malformed Slack URL and
      an end date before the start date each show an error at their field,
      the field takes focus, and nothing is saved.
- [ ] **Settings: Team fields follow Mode.** In War Week settings,
      *(free-for-all)* Team Label and Leader Title are hidden and the roster
      has no Team controls; set Mode to Teams (before saving) and they show
      with their saved values.
- [ ] **Days.** Add a Day inside the War Week with a Day Theme; it shows on
      `/<edition>/schedule`. Adding a second Day on the same date is
      refused with "There's already a Day on <date>.". Delete the added Day
      through its confirm.
- [ ] **Roster: add, link, edit, delete.** Add a Participant (on a Team,
      *(teams)*); edit an existing Participant's email to
      `e2e-participant@jahnelgroup.com` (this is the linked Participant the
      User Pages use); delete the added Participant through its confirm.
      *(teams)* Add a Team, mark a Leader; the Captain title shows on
      `/<edition>/teams`; delete the Team.
- [ ] **Competitions, one of each Format.** Create a `points` Competition
      with Placement Points 5/3/1, a `single-elimination` Competition, and a
      `games` Competition with `head-to-head` and self-enroll on; assign
      `e2e-host@jahnelgroup.com` as Host of the `points` one. Each shows on
      `/<edition>/competitions`.
- [ ] **Run a Bracket end to end.** Enter Entrants in the
      `single-elimination` Competition, seed them, build it, give a Heat a
      Day, time and location (it shows in Now/Next with `?at=` set to that
      time), record every Heat (a dialog at 1440, a sheet at 390), and
      finalize. The finalized Bracket's Placement Points appear in Points
      Entries and the Standings, and "Play the Finale" opens its Bracket
      Finale.
- [ ] **Close a `games` Competition.** Log two Games as the Organizer in
      the `head-to-head` Competition, then Close: its top finishers get
      Placement Points and the Standings move. Reopen withdraws them.
- [ ] **Points Entries.** Add a Points Entry with a Placement Points button,
      edit its points, delete it; `/<edition>/leaderboard` follows each
      change within about 10 s without a reload.
- [ ] **Schedule.** Add a Schedule Item on a Day, linked to a Competition;
      it shows on `/<edition>/schedule` under that Day with its time in ET
      and links to the Competition. Edit, then delete it.
- [ ] **Announcements.** Post an Announcement with a heading, a link, an
      image and a video, then pin it. It shows first on the Announcements
      page and as the pinned card on Home, with every element rendered.
      Unpin, then delete.
- [ ] **Awards.** Give an Award to two Participants (and a Team,
      *(teams)*); it shows on `/<edition>/awards`. Delete it.
- [ ] **FAQ.** Add an FAQ Item and move it first; `/<edition>/faq` shows it
      first. Delete it.
- [ ] **Organizers.** Add `e2e-extra@jahnelgroup.com`, then remove it.
      Removing the last Organizer is refused (check the message; don't
      leave the list empty).
- [ ] **Lifecycle.** Create next War Week makes an Upcoming edition (copy
      settings only). Start on it is refused while the current one is live
      ("End <X> first"). End the current War Week: with an open Bracket or
      `games` Competition it warns first, and on End it records the Winner
      from first place. Reopen makes it live again. Delete nothing here;
      the next pass reseeds.
- [ ] **Finale links.** `/admin/standings` links to the Finale and to each
      finalized Bracket's Finale; both open.
- [ ] **Forms behave the same everywhere.** On a long form (Competition),
      resize from 1440 to 390 with typed input: the input survives the
      dialog-to-sheet switch. Every delete above used `ConfirmDialog`, and
      every save and delete showed a toast.
- [ ] **The Guide is true.** Read `/admin/guide`: every step names a page
      and control that exists and works as described.
- [ ] **No admin page carries more than it needs.** *(judgment)* Apply the
      judgment rule to the Overview, Setup, every list page and every form.

## Admin, as a Host

`/admin/**` as `e2e-host@jahnelgroup.com`, Host of one `points`
Competition (from the Organizer run).

- [ ] **Trimmed to their Competitions.** The admin nav and Points Entries,
      Brackets, Setup → Competitions and Setup → Schedule list only the
      Host's Competition and its Schedule Items.
- [ ] **Organizer-only pages refuse.** War Week settings, Days, Teams &
      roster, FAQ, Awards, Organizers and Create next War Week each show
      "Organizers and Hosts only."; there is no lifecycle box.
- [ ] **What a Host can do works.** Add, edit and delete a Points Entry on
      their Competition; post an Announcement, edit it and delete it. They
      can't create or delete a Competition or assign Hosts (no control, and
      the action is refused if posted).
- [ ] **Not a Host elsewhere.** Switch to another edition (if offered) or
      open another War Week's admin URL: nothing to manage there.

## User Pages

Every War Week page, signed in as the **linked Participant** unless a line
says otherwise. Run each line again as the **unlinked** account and check
that nothing personal shows (no You highlight, no Log a Game).

- [ ] **Home.** `/<edition>` shows the hero, Now/Next for the time given by
      `?at=` (pick a time with a Schedule Item and a timed Heat), the
      pinned Announcement, and the top of the Standings with the linked
      Participant highlighted as You. With a `games` Competition open, the
      "Log a Game" shortcut shows for the linked Participant only.
- [ ] **Log a Game from a phone.** At 390, log a head-to-head Game from
      Home's shortcut against another Entrant; it shows in that
      Competition's Game log as the newest Game, and its leaderboard
      updates. As the unlinked account, there's no shortcut, and posting the
      form is refused.
- [ ] **Enroll and withdraw.** In the self-enroll Competition, the linked
      Participant enrolls, withdraws and enrolls again; the Entrant list
      follows each step.
- [ ] **Schedule.** `/<edition>/schedule` lists every Day with its Day
      Theme and Items in time order (ET), filterable by Day; each linked
      Competition opens.
- [ ] **Competitions.** `/<edition>/competitions` lists every Competition.
      Open one of each Format: a `points` Competition shows its Points
      Entries; a Bracket shows the tree (one Round at a time at 390, with a
      List toggle) and its champion once finalized; a `games` Competition
      shows its leaderboard with the Game Type's columns and the Game log
      newest first, with the "Mine" filter.
- [ ] **Leaderboard.** `/<edition>/leaderboard` shows the main Standings
      (Team Standings *(teams)*, individual Standings *(free-for-all)*), the
      points breakdown per row, and the linked Participant highlighted.
- [ ] **Announcements.** The Announcements page (today `/<edition>/news`)
      lists the pinned Announcement first, renders rich text and videos, and
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
      the main Standings in from last place to first, ties together, in
      under 8 s, ending in the same order as the Leaderboard. Replay works.
      With `prefers-reduced-motion` it still waits for Start, then jumps to
      the end.
- [ ] **Display.** Light, Dark and System each restyle every page above,
      and the choice survives a reload. In Dark, text passes contrast (axe)
      on Home, Leaderboard and a Competition.
- [ ] **More.** Every link in More (the page at 1440, the sheet at 390)
      opens its page; Admin shows only for the Organizer and the Host.
- [ ] **Access.** Signed out, `/<edition>` goes to `/sign-in` and returns
      after sign-in. As the linked Participant, `/admin` shows "Organizers
      and Hosts only."
- [ ] **No page carries more than it needs.** *(judgment)* Apply the
      judgment rule to every page above, at 390 first.

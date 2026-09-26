---
title: War Weeker — MVP spec
status: done
labels: [done]
created: 2026-09-23
deadline: 2026-09-25T10:00-04:00
source: grill-me-brief.md (decisions D1–D37)
---

# War Weeker — MVP spec

## Problem Statement

Jahnel Group runs **War Week** every year: a week-long company culture event with a story theme, day themes, a packed schedule, teams (or a free-for-all), competitions worth points, awards, and announcements. Today all of that lives on a hand-edited wiki page that drifts out of sync. The 2026 page names three different Slack channels. Standings sit in a table someone updates by hand, and there's no reliable way to check "what's on now" or "who's winning" from a phone during the week.

Last year the Competiscore app handled scoring, but it was built as a generic league platform (Leagues, ELO, invites, role tiers). War Week only used a small part of it, and its database is gone, so ten years of War Week history exist only as wiki text.

Organizers need one place to run the week. Participants need one place to follow it. The company needs its War Week history kept somewhere better than scattered wiki pages.

## Solution

**War Weeker** is a mobile-first web app built only for War Week. It is the single source of truth for the week.

- **Anyone can open it** (for example from a QR code) without signing in, and see:
  - the current War Week's theme, today's day theme, and what's on now and next
  - the schedule
  - live standings
  - announcements with embedded video
  - awards and the FAQ
  - the War Week's one Slack channel
- **Organizers** sign in with their `@jahnelgroup.com` Google account to:
  - enter Points Entries
  - post Announcements
  - give Awards
  - hide the standings, then play a dramatic **Reveal** at closing ceremonies
- Each War Week has its own **Appearance Theme**, **Team Label** (House / Tribe / Team) and **Mode** (teams or free-for-all). This covers every past format: 4 houses, 3 genres, tribes with individual immunity, Red vs. Blue, and a possible free-for-all next year.
- An **Archive** shows every past War Week (2016–2025) in its own theme. Claude extracts it at dev time from the old wiki pages.
- A read-only **MCP server** lets JG employees ask Claude "who's winning War Week XI?". Claude refuses to spoil the standings while they're hidden.

For the hackathon demo, War Week XI (2026, The Matrix) is seeded as the **live** War Week at mid-week, with fictional points and the standings hidden.

## User Stories

### Viewing the current War Week (any signed-in JG employee)

1. As a participant, I want to open the app from a QR code or link without signing in, so that I can check it instantly on my phone.
2. As a participant, I want the home page to show the current War Week's edition, story theme and banner, so that I immediately know what this year is about.
3. As a participant, I want to see today's Day Theme on the home page, so that I know what kind of day it is ("Tournament Day").
4. As a participant, I want to see what's happening now and what's next on the home page, so that I don't miss anything.
5. As a participant, I want a compact standings view on the home page, so that I can see who's winning at a glance.
6. As a participant, I want the home page to show "Standings hidden 🔒" when organizers have hidden them, so that I understand why there are no scores.
7. As a participant, I want the pinned Announcement on the home page, so that I see the most important news first.
8. As a participant, I want one prominent Slack channel button, so that I always join the right channel.
9. As a participant, I want the app to look like this year's Appearance Theme (colors, logo, banner, font), so that it feels part of the story.
10. As a participant, I want a bottom tab bar on mobile (Home · Schedule · Leaderboard · News · More), so that I can move around with one thumb; on a desktop screen I want a top navigation bar with the same destinations instead, so that navigation feels natural with a mouse.
11. As a participant, I want `/` to always show the current War Week, so that I never have to know its edition number.
12. As a participant, I want each War Week to have its own URL by edition (e.g. `/xi`), so that I can share links to a specific year.

### Schedule

13. As a participant, I want the schedule grouped by Day with each Day's theme, so that I can plan my week.
14. As a participant, I want each Schedule Item to show time, title, host, location and description, so that I know where to be and why.
15. As a remote participant, I want a virtual link on Schedule Items that have one, so that I can join remotely.
16. As a participant, I want Schedule Items marked by category (competition / education / social / meal / work), so that I can quickly tell a meal from a talk from a competition.
17. As a participant, I want competition Schedule Items to link to their Competition, so that I can see what it's worth and who's scored.
18. As a participant, I want all times shown in ET, so that there's no timezone confusion.
19. As a participant, I want the schedule to open on today, so that I don't have to scroll past earlier days.

### Standings and competitions

20. As a participant, I want team standings with each Team's name, color and total, so that I know how my team is doing.
21. As a participant, I want an individual leaderboard, so that I can see top individual scorers.
22. As a participant in a free-for-all War Week, I want the individual leaderboard to be the main leaderboard, so that the standings match how the year is scored.
23. As a participant, I want the standings to update on their own within about 10 seconds of an organizer entering points, so that I don't need to refresh.
24. As a participant, I want to see the list of Competitions with their max points and scoring (team or individual), so that I know what's worth playing for.
25. As a participant, I want Competitions shown in their Competition Group (e.g. "Team Night Events"), so that related competitions stay together.
26. As a participant, I want to see the Points Entries behind a Competition, so that I can see how points were awarded.
27. As a participant, I want individual points from immunity-style Competitions (counts toward team off) left out of team totals, so that team standings are fair.
28. As a participant, I want fractional points (e.g. 1.5) shown correctly, so that the totals are accurate.
29. As a participant, I want Teams shown using this year's Team Label (House / Tribe / Team), so that the app matches the story.

### Teams and roster

30. As a participant, I want to see each Team's roster, so that I know who's on my team.
31. As a participant, I want Leaders shown with this year's Leader Title (Captain / Head of House), so that I know who leads each team.
32. As a participant, I want each Participant's Company Tag (LTI, IL, …) shown on the roster, so that I can see affiliations.
33. As a participant in a free-for-all War Week, I want a roster of all Participants without teams, so that the roster still makes sense.

### Announcements, Awards, FAQ

34. As a participant, I want a news feed of Announcements, newest first with pinned ones on top, so that I can catch up on everything.
35. As a participant, I want Announcements with formatted text (headings, lists, links, images), so that they're easy to read.
36. As a participant, I want embedded video (YouTube / Loom / Vimeo / Drive) in Announcements, so that I can watch without leaving the app.
37. As a participant, I want to see Awards and their recipients, so that I know who got honored.
38. As a participant, I want an FAQ for the War Week, so that I can answer my own questions about time entry, guests and travel.

### Reveal

39. As a participant, I want to watch the standings be revealed with an animation at closing ceremonies, so that the result feels like an event.
40. As a participant, I want the Reveal to show up on my phone as well as the projector, so that everyone sees it together.

### Archive

41. As a participant, I want an Archive of every past War Week, so that I can explore the history.
42. As a participant, I want each past War Week to show its edition, year, dates, story theme, Teams and colors, winner, Awards and highlights, so that I remember what happened.
43. As a participant, I want each past War Week to appear in its own Appearance Theme, so that each year feels different (Harry Potter in 2023, Survivor in 2025).
44. As a participant, I want a link to the original wiki page on each past War Week, so that I can see the full source.
45. As a participant, I want the early years (2016–2018) shown as link-only cards in the same layout, so that the Archive looks complete even though those years have less detail.

### Organizer: sign-in and permissions

46. As an Organizer, I want to sign in with my `@jahnelgroup.com` Google account, so that I don't need another password.
47. As a JG employee who isn't on a War Week's organizer allowlist, I want to be able to sign in but have no write access, so that only organizers can change the War Week.
48. As a non-JG Google user, I want to be refused at sign-in, so that outsiders can't get in.
49. As an Organizer, I want an admin area only I can reach, so that write actions aren't visible to everyone else.

### Organizer: Points Entries

50. As an Organizer, I want to add a Points Entry by choosing a Competition, then a Team or a Participant, then points (decimals allowed) and an optional note, so that I can record a result in seconds.
51. As an Organizer, I want the Points Entry form to offer only Teams for team Competitions and only Participants for individual Competitions, so that I can't credit the wrong kind of target.
52. As an Organizer, I want a warning when an entry goes over the Competition's max points, so that I catch typos, while still being allowed to save it.
53. As an Organizer, I want to record a tie by entering the same points for each target, so that ties need no special handling.
54. As an Organizer, I want to edit and delete Points Entries, so that I can fix mistakes.
55. As an Organizer, I want to see the full ledger of Points Entries, with who entered each one and when, so that I can audit the standings.
56. As an Organizer, I want to enter points by hand for Competitions that have no schedule slot (HQ Attendance, survey rate, Subjective Points), so that every Competition can be scored.

### Organizer: Announcements, Awards, Reveal

57. As an Organizer, I want to write Announcements in a rich-text editor (bold, italic, headings, lists, links, images by URL), so that posts look good.
58. As an Organizer, I want to add video links to an Announcement and have any link outside the allow-list rejected, so that only safe embeds appear.
59. As an Organizer, I want to pin and unpin Announcements, so that I control what's featured.
60. As an Organizer, I want to edit and delete Announcements, so that I can correct them.
61. As an Organizer, I want to create Awards with recipients (Participants and/or a Team), so that I can record honors like MVPs and Core Values Awards.
62. As an Organizer, I want to hide the standings, so that the winner stays secret until closing ceremonies.
63. As an Organizer, I want to press Reveal to show the standings with an animation, so that I can create a big moment.

### Organizer: setup through the seed

64. As an Organizer, I want to set up a War Week (theme, Days, Schedule Items, Teams, Participants, Competitions, FAQ Items, organizer emails) with one validated seed file, so that setup is repeatable without needing admin screens.
65. As an Organizer, I want clear validation errors when a seed file is wrong, so that I can fix it before it loads.
66. As an Organizer, I want to set the War Week's status (upcoming / live / complete) by hand, so that which War Week is current never depends on the clock.

### Claude / MCP

67. As a JG employee using Claude, I want to connect Claude to War Weeker's MCP server, so that I can ask about War Week in natural language.
68. As a Claude user, I want to ask "who's winning?" and get the current standings, so that I don't need to open the app.
69. As a Claude user, I want Claude to say the standings are "hidden until closing ceremonies" while they're hidden, so that the app can't be used to spoil the Reveal.
70. As a Claude user, I want to ask about the schedule for a given day, so that I can plan.
71. As a Claude user, I want to ask for recent Announcements, Awards and the FAQ, so that I can catch up quickly.
72. As a Claude user, I want to ask about any past War Week ("who won in 2023?"), so that the history is easy to search.
73. As an MCP client, I want every tool to be read-only, so that connecting Claude never changes any data.

### History extraction (developer)

74. As the developer, I want Claude to read each old wiki page and write structured seed JSON that passes the seed schema, so that ten years of history don't have to be typed in by hand.
75. As the developer, I want the extracted JSON committed and editable by hand, so that I can fix what the extraction gets wrong and the app never calls Claude at runtime.
76. As the developer, I want the same extraction to produce War Week XI's schedule, Teams, roster and Competitions, so that the live demo War Week uses real data.

### Future-proofing

77. As a future integrator, I want each Participant to have an optional email, so that accounts, Stairs App data and the same person across years can be linked later.
78. As a future integrator, I want a written note on how a Stairs integration would work, so that it can be built after the hackathon without starting research over.
79. ~~As an Organizer, I want an env flag that requires sign-in to read anything.~~ Superseded (ticket 08 scope change, 2026-09-23): sign-in is always required, with no flag.

## Implementation Decisions

### Stack and structure
- A new codebase, not a fork. It uses Next.js (App Router), TypeScript, Tailwind, shadcn in the **base-nova (Base UI)** style, Drizzle ORM, Postgres (Docker locally, Neon in production), better-auth, zod, recharts, vitest and pnpm, and deploys to Vercel.
- Pieces copied from Competiscore:
  - the better-auth setup, with only the Google provider kept
  - the database client, including its production/local driver switch and the `DBOrTx` transaction pattern
  - chart components where they help
  - its coding conventions: text-length limits enforced in both the database and zod, and server actions for writes
- The rich-text editor is copied from journeys: TipTap v3, content stored as ProseMirror JSON in `jsonb`, a zod content schema with sanitizers that run on write and again on render, and a server-rendered read-only viewer.
- Domain vocabulary (War Week, Edition, Story Theme, Day Theme, Appearance Theme, Mode, Team, Team Label, Leader, Leader Title, Participant, Company Tag, Organizer, Competition, Competition Group, Points Entry, Counts Toward Team, Standings, Reveal, Award, Announcement, FAQ Item, Archive) goes into the new repo's CLAUDE.md and is used consistently in code. Don't use Event, League, Member, Match, ELO, Placeholder or Tournament.

### Modules
- **Seed schema and loader.** zod schemas describe a complete War Week seed file. The loader validates a file and upserts it by edition in one transaction. Setup data is loaded **only** through the seed. The extraction script and the loader share the same schemas.
- **Standings module.** One pure function. It takes the War Week's mode, the Competitions, the Participants with their Team memberships, the Points Entries and the hidden flag. It returns either `hidden`, or team standings plus individual standings, with the main leaderboard marked according to the mode. Every page and MCP tool gets standings through this function, and none of them does its own math.
- **Read model / queries.** A small set of query functions: the current War Week, a War Week by edition, the schedule (optionally for one date), standings, the Competition ledger, Announcements, Awards, the FAQ, and the Archive list and detail. Pages and the MCP server both call these, so there's one read path.
- **Organizer actions.** Server actions for creating, editing and deleting Points Entries, creating, editing, deleting and pinning Announcements, creating, editing and deleting Awards, and setting standings hidden or revealed. Each action checks that the signed-in user's email is on that War Week's organizer allowlist.
- **MCP server.** Remote Streamable HTTP at `/api/mcp` on the same deployment. It is read-only. It accepts a signed-in JG session, or `Authorization: Bearer <MCP_TOKEN>` for MCP clients like Claude Code (ticket 21); `MCP_PUBLIC=true` opens it with no auth for a claude.ai connector demo. No tool returns an email or the Organizer allowlist, so public mode shows only what a signed-in Participant sees. MCP OAuth is out of scope. Tools:
  - `get_current_war_week`
  - `get_leaderboard(kind: team | individual)`
  - `get_schedule(date?)`
  - `get_announcements(limit?)`
  - `get_awards`
  - `get_faq`
  - `list_history`
  - `get_history(year)`

  While standings are hidden, `get_leaderboard` returns an explicit "hidden until closing ceremonies" result and no numbers.
- **History extraction.** Done once at dev time by Claude Code reading each old wiki text file and writing one seed JSON file per year (`seeds/<edition>.json`), validated by the seed schema. The output is fixed by hand and committed; the app never calls Claude. (An AI Gateway script was dropped: the gateway free tier doesn't serve the model, and Claude Code does the same job.)
- **Theming.** The War Week's Appearance Theme (primary and accent colors, logo, banner, one of 2–3 font presets) is applied as CSS variables at the War Week layout. Archived War Weeks render in their own theme.

### Schema (entities and key rules)
- **War Week:**
  - edition (roman numeral string plus integer), year, start and end dates, story theme
  - status: `upcoming` / `live` / `complete`
  - mode: `teams` / `free-for-all`
  - team label, leader title, Slack channel URL, `standingsHidden`
  - Appearance Theme fields, wiki URL, organizer emails (a list)
  - for past years: winner (text) and highlights (a list of text)
  - The **current** War Week is the one with status `live`, or failing that the next `upcoming` (earliest start date), or failing that the most recent `complete`. It is never derived from the clock.
- **Day:** War Week, date, day theme.
- **Schedule Item:** Day, start time, end time (optional), title, host (optional), location (optional), virtual link (optional), description (rich, optional), category (`competition` / `education` / `social` / `meal` / `work`), Competition (optional). All times are ET. Items don't repeat.
- **Team:** War Week, name, color, logo (optional). A free-for-all War Week has no Teams.
- **Participant:** War Week, display name, Company Tag (optional), email (optional, unique within a War Week), Team (optional), Leader flag. A Participant is a record, not a user account.
- **Competition:** War Week, name, description, max points (optional), scoring (`team` / `individual`), Counts Toward Team (meaningful only for individual scoring), Competition Group (optional text).
- **Points Entry:** Competition, **exactly one** of Team or Participant (enforced in the database and in zod), points (decimal, may be fractional), note (optional), entered-by email, entered-at time.
  - Team Competitions accept only Team targets; individual Competitions accept only Participant targets.
  - Going over the Competition's max points is a warning in the UI, not an error.
- **Award:** War Week, name, description, recipients (Participants and/or one Team). Awards don't affect Standings.
- **Announcement:** War Week, title, body (rich), video URLs (a list, each checked against a YouTube / Loom / Vimeo / Drive allow-list), pinned flag, author email, published-at time.
- **FAQ Item:** War Week, question, answer (rich), sort order.
- Past War Weeks may have no Points Entries. Their winner is stored text, not computed.

### Standings rules
- **Team total** = the sum of Points Entries targeting the Team, plus the sum of Points Entries targeting its member Participants in individual Competitions where Counts Toward Team is on.
- **Individual total** = the sum of Points Entries targeting the Participant, across all individual Competitions, whatever Counts Toward Team is set to.
- **Main leaderboard:** team standings in `teams` mode, individual standings in `free-for-all` mode.
- **Ordering:** by total, descending. Tied totals share a rank. Points are decimals, with no rounding beyond display.
- **Hidden:** when `standingsHidden` is on, the public pages and MCP get `hidden` for **both** leaderboards. Organizers still see the standings in admin.

### Auth and access
- better-auth with Google only. The OAuth consent screen is Internal, and the app also rejects any email outside `@jahnelgroup.com`.
- Every page and API route requires a `@jahnelgroup.com` sign-in (ticket 08 scope change, 2026-09-23; previously reads were public behind an env flag).
- Organizer = a signed-in user whose email is on the War Week's organizer allowlist from the seed. There are no other roles. Leaders are labels only.

### Live updates and Reveal
- Home and leaderboard pages poll with `router.refresh()` about every 10 seconds. There are no websockets.
- Reveal clears `standingsHidden`. Clients that notice the change from hidden to revealed on their next poll play the Reveal animation, with standings counting up in reverse rank order, so the projector and phones animate together.

### URLs and navigation
- `/` shows the current War Week.
- `/[edition]` is the War Week home, with `/[edition]/schedule`, `/[edition]/leaderboard`, `/[edition]/news`, `/[edition]/teams`, `/[edition]/awards`, `/[edition]/faq` and `/[edition]/competitions/[id]`.
- `/history` is the Archive.
- `/admin` is organizer-only and needs to work on desktop only.
- Primary navigation (Home · Schedule · Leaderboard · News · More) is responsive, switching at Tailwind's `md` breakpoint (768px):
  - below `md` (phones, small tablets): a fixed bottom tab bar, with page content padded so it isn't covered.
  - `md` and wider: a sticky top header with the War Week name and the same destinations as horizontal links; no bottom tab bar.
  - Both come from one shared destination list (`src/components/primary-nav.tsx`), so a new public page is added once and appears in both.
- Every public page is laid out mobile-first and must also use desktop width sensibly: single column below `md`; at `md`+ content widens (up to about `max-w-3xl`–`max-w-5xl`) and may use multiple columns (e.g. schedule Days side by side, leaderboard next to Competitions). Full-width mobile controls (such as the Slack button) become auto-width on desktop.
- The Reveal must work on a projector-sized desktop screen as well as on phones.

### Demo seed
- War Week XI (2026, The Matrix, Red vs. Blue): status `live`, real Days, Schedule, Teams, roster and Competitions from the wiki.
- Fictional mid-week Points Entries with a close race, a few Announcements (one pinned, one with video), a few Awards, and `standingsHidden` **on**.
- A Matrix Appearance Theme (green on black).
- Past War Weeks 2016–2025 with status `complete`, from extraction.

## Testing Decisions

- **What makes a good test:** it drives a module through its public interface and checks what comes out. It never checks internals, private helpers or how something is implemented. Tests use vitest and run fast. The pure-module tests need no database.
- **Seam 1, Standings (the main seam).** Table-driven tests of the Standings function:
  - team totals made only of team entries
  - member entries with Counts Toward Team on and off (immunity)
  - free-for-all mode making individual standings the main leaderboard
  - fractional points
  - tied totals sharing a rank
  - a War Week with no entries
  - `hidden` hiding both leaderboards
- **Seam 2, Seed parsing.** Every committed seed file must pass the seed schema. Invalid fixtures must be rejected:
  - a Points Entry with both a Team and a Participant, or with neither
  - an unknown Schedule Item category
  - Counts Toward Team set on a team Competition
  - an Announcement video URL outside the allow-list
  - duplicate Participant emails within a War Week
- **Seam 3, Smoke (the gate for each slice).** Load the demo seed into local Postgres, start the app, and check that `/xi`, `/xi/leaderboard` and `/api/mcp` respond. While hidden, the MCP `get_leaderboard` must return the hidden result. This smoke test is the only coverage for the UI and admin forms.
- **Gate for each slice:** type-check, lint, vitest, a production build and the smoke test must all pass. A slice that fails stops and reports rather than guessing.
- **Prior art:** this repo has no code yet. The closest examples are the vitest service tests in the neighboring Competiscore repo and the rich-text shortcut test in journeys.

## Out of Scope

- **Cut completely:** Leagues, ELO, match and bracket tracking, multi-tenancy, video hosting and uploads, image uploads, Slack cross-posting (except new Announcements via webhook, ticket 15), hours tracking and hours-based honors (computed Four Score or Centurion), the War Week projects board, sign-ups and interest forms, an AI chat inside the app, per-person history across years.
- **The Stairs App integration.** HQ Attendance is scored with Points Entries entered by hand. A doc stub records how the integration could work:
  - The Stairs App logs self-reported stair climbs, keyed by `@jahnelgroup.com` email.
  - Its API needs a Firebase ID token.
  - The recommended future route is an API-key-protected date-range report endpoint added to the Stairs backend, about 5–8 hours.
  - The blocker is that no one is documented as owning the Stairs deploy.
- **Admin screens for setup** (theme, Days, Schedule, Teams, roster, Competitions, FAQ). Moved into scope as the setup CRUD stretch item: ticket 25 delivers War Week settings, the Appearance Theme and Days in `/admin/setup`; tickets 26 and 27 add Teams, roster, Competitions, Schedule and FAQ. The seed stays the way to bootstrap a War Week, and reloading it overwrites setup edited in the UI.
- **Roles other than Organizer**, including captains entering points.
- **Stretch items, only if time allows, in this order:**
  1. account linking (a Google sign-in matched to a Participant by email) (delivered: ticket 20)
  2. a "Which one is you?" picker (localStorage) that highlights you on the leaderboard and roster (delivered: ticket 20)
  3. placement presets (1st/2nd/3rd turned into points) (delivered: ticket 22)
  4. a video node inside the rich-text editor (delivered: ticket 23)
  5. `llms.txt` (delivered: ticket 24)
  6. setup CRUD screens (delivered: ticket 25 War Week settings and Days, 26 Teams, roster and Competitions, 27 Schedule and FAQ)

## Further Notes

- **Deadline:** hackathon submission is Fri 2026-09-25 at 10:00 AM ET. There's a 5-minute demo at 12:00 PM if selected.
- **Ranked cut list.** Drop from the bottom if time runs out:
  1. schema, seed, a themed home page, Google organizer sign-in, deploy
  2. leaderboard in both modes, Points Entry admin, polling
  3. schedule
  4. Reveal
  5. MCP
  6. Archive
  7. Announcements
  8. Awards
  9. FAQ
- **Build slices.** Run one `/atlas-implement` per slice to stay within the token budget.
  - **Wed PM:** scaffold, schema, seed schemas, extraction, skeleton deploy.
  - **Thu AM:** items 1–3.
  - **Thu PM:** items 4–7, then 8–9.
  - **Fri 8:00–9:30:** freeze, polish, rehearse, submit.
- **Demo script:**
  1. The wiki-drift hook.
  2. A QR code so the audience opens the app on their phones.
  3. Theme, now/next, schedule and leaderboard.
  4. An organizer enters points and phones update.
  5. An Announcement with video.
  6. The Archive, with the theme changing to 2023.
  7. In Claude, "who's winning?" gets "hidden". Press Reveal, then ask Claude again.
  8. The close.
- **Prerequisites the developer handles:**
  - Google OAuth client (Internal consent screen; redirect `/api/auth/callback/google` on localhost and on the Vercel domain)
  - `BETTER_AUTH_SECRET`
  - the Vercel project and Neon database (later)
  - the organizer allowlist (in the XI seed)

  Credentials go in the gitignored `.env.local`. `.env.example` lists the variable names.
- **Source material:** the grill-me brief at the repo root, the old wiki pages from 2016 to 2026, and the neighboring Competiscore, journeys and Stairs App repos, used for reference only.

# Maintainer's guide

For Jason, or anyone who runs War Week and wants to change the JG War Week app
without learning the whole stack first. You describe the change to Claude
Code, review what it did, check it, and ship it. This page tells you how,
and how to leave the repo no worse than you found it.

Setup details live in [`README.md`](../README.md); this page links there
instead of repeating them.

**Most War Week changes need no code.** Before you open Claude, check
whether an organizer screen at `/admin` already does it (see
[Recipes](#recipes)).

## 1. Get access

Ask Paul for each of these. Never ask for, or share, the values in chat:
you set them in your own `.env.local` or in the service's settings.

| What                                       | Why                                                                                           | Who grants it                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------ |
| GitHub repo, write access                  | Branches, PRs, the Actions tab (Migrate and Seed workflows)                                   | Paul                           |
| Vercel project                             | Preview deploys, production deploys, env vars, rollbacks                                      | Paul                           |
| Neon project                               | The staging and production databases (you rarely touch them directly)                         | Paul                           |
| Google Cloud OAuth client                  | Local sign-in: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and adding redirect URIs           | Paul                           |
| Organizer list                             | `/admin` only opens for Organizers (and Hosts, for their Competitions)                        | Any Organizer, in-app          |
| Claude Code with the Atlas plugin          | The recommended way to make changes ([section 2](#2-set-up-claude-code))                      | You (Paul if the install fails) |

Your local `.env.local` needs the variables named in `.env.example`:
`DATABASE_URL`, `DATABASE_DRIVER`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `MCP_TOKEN`. The
local database defaults work as-is. Slack posting isn't built yet, so
there's no Slack app to be granted.

Then follow [README: Fresh clone setup](../README.md#fresh-clone-setup) and
[README: Organizer sign-in](../README.md#organizer-sign-in).

## 2. Set up Claude Code

Atlas is highly recommended. It's the Jahnel Group Claude Code plugin this
repo was built with: it keeps work on feature branches, runs the checks, and
writes proof into `test-results/`. In Claude Code:

```text
/plugin install mattpocock-skills@claude-plugins-official
/plugin marketplace add JahnelGroup/atlas-plugins
/plugin install atlas@atlas-plugins
```

Restart Claude Code, open it in the repo folder, and it reads `CLAUDE.md`
automatically. [`docs/atlas-operators-guide.md`](./atlas-operators-guide.md)
explains, in plain language, what Atlas does here.

Pick the lightest route that fits (the full route, including optional
`/atlas-red-team` and `/atlas-plan` steps, is in `CLAUDE.md` under "Atlas
repository workflow"):

| Change                                  | Run                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Small and clear (copy, a field, a bug)  | `/implement <what you want>`                                               |
| A real feature                          | `/grill-with-docs` → `/to-spec` → optional `/to-tickets` → `/atlas-implement` |
| Big or fuzzy                            | `/wayfinder`, then the feature route                                       |
| A ticket that already exists            | `/atlas-implement .scratch/war-weeker/issues/<NN>-<slug>.md`               |

Tickets and specs are plain markdown under `.scratch/war-weeker/`.

**Without Atlas.** Plain Claude Code works too; it still reads `CLAUDE.md`.
Start each request with: "Read `docs/maintainers-guide.md` and `CLAUDE.md`,
make a `feat/…` branch from `staging`, then …". Ask it to run `pnpm gate`
before it says it's done.

## 3. Where things live

| Thing                                      | Where                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Participant pages (home, leaderboard, schedule, teams, competitions, announcements, awards, FAQ) | `src/app/[edition]/`                    |
| History page                               | `src/app/history/`                                                     |
| Organizer screens                          | `src/app/admin/` (points, competitions, schedule, roster, settings…)  |
| Server actions behind admin forms          | `src/actions/`                                                         |
| Database reads / writes                    | `src/queries/`, `src/mutations/`                                       |
| Rules with unit tests (standings, schedule, Finale, access…) | `src/lib/` (`*.test.ts` next to each file)           |
| The Bracket engine (seeding, Rounds/Heats, advancing winners, Bracket → Points Entries) | `src/lib/bracket/` (`*.test.ts` next to each file) |
| Bracket builder and results screens                | `src/app/admin/competitions/[id]/bracket/`, `src/app/admin/brackets/[id]/` |
| Participation (scoring, Check in rule)     | `src/lib/participation/` (`score.ts`, `check-in-rule.ts`, `input.ts`), `src/mutations/participation.ts`, `src/queries/participation.ts` |
| Participation setup page, and its Competition page parts | `src/app/admin/competitions/[id]/participation/`, `src/components/participation-builder.tsx`, `participation-view.tsx`, `check-in-button.tsx` |
| Award Categories (list, rename, archive, restore) | `src/lib/award-categories.ts`, `src/mutations/award-categories.ts`, `src/components/award-categories-editor.tsx` (on `/admin/awards`) |
| Awards grouped by Category; a Category through the years | `src/app/[edition]/awards/`, `src/app/history/awards/[id]/`, `src/queries/award-category-history.ts`; the list on `/history` is `src/app/history/(list)/` |
| Database schema                            | `src/db/schema.ts`                                                     |
| Migrations (generated, never hand-edited)  | `drizzle/`                                                             |
| Seed data, one file per War Week           | `seeds/i.json` … `seeds/xi.json`, the tentative upcoming `seeds/xii.json`; the live XI demo in `seeds/demo/xi.json` |
| Seed format and loader                     | `src/seed/schema.ts`, `src/seed/load.ts`                               |
| Appearance Theme → CSS                     | `src/lib/theme.ts`                                                     |
| Shared UI pieces                           | `src/components/` (shadcn primitives in `src/components/ui/`)          |
| MCP server (Claude connector)              | `src/app/api/mcp/route.ts`, tools in `src/mcp/`, list in `src/mcp/tools.ts` |
| Profiles (name, picture) and Delete my account | `src/lib/profile.ts`, `src/queries/profile-join.ts`, `src/app/[edition]/profile/`, `src/mutations/account.ts` |
| Test sign-in (staging only)                | `src/lib/test-sign-in.ts`, `src/app/sign-in/test/`, `src/actions/test-sign-in.ts` |
| Who can do what                            | `src/lib/access.ts` (`can`), `src/auth/authorize.ts`, `src/auth/actor.ts` |
| Smoke test                                 | `scripts/smoke/` (entry: `scripts/smoke/index.ts`)                     |
| Browser flows (Playwright, `pnpm e2e`)     | `e2e/`, `playwright.config.ts`                                         |
| Past wiki text for history                 | `old-wikis/2016.txt` … `old-wikis/2026.txt`                            |
| CI, deployed migrations, seeding           | `.github/workflows/` (`ci.yml`, `migrate.yml`, `seed.yml`)             |

The words in code come from [`CONTEXT.md`](../CONTEXT.md). The ones you'll
see most: **War Week** (one year), **Edition** (`xi`, used in URLs),
**Story Theme** / **Day Theme** / **Appearance Theme**, **Team**,
**Participant**, **Organizer**, **Competition**, **Points Entry**,
**Standings**, **Finale**, **Award**, **Announcement**, **FAQ Item**,
**Archive**. `CONTEXT.md` also bans a few words in code ("Event", "Member",
"Match", "Tournament"…); Claude knows, but that's why it renames yours.

The **current** War Week (the one `/` and `/admin` use) is the `live` one;
failing that the next `upcoming` one; failing that the latest `complete` one.

## 4. The loop

Every change, however small:

1. **Branch from `staging`.** `git switch staging && git pull`, then
   `git switch -c feat/<slug>` (or `fix/…`, `chore/…`, `docs/…`).
   **Never commit to `staging` or `main`.**
2. **Ask Claude** (`/implement …` or the feature route above). Read the diff
   it shows you.
3. **Look at it.** `pnpm dev`, open http://localhost:3000.
4. **Check it.** `pnpm gate` (type-check, lint, tests, build, smoke, then
   the Playwright browser flows, `pnpm e2e`). It must pass. Needs Docker
   Postgres running (`docker compose up -d`), and `DATABASE_URL` must point
   at it: smoke and e2e reset every seeded War Week, so each refuses any
   database that isn't on `localhost`, `127.0.0.1` or `[::1]`. If yours
   comes from Vercel, run
   `DATABASE_URL=<the .env.example value> pnpm gate`. First time only:
   `pnpm exec playwright install chromium`.
5. **Open a PR into `staging`.** Ask Claude to "commit and open a PR into
   staging", or `gh pr create --base staging`. CI runs on the PR: lint,
   types, tests, build, smoke and the Playwright flows against its own
   Postgres, and a migration drift check that fails when
   `src/db/schema.ts` changed without a `drizzle/` migration.
6. **Check the Vercel preview** linked on the PR.
7. **Merge into `staging`.** The staging database migrates automatically.
8. **Ship to production:** open a PR from `staging` into `main`, merge it.
   Production migrates and deploys. Check https://jg-war-week.vercel.app.

## Recipes

Each has a prompt you can paste into Claude. Replace the `<…>` parts.

### Change copy or text

```text
/implement Change "<old text>" to "<new text>" on the <page> page.
```

Words must follow `CONTEXT.md`. If Claude refuses a word, that's why.

A change people can see also updates `/about` in the same PR: its copy
(`src/app/about/page.tsx`, `src/lib/about.ts`: six key-feature cards, copy
that reads the same for Teams and free-for-all) and, when a feature card's
screen changed, its still. Regenerate the stills from the current War
Week's demo, never by hand: `scripts/about-media.ts` captures whichever War
Week is current, in its theme and mode, so first load that edition's demo
(`seeds/demo/<edition>.json`) as the one live War Week. For XII:
`pnpm build && pnpm seed:demo:xii`. Next year, write
`seeds/demo/<edition>.json` and a matching `seed:demo:<edition>` script in
`package.json`, then rerun. Afterwards `pnpm seed:demo` (or `pnpm smoke` /
`pnpm e2e`, which load it themselves) puts the local database back on the XI
demo.

```bash
pnpm tsx scripts/about-media.ts
```

On an edition change, run it with no flag: the Finale poster
(`finale-poster.png`, the Finale's Title slide on a phone; the run steps
through the slideshow with → to the Standings countdown as a check) wears the
old edition's theme, so it must be re-recorded too. Use `--stills` only when the poster's edition is unchanged
(`pnpm tsx scripts/about-media.ts --stills` rewrites the feature-card and
Standings stills and leaves the poster alone). Either way it rewrites the home Standings hero's three stills
(`standings-before.png`, `standings-entry.png`, `standings-after.png`).

Every About still comes in light and dark: the script writes `<name>.png`
under the light Display and `<name>-dark.png` under the dark one (20 files
in `public/about/`), and `/about` shows the pair member matching the
viewer's Display (`AboutStill`, `data-still-scheme` in `globals.css`).
Never add or replace only one of a pair.

### Run a new War Week or change this year's theme (no code first)

Organizer screens cover it. Sign in and go to `/admin` (it opens on
Points). The admin is one flat nav: **Points, Competitions, Schedule,
Roster, Announcements, Awards, FAQ, Finale, Settings, Organizers, Guide**.
There is no Overview and no Setup hub; the old `/admin/setup/...` URLs
redirect to their new homes.

- **`/admin/settings`**: War Week settings (Story Theme, dates, mode, Team
  Label, Leader Title, links, Winner and highlights, editable directly for
  corrections; a free-for-all hides Team Label, Leader Title and the
  Roster's Team controls, and keeps their saved values for if you switch
  back to Teams), the Appearance Theme (colors, font, logo, banner), the
  **Lifecycle** box (Start, End with the computed Winner and highlights,
  Unstart while nothing is scored and it has never been ended, Reopen) and
  **Create next War Week**. The seed-overwrite warning shows here. **The
  form saves itself**: each field saves a moment after you stop
  typing, with "Saving…" then "Saved" by the heading and no Save button; a
  value the server refuses (a Slack URL that isn't `https`) shows its error
  at the field, keeps what you typed and isn't saved. The Appearance Theme
  form shows both color schemes: whichever one the five colors you set are
  the base palette for, and the other scheme's colors, derived from them
  automatically. Any of the derived scheme's five colors can be
  overridden; changing a background across light and dark clears every
  override you haven't touched yourself. Viewers never see your Settings
  screen's scheme — each picks their own Display (Light, Dark or System)
  from the avatar **account menu** at the top right of every header.
- **`/admin/schedule`**: the War Week's Days (with Day Themes and an
  optional short Day description) and each Day's Schedule Items on one
  page. **`/admin/roster`**: Teams and Participants, with an Organizer-only
  Import (paste from Google Sheets or upload a CSV, preview, then Import).
  **`/admin/competitions`**: Competitions, with their Hosts.
- **On a phone**, the admin sections are a bar fixed to the bottom of the
  screen (Points, Competitions, Schedule, Announcements, More); More opens a
  Sheet with the other sections you can see and the edition switcher.
  Display, the way back to the War Week, Slack and Sign out are in the
  avatar account menu in the header. From `md` up it is the side column and
  header. The sections live in `src/lib/admin-sections.ts`.
- **Every admin list row has a visible Edit and Delete button.** The row is
  `SetupListRow` in `src/components/setup-row.tsx`: Edit opens the form in a
  `ResponsiveSheetDialog` (a Sheet on phones, a Dialog from 768px) and
  Delete opens a `ConfirmDialog` and ends in a toast. The Add button sits
  below the list. Competitions, Days, Schedule Items, Teams, Participants,
  FAQ, Awards and Organizers all use it; Announcements' Edit links to their
  own full page. There are no `/new` or `/[id]` pages for Schedule, FAQ or
  Awards. A Team's row reads "Edit <Team Label> <name>". "Assign Hosts" (the
  Hosts field) is inside the Competition's Edit form, and its one Save
  saves the Hosts with the rest.
- **You comes from the roster email only.** A signed-in person is "You" (the
  highlight, Log a Game, reporting a Heat) only when their email matches a
  Participant's roster email; there is no "Which one is you?" pick. A
  Participant row without an email shows "No email: won't be linked when they
  sign in" on Roster.
- **`/admin/organizers`**: the Organizer list (see
  [Add an Organizer or assign Hosts](#add-an-organizer-or-assign-hosts)).
- **`/admin/points`**, **`/admin/finale`** (Run the Finale: the slide list and Awards layout, "Open Finale" at closing ceremonies, and "Finale: <Competition>" for each finalized Bracket),
  **`/admin/announcements`**, **`/admin/awards`**.

To start next year's edition in the app:

1. In `/admin/settings`, press **Create next War Week**. The edition, number
   and year are prefilled (XII, 12, next year); add the dates and Story
   Theme, and choose what to copy (settings are on; Competitions, with
   their Hosts, and the FAQ are off). Organizers are global, so there's
   nothing to copy for them. It starts `upcoming`, and the admin
   switches to it so you can set it up while XI stays current.
2. When XI is over, switch back to XI in the header's edition switcher and
   press **End War Week**: the dialog shows the Winner it will record —
   whoever is first in the Standings, "Tie: A & B" when two or more Teams
   or Participants tie for first, blank when nobody scored — and lets you
   add any highlights. There is no way to type a different Winner. XI moves
   to the Archive. The confirm also names any Bracket that isn't finalized
   and any open `games` Competition with Games or `participation` Competition
   with anyone marked, each linked to its setup page. Finalize or close them first so their placings
   count; it warns, it doesn't stop you.
3. Switch to XII and press **Start War Week**. `/` and `/admin` now go to
   XII. Only one War Week can be live, so XI must end first.

Organizers can still pick any Archive edition in the switcher to correct
its results.

A seed file for a new edition is optional (for demo data or a bulk
import). If you use one, load it with the **Seed** workflow in the GitHub
Actions tab (pick the environment and the file). A reload never changes a
War Week's status, Winner or highlights. Once organizers edit a War Week in
the app, stop reloading its seed: a reload overwrites their other edits,
including each seeded Day's Day Theme and description.

### Add an Organizer or assign Hosts

No code. There are three roles: **Organizers** run every War Week, a
**Host** runs the Competitions an Organizer assigns them, and everyone else
signed in is a **Participant** (`CONTEXT.md`, "Access rules").

- **Add or remove an Organizer**: `/admin/organizers` (the Organizers link
  in the Admin nav). Add a `@jahnelgroup.com` email; it works on their next
  page load. Any Organizer can remove any other, or themselves, as long as
  one Organizer is left. The list is global: one list for every War Week.
- **Assign Hosts**: `/admin/competitions`, the Hosts field in each
  Competition's Edit form, saved with its Save (Organizers only). A Host needs
  no Participant record. They get the Admin link and see only their Competitions in Admin: its Points
  Entries, Bracket, setup and linked Schedule Items, plus Announcements for
  that War Week. Remove the email to take it away; it applies on their next
  request. A Schedule Item's "host" text is only what the schedule shows;
  it doesn't make anyone a Host.
- **A fresh database** gets its first Organizers from a seed's `organizers`
  list: a seed load adds any that are missing and never removes one, even
  with `--reset`. After that, manage them in the app. Hosts never come from
  seeds; a plain reload leaves them alone, and `--reset` deletes them along
  with the War Week's Competitions.
- **Expand/contract.** `war_week.organizer_emails` and
  `competition.bracket_points` were dropped in migration 0013 once Epics B
  and E had run on `main` long enough that rolling back past them was no
  longer a concern. The same expand-then-contract shape applies to any
  future column removal: land the column unused first, wait out the
  rollback window, then drop it in its own migration. R11 is a deliberate,
  approved exception (decision H1-a, 2026-10-02): it moves
  `announcement.video_urls` into the body and drops the column in the same
  release (see [Rolling out R11](#rolling-out-r11-migrations-00200022)).

### Test as someone else (Test sign-in)

Test sign-in lets you sign in as any `@jahnelgroup.com` address without a
Google account, so you can test as a Participant, Host or Organizer on
staging. It is never on for production (ADR 0008).

- **Turn it on.** Generate a secret with `openssl rand -base64 32` and set it
  as `TEST_SIGN_IN_SECRET` on the **staging** Vercel environment only, never
  on main/production. It must be at least 32 characters, or Test sign-in
  stays off. PR previews have no Vercel environment, so it is off there too.
  Redeploy staging after setting it. Never paste the secret into Claude or a
  chat.
- **Use it.** Open `/sign-in/test` on staging, type an email and the secret.
  A `+` alias is a different person each time:
  `you+participant@jahnelgroup.com`, `you+host@jahnelgroup.com`,
  `you+organizer@jahnelgroup.com`.
  - **Participant:** put the alias on a roster row's email
    (`/admin/roster`), and it links as that Participant. With no roster row
    it is a signed-in person on no roster.
  - **Host:** add the alias in a Competition's Hosts field
    (`/admin/competitions`).
  - **Organizer:** "inviting" is just adding the alias at
    `/admin/organizers`.
- **Every page shows a "Test sign-in: <email>" banner** while you are in a
  test session.
- **Turn it off.** Remove `TEST_SIGN_IN_SECRET` and redeploy: every test
  session counts as anonymous (pages, the proxy and MCP) while it stays
  removed. Setting any secret again revives the unexpired test sessions.
  Test accounts are real `user` rows; Delete my account removes them like
  anyone's.
- **Rotate it, or after a suspected leak.** First delete the test sessions
  on the staging database (`delete from session where test_sign_in;`), then
  set the new secret and redeploy.
- **Code:** `src/lib/test-sign-in.ts` (the gate), `src/actions/test-sign-in.ts`,
  `src/app/sign-in/test/page.tsx`, `src/components/session-banner.tsx`,
  `src/auth/server.ts`.

### Profiles and Delete my account

- **Profile.** Every signed-in person can set a Profile name and a picture
  URL from **Profile** in the account menu (`/<edition>/profile`). They
  override the roster name and picture everywhere that email is on a roster,
  in every War Week, past ones too; empty means the roster name shows, and
  with no picture URL the Google photo, then initials, show. An Organizer
  changes the roster name, never the person's Profile: the roster form shows
  a set Profile name read-only, "Set by the person". Pictures are `https://`
  URLs only; there is no upload. Code: `src/lib/profile.ts` (the pure
  resolver), `src/queries/profile-join.ts` (the SQL one),
  `src/app/[edition]/profile/page.tsx`, `src/components/profile-form.tsx`,
  `src/mutations/profile.ts`. A new place that shows a person's name must go
  through the resolver (ADR 0007), never read `display_name` alone.
- **Delete my account.** At the bottom of the Profile page, behind a
  typed-email confirm. It removes the login, the Profile and the person's
  Organizer-list entry (refused for the last Organizer), and keeps roster
  records, results, Awards, Announcements, history, Host assignments and
  email audit columns; those show the roster name again. Signing in again
  makes a fresh account that re-links by email. Code:
  `src/mutations/account.ts`, `src/actions/account.ts`,
  `src/components/delete-account-section.tsx`. A person asking Jason to
  remove them from Host or audit records is outside this button: that is a
  data request for the Jahnel Group admins.

### Rolling out R10 (migrations 0018 and 0019)

Migrations 0018 (`session.test_sign_in`) and 0019 (the `profile` table) are
additive. Vercel deploys on push and `migrate.yml` runs separately, so check
the order each time R10 reaches staging, and again on promotion to `main`:

1. Confirm the **Migrate** GitHub job succeeded **before** checking the
   deploy. Until `session.test_sign_in` exists, `getSession` fails and every
   page errors.
2. If the deploy went live first, re-run the Migrate job.
3. A Vercel rollback is safe: the new columns and table are unused by the
   previous build.

### Rolling out R11 (migrations 0020–0022)

- **0020** adds `day.description`. Additive.
- **0021** moves each Announcement's video links into its body, as video
  blocks after the existing text.
- **0022** drops `announcement.video_urls`. **Destructive: it can't be
  rolled back.**

So R11 doesn't follow the usual expand-then-contract wait:

1. Merge to `staging`, and promote to `main`, **outside War Week**.
2. Between the Migrate job and the new deployment going live, Announcement
   pages on the old deployment error (the old code reads the dropped
   column). Confirm the **Migrate** job succeeded, then that the new
   deployment is live, and check an Announcement page.
3. **A Vercel rollback past R11 isn't safe**: the old build reads
   `announcement.video_urls`, which no longer exists. Fix forward instead.

### Run a knockout Competition as a Bracket

Organizer screens cover setting one up and running it. Under
**Competitions**, tap **Add Competition** (it opens a Sheet) and
choose its **Format**: "Single elimination" ("A knockout Bracket: one loss
and an Entrant is out.") or "Heats" ("A Bracket where Entrants play in
Heats; a set number advance each Round."). **Add Competition**, and you land
straight on that Competition's Bracket setup page. There, pick Entrants
(all Teams, or specific Participants) and
Generate; then record each Heat's result — from the results screen
(`/admin/brackets/<id>`) or straight from the Competition page, either one
opening a dialog centered on a screen and a bottom sheet on a phone — and
Finalize to write its placings as Points Entries. No code needed for any of
that. While a Bracket is finalized, its Competition's scoring and Placement
Points can't change ("Un-finalize the Bracket first."); its name and
description still can. Changing an existing Competition's Format happens on
its Bracket page, not the Competition's Edit form.

A Bracket reads as a tree by default on its Competition page: single
elimination shows its Rounds left to right joined by lines; Heats shows one
box per Heat with the advancers highlighted. On a phone it's one Round at a
time, with Round tabs. Results fill in live as they're recorded, and a
**List** toggle switches back to the plain list. `/admin/brackets/<id>` (the
results screen) still shows the list.

On the day: the builder's **By Standings** button draws Seed Positions
from the current Standings (ties at random) instead of Generate's random
draw. On the results screen, each Heat's **Time & place** button sets its
Day, start time (ET) and location; Hosts can do it for their own
Competitions. A timed Heat shows its when-line ("Sunday, Feb 22 · 7:00 PM
ET · Main room") on its card and in the Participant's "Your next Heat", and
joins the home page's Now/Next once its Entrants are known. A re-draw
clears every time, so the builder asks first. Once finalized, the Bracket
has its own **Bracket Finale** at `/<edition>/finale/<competitionId>` for
the projector, linked from its champion card, the results screen and
`/admin/finale` ("Finale: <Competition>"). The rules are under "Bracket
rules", "Schedule display rules" and "Finale rules" in `CONTEXT.md`.

Single elimination is a straight 1v1 knockout. Heats plays several Entrants
at once: its builder shows a "Heat settings" form for Entrants per Heat and
how many advance from each, and its results screen has Organizers tap the
whole finishing order instead of just a winner once a Heat holds more than
two.

A team Competition can enter **Squads** instead of whole Teams: in the
builder's Squads section, **Add Squad** names a group of one Team's
Participants (each Participant in one Squad per Competition), then
"Entrants are: Squads" and **All Squads** make them the Entrants. Each
Squad's Placement Points go to its Team when the Bracket is finalized, and
Squads are always seeded at random. The builder's **Self-report** switch
(off by default) lets a Participant whose roster email matches their
sign-in report the result of their own Heat from "Your next Heat"
(**Report result**) while it has no result; it counts at once. The results
screen shows "Reported by <name>" on that Heat, and the Host or an
Organizer can still change any result there (which clears the line). ADR
0005 explains why this is the one Participant write.

Format behavior goes through `src/lib/bracket/formats.ts`: it dispatches
every Bracket operation (generate, record a result, finalize…) to that
Format's `FormatEngine`, defined in `engine.ts` (single elimination) or
`heats.ts`. The display helpers in `src/lib/bracket/view.ts` (Round and
Heat names, `nextHeatFor`) also branch on Format. To add a new Format:

```text
/implement Add a <name> Format to Competitions, alongside single
elimination and Heats. Add its value to COMPETITION_FORMATS in
src/lib/enums.ts and run `pnpm db:generate` for the migration (a value
added with ALTER TYPE … ADD VALUE can't be used in the same transaction,
so keep it in its own migration). Add its config schema and default in
src/lib/bracket/config.ts and its label (plus any Round/Heat naming) in
src/lib/bracket/view.ts. Write a FormatEngine (see engine.ts and heats.ts
for the shape: building the Heats from Entrants, applying a Heat Result,
and producing final placings, which points.ts and finalizeBracket turn
into Points Entries) and add its case in formats.ts. Add it to the
builder/results screens, and describe its rules under "Bracket rules" in
CONTEXT.md.
```

The engine is deliberately separate from the UI: `src/lib/bracket/` has no
React imports and never reads or writes the database itself, so a new
Format's rules are unit-testable on their own before any screen uses them.

### Rolling out R12 (migrations 0023–0026)

Migrations 0023–0026 add the Participation columns and table, the Award
Category tables and the seven seeded Categories. They are additive, so a
Vercel rollback is safe (the previous build ignores them). As for R10, check
the order each time R12 reaches staging, and again on promotion to `main`:

1. Confirm the **Migrate** GitHub job succeeded **before** checking the
   deploy. Until the new columns exist the Competition and Awards queries
   fail and those pages error.
2. If the deploy went live first, re-run the Migrate job.
3. **Tag the already-loaded Awards.** The seeds now carry an Award
   `category`, but a reload never updates an Award it already has, apart from
   one fill: an Award with no Category that was never edited in the app gets
   the seed's. So rerun the **Seed** workflow once for each past edition's
   file, `seeds/i.json` … `seeds/xi.json`, with reset **off** (never reset)
   and never for the edition being run: a reload overwrites that edition's
   setup. Then check `/history` shows "Awards through the years".

### Run the Finale

The Finale (`/<edition>/finale`) is a slideshow for the projector, not a
playback: the presenter steps through it (→, Space or a click for next, ←
back, Escape to the first slide) and nothing advances on its own. Its
slides are the built-ins (Title, By the numbers, Awards, Champions,
Standings countdown, Winner) plus any **Custom slides**. In `/admin/finale`
an Organizer sees the slide list, moves a slide (drag, or ↑/↓), hides or
shows it, adds a Custom slide (heading, rich-text body, optional background
color; its text colors adjust to read on it) and edits or deletes it, and
picks the Awards layout ("All on one slide" or "One slide per Category").
Every change saves at once. Writes are Organizer-only: a Host sees the list
but no controls. A slide with nothing to show is skipped, and with every
slide hidden the Finale says "Nothing to show yet." The rules are under
"Finale rules" in `CONTEXT.md`.

Schema: slides live in the `finale_slide` table (unique on War Week, kind and
heading, so each built-in is once per War Week and a Custom slide is unique
by heading) and the layout in `war_week.finale_awards_layout`. A seed's
optional `finaleSlides` list is synced like FAQ Items and its
`finaleAwardsLayout` is insert-only (`CONTEXT.md`, "Seed idempotence rules").
The demo seeds `seeds/demo/xi.json` and `xii.json` carry a list (the six
built-ins plus a Custom "Thank you").

The slide stills (every slide at 1920x1080 and 390x844, in its final state)
come from `pnpm build && pnpm seed:demo:xii && pnpm stills:finale`, written
to `test-results/r13/slides/`. Run it when a slide's look changes; it reports
any slide that scrolls instead of fitting the projector. Never part of CI.

### Rolling out R13 (migration 0027)

Migration 0027 adds the `finale_slide` table and `war_week.finale_awards_layout`
(with its enums). It is additive, so a Vercel rollback is safe (the previous
build ignores them). Check the order each time R13 reaches staging, and again
on promotion to `main`:

1. Confirm the **Migrate** GitHub job succeeded **before** checking the
   deploy. Every edition page reads `war_week` whole, so until the new column
   exists every edition page errors, not only the Finale.
2. If the deploy went live first, re-run the Migrate job.
3. Nothing to backfill: a War Week with no saved slides plays the default
   list, and its Awards layout defaults to "All on one slide".

### Run a Competition as Participation

For a thing people either did or didn't (Black Midnight, a daily workout,
Spirit submissions, HQ attendance). Under **Competitions**, **Add
Competition** and choose the **Format** "Participation"; you land on its
setup page, where the Host or an Organizer sets:

- **Points per Participant** (N). Individual scoring gives N to each
  Participant who took part. In team scoring choose **ranked by headcount**
  (each Team's headcount ranks its place, ties sharing the higher place, paid
  by the Competition's Placement Points) or **per person** (N × headcount to
  each Team). A Participant on no Team can't take part in a team
  Competition.
- **Self check-in** (off by default) with an optional close time: linked
  Participants then see **Check in** on the Competition page. Check out
  removes only their own check-in, never a tick you made. If you remove
  someone's check-in they can check in again while it's open; turn Self
  check-in off or set a close time to stop that.
- The took-part list: tick or untick anyone until Close.
- **Close** / **Reopen**, behind a confirm, as for Games. Teams are counted
  at Close, as they are then. The format is fixed once created. Changing
  scoring, or deleting the Competition, is refused while anyone is marked.

Who took part isn't seeded. A seed's `participation` Competition may set
`participationPoints`, `participationTeamScoring`, `selfCheckIn` and
`checkInClosesAt`, but they are applied only when the Competition is first
inserted, never on a reload. The one exception: a seed reload does set a
Participation Competition's team scoring from the seed's scoring (kept while
team, `ranked` on becoming team, none for individual).

### Manage Award Categories

On `/admin/awards` (Organizers only) the **Categories** section adds, renames,
archives and restores global Award Categories; there is no delete. An
archived one stays on its past Awards but can't be picked for another. Give an
Award a Category in the Award form's **Category** select ("None" is allowed).
`/<edition>/awards` groups by Category, and `/history` and
`/history/awards/<id>` show each Category through the years. A seed's Award
`category` is a Category's **key** (the seven seeded: `war-week-mvp`,
`billable-hours-champ`, `black-midnight`, `grow`, `grind`, `serve`,
`inspire`), never its name, so a rename doesn't break a seed.

### Run a Competition as Games

For a showdown, a best of X, or a week-long ladder of casual games — no code
needed. Under **Competitions**, tap **Add Competition** (it opens a
Sheet) and choose its **Format**: "Games". A **Game Type** select appears — Head-to-head (a
winner, or a draw when allowed), Best score (each Game records a score;
best or total, higher or lower is better) or Ranked (a finishing order,
with Finish Points per place). **A `games` Competition's Format and Game
Type are fixed once it's created**: add a new Competition to run it a
different way.

**Add Competition**, and you land on that Competition's Games setup page
(the twin of a Bracket's), where the Host or an Organizer sets:

- The Game Type's own settings (draws and Best of off/3/5/7 for
  head-to-head; count best or total, direction and a unit label for
  best-score; a Finish Points table for ranked).
- **Entrants**: open to everyone eligible, or a fixed list (pick Teams or
  Participants, as for a Bracket). A Best of needs a fixed list of exactly
  two Entrants.
- **Participants can enroll**, with an optional limit and close time (see
  [Let Participants enroll themselves](#let-participants-enroll-themselves)
  below) — off, and unavailable, once the Competition is open to everyone
  or has a Best of.
- An optional **logging close time**, after which only the Host or an
  Organizer can log, edit or delete a Game.
- **Close** / **Reopen**, behind a confirm: Close turns the leaderboard's
  places into Placement Points Entries, the same tie rule as finalizing a
  Bracket; Reopen withdraws them. A closed Competition refuses every Game
  write, even the Host's, until it's reopened.

Participants log, edit or delete Games straight from the Competition page —
there's no separate results page. A **Log a Game** card on the home page
lists every open `games` Competition the signed-in Participant may log in
right now, straight to the form. The leaderboard and Game log (newest
first, with a "Mine" filter) live on the Competition page for everyone, in
the Archive too once the War Week ends: a `games` Competition left open
when its War Week ends keeps taking Games until the Host closes it.

### Let Participants enroll themselves

The **"Participants can enroll"** switch (off by default) is on a
Bracket's builder and a fixed-list `games` Competition's settings — never
on a `points` Competition, an open-to-everyone `games` Competition, or a
Best of (the Host sets those two Entrants by hand). Turn it on, and
optionally set an Entrant limit and a close time; enrollment also closes
the moment the Bracket is built, or (for `games`) the first Game is
logged, or whenever the Host closes the Competition.

In team scoring, any Participant on a Team enters or withdraws the whole
Team. Once the Host has added any Squad to a team-scoring Bracket
("Squad: a pair or group from one Team, playing as one entrant"),
Participants join or leave a Squad instead — their own Team's, up to 16
Participants — and Team enrollment turns off. Withdrawing (or leaving a
Squad) works any time before enrollment closes; after that, only the Host
or an Organizer removes an Entrant.

### Add a field

```text
/implement Add a <name> field to <Team / Competition / …>: <what it's for>.
Update src/db/schema.ts, run pnpm db:generate and commit the drizzle/
migration, accept it in the seed format and seeds, and show it on <page>.
```

The chain is schema → `pnpm db:generate` → migration in `drizzle/` →
`pnpm db:migrate` locally → seed format and seed files → UI. Never hand-edit
a migration. The one exception is a data step that the schema diff can't
express (copying rows between tables, or inserting fixed reference rows
such as the seeded Award Categories): create it with
`pnpm db:generate --custom --name <what-it-copies>` so it gets its
own journal entry, and write only that file.

### Add or change a form control

Convert a field:

```text
/implement Convert the <field> on the <form> to shadcn's <Select / Switch /
…>, or our <EntityCombobox / DatePicker / DateRangePicker / TimeCombobox /
ColorField>, keeping the same submitted name and value, and its field
error under it.
```

Add a new control:

```text
/implement Add a <what it picks> control to src/components/ for <form>,
built from shadcn primitives. It posts <value format> under its name, is at
least 44px tall on phones, and its popup stays inside the War Week's theme.
```

Notes:

- All UI uses shadcn components (base-nova / Base UI, `components.json`) —
  never a plain `<select>`, `<input type="checkbox">`, `<input type="date">`,
  `<input type="time">`, or `<input type="color">`. Add a missing primitive
  with `pnpm dlx shadcn@latest add <name>`; don't hand-roll a control shadcn
  already has.
- A single choice among a few options (who won, which Entrant) is a
  `ToggleGroup` from `ui/toggle-group`: single-select, and kept
  non-deselectable by ignoring an empty `onValueChange` — never `Button`s
  with hand-rolled `aria-pressed`.
- The app's own wrappers — `EntityCombobox`, `DatePicker`,
  `DateRangePicker`, `TimeCombobox`, `ColorField`, and `ResponsiveSheetDialog`
  (a centered Dialog at `md`, 768px, and up; a bottom Sheet on phones below) — live in
  `src/components/`. Reach for one of those before building a new control.
  Only `EntityCombobox` does search and chips.
- Below `sm`, every admin control is at least 44px tall and wide: `min-h-11
  min-w-11`, then from `sm` back to today's size — `sm:min-h-0 sm:min-w-0`,
  or `sm:min-h-<the variant's height>` (e.g. `sm:min-h-6` for `xs`,
  `sm:min-h-7` for `sm`, `sm:min-h-9` for `default`/`lg`) so desktop is
  unchanged. `Input`, the combobox and the list-row buttons follow it. The shadcn select trigger's
  default height is now 44px below `sm` and 36px from `sm` (an edit in
  `ui/select.tsx`), so it sits level with an `Input`, and its list opens
  below the trigger rather than over the field above it.
- A bottom Sheet (`ui/sheet.tsx`) and `ResponsiveSheetDialog` dismiss any
  open toast as they open (`DismissToasts` in `ui/sonner.tsx`), so a toast
  never covers their fields.
- Admin forms save with their own Save button inside the sheet or dialog;
  the War Week settings form is the exception: it autosaves (debounced per
  field, "Saving…" / "Saved" by the heading) and has no Save button.
  Each save sends only its own fields (`updateWarWeekSettingsFields`),
  merged over the stored row, so it never writes back over a newer value;
  leaving with a refused field asks first.
- Every admin list is a column of `SetupListRow`s
  (`src/components/setup-row.tsx`): one visible Edit and one Delete per
  row, Edit in a `ResponsiveSheetDialog`, Delete in a `ConfirmDialog` with
  a toast. Reuse it for a new list instead of an inline editor or a
  whole-row button.
- Popups portal into the themed root through `ThemeRoot`, which is wired
  into `ui/popover`, `ui/select`, `ui/combobox`, `ui/alert-dialog`,
  `ui/dialog` and `ui/sheet`, so they keep the War Week's Appearance Theme.
  `ThemeRoot`'s `scheme` prop pins its subtree to one color scheme whatever
  the viewer's Display — the Settings form's two previews use it so an
  Organizer sees both the light and the dark palette rendered live, side by
  side, regardless of their own Display.
- A warning that still lets the save through uses the `--warning` token
  (`text-warning`), not a hardcoded amber — it's tuned to pass AA against
  each color scheme's background, unlike a raw Tailwind amber class. Its
  users today: Settings' contrast warnings and its flip notice (an Organizer
  override about to be cleared), the Points Entry form's Max points
  warning, and the Announcement form's hint.
- Lay out every field with `Field` / `FieldLabel htmlFor` /
  `FieldDescription` from `ui/field`, and show a form's server error in a
  `FieldError` under its buttons.
- Admin forms post through React's `useActionState` (ADR 0004;
  `src/components/points-entry-form.tsx` is the reference). The server
  action validates with the form's Zod schema and returns `fieldErrors`
  (built by `fieldErrorsFrom` in `src/lib/form-errors.ts`); the form shows
  each one in a `FieldError` under its field (`Field data-invalid`, the
  control `aria-invalid`) and moves focus to the first invalid field with
  `useFocusFirstInvalid` from `src/components/form-field-errors.tsx`. A
  message no field owns stays in the `FieldError` under the buttons.
  Validation runs on the server only; the form reads `FormData` when every
  control posts a named input, and closes over React state when a field is
  rich text or a list (Announcement, Award participants, FAQ, Schedule
  description, list-row forms). The rich-text editor
  (`src/components/rich-text-editor.tsx`) is the one place a video goes:
  an Announcement has no separate video field, and images are added by
  URL (no upload).
- Confirm anything destructive with `ConfirmDialog` or `ConfirmActionButton`
  (`src/components/confirm-dialog.tsx`), never `window.confirm`. Report
  results with `toast.success` / `toast.error` from `sonner`, never
  `window.alert`.
- Don't put a popup inside a themed root that has `overflow-hidden`: it
  would be clipped.

### Add a page

```text
/implement Add a <name> page at /<edition>/<slug> that shows <what>,
linked from <nav / More>. It needs a JG sign-in like every other page.
```

### Add an MCP tool

```text
/implement Add a read-only MCP tool <tool_name> that returns <what>.
Follow the existing tools in src/mcp/ (metadata in src/mcp/tools.ts, a
test next to it, registered in src/app/api/mcp/route.ts) and add it to the
README tool list. It must only return what a signed-in Participant sees: no
emails.
```

`/llms.txt` picks the new tool up from `src/mcp/tools.ts`. The tools today
are `get_current_war_week`, `get_leaderboard`, `get_schedule`,
`get_announcements` (a video is its URL in the plain-text body),
`get_awards`, `get_faq`, `list_history`, `get_history`, `get_bracket` (a
Competition's Bracket by name, with each Heat's time and place, and a
Squad's `participants` by name; never who reported a result) and
`get_games` (a Competition run as Games, by name: its settings, leaderboard
ranked by Game Type and its Games newest first; never an email or who
logged one) and `get_participation` (a Competition run as Participation, by
name: its settings, closed state, who took part by name and, in team
scoring, each Team's headcount; never an email or who marked anyone). `get_bracket` (`src/mcp/bracket.ts`) is the model for a tool
that looks something up by name and whitelists what it returns.

### Add or fix history

```text
/implement Update seeds/<edition>.json from old-wikis/<year>.txt: <what's
missing or wrong>.
```

Competiscore data is gone; `old-wikis/`, the live wiki pages (and the Drive
folders they link to) and what you remember are the only sources. For
Claude to read the wiki, sign in to it in the Claude Code browser first.
Leave `seeds/demo/xi.json` alone unless a test needs different demo data. Load locally with `pnpm seed:load seeds/<edition>.json`, then check
`/history` and `/<edition>`.

## Guardrails

- **Never open, cat or paste `.env*` files**, into Claude or anywhere else.
  Claude is told the same; use `.env.example` for variable names.
- **Migrations reach deployed databases only through the deploy path**
  (merge to `staging` / `main`, `migrate.yml`). Never run `pnpm db:migrate`
  against Neon by hand.
- **Never use `--reset`** on a War Week organizers are running; it deletes
  their points, Awards and Announcements. Against a non-local database it
  also needs `--allow-remote-reset`; the Seed workflow passes it after its
  own `confirm_reset` check.
- **The gate must pass** before a PR. Don't ask Claude to skip or delete a
  failing test to get there.
- **When the gate or CI fails**, paste the error into Claude: "`pnpm gate`
  fails with this; diagnose and fix it." Don't merge red.
- **When a deploy breaks production**, roll back first, fix second: in
  Vercel, Deployments → the last good production deploy → Instant Rollback.
  A rollback doesn't undo a migration, so tell Paul if the bad change had
  one.

## Getting unstuck

Ask Claude these first:

- "Read `docs/maintainers-guide.md`. How do I <thing>?"
- "Where in this repo does <feature> live?"
- "Is there an organizer screen for <thing>, or does it need a code change?"
- "`pnpm gate` fails with <paste>. Diagnose it."
- "What does <term> mean in `CONTEXT.md`?"
- "Review my branch against `staging` before I open a PR." (`/code-review`)

Still stuck, or anything touching access, secrets, Neon or a production
migration: ping **Paul Macfarlane**.

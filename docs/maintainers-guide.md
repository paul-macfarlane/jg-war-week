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
| Organizer list                             | `/admin` only opens for Organizers (and Hosts, for their Competitions and the Guide)          | Any Organizer, in-app          |
| Claude Code with the Atlas plugin          | The recommended way to make changes ([section 2](#2-set-up-claude-code))                      | You (Paul if the install fails) |

Your local `.env.local` needs the variables named in `.env.example`:
`DATABASE_URL`, `DATABASE_DRIVER`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The
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
| Organizer screens                          | `src/app/admin/` (competitions, discretionary-points, schedule, roster, settings…)  |
| Placement sheet, Score direction, Close / Reopen | `src/lib/placement/` (`score.ts`, `input.ts`), `src/lib/placement-rows.ts`, `src/mutations/placements.ts`, `src/queries/placements.ts`, `src/components/placement-sheet.tsx`, `placement-view.tsx` |
| Discretionary points                       | `src/mutations/discretionary-points.ts`, `src/queries/discretionary-points.ts`, `src/app/admin/discretionary-points/`, `src/components/discretionary-points-editor.tsx` |
| Placement Points limit and list editor     | `placementLimit` in `src/lib/competitions.ts` (the one place; Brackets 4, every other Format no limit), `src/components/placement-points-rows.tsx` |
| Server actions behind admin forms          | `src/actions/`                                                         |
| Database reads / writes                    | `src/queries/`, `src/mutations/`                                       |
| Rules with unit tests (standings, schedule, Finale, access…) | `src/lib/` (`*.test.ts` next to each file)           |
| The Bracket engine (seeding, Rounds/Matches, advancing winners, Bracket → Points Entries) | `src/lib/bracket/` (`*.test.ts` next to each file) |
| The admin Competition page (Settings on top, the Format's run area below) | `src/app/admin/competitions/[id]/page.tsx` and `run-area.tsx`, `src/components/competition-settings-form.tsx`, `src/lib/competition-page.ts`, `src/queries/competition-page.ts` |
| Which settings lock, and the per-field save | `src/lib/competition-locks.ts` (the one lock table and its one-line reasons), `src/queries/competition-locks.ts`, `src/mutations/competition-settings.ts`, `src/lib/competition-settings.ts`, `src/lib/autosave.ts` |
| The one Participant picker (avatar, name, Team; name-only search, no cap, no email in any option or payload) | `src/components/participant-picker.tsx` (on `entity-combobox.tsx`), `src/lib/participant-options.ts` (the option type and the name match, with its vitest); the Hosts picker's "Can't sign in" note in `src/lib/host-options.ts`, `getHostCandidates` in `src/queries/roster.ts` |
| How a Participant's Team shows wherever they compete or score (name beside the name, color where tight; a ring on a pictured Avatar) | `src/components/participant-mark.tsx` (`TeamTag`), `src/components/entrant-mark.tsx`, `src/components/avatar.tsx` |
| The description's plain-text to rich-text conversion for seeds | `src/lib/rich-text/from-plain-text.ts` |
| Bracket builder and results screens                | the Bracket section of `src/components/competition-settings-form.tsx` and of the run area; `src/components/bracket-builder.tsx` |
| The retired setup routes (308 to the Competition page) | `src/app/admin/competitions/[id]/{bracket,games,participation}/`, `src/app/admin/brackets/[id]/`, `src/app/admin/placements/[competitionId]/`: each a redirect page, proven by `retired-routes.test.ts` |
| Participation (scoring, Check in rule)     | `src/lib/participation/` (`score.ts`, `check-in-rule.ts`, `input.ts`), `src/mutations/participation.ts`, `src/queries/participation.ts` |
| Participation run area, and its Competition page parts | `src/components/participation-builder.tsx`, `participation-view.tsx`, `check-in-button.tsx` |
| Award presets (the names the Add Award form offers) and the name slug | `src/lib/award-names.ts` (the seven `FORMER_CATEGORY_NAMES`, `awardNameSlug`, `awardPresets`), `getAwardPresets` in `src/queries/awards.ts`, the Preset picker in `src/components/award-form.tsx` |
| An Award name through the years | `src/app/[edition]/awards/` (names link to history), `src/app/history/awards/page.tsx` (every name) and `[slug]/page.tsx` (one name), `src/queries/award-history.ts`; the list on `/history` is `src/app/history/(list)/` |
| The Competitions list's status (Not started, Underway, Closed, Done · Winner) | `src/lib/competition-status.ts` (the one rule, with `*.test.ts`; the list query only loads the facts) |
| Database schema                            | `src/db/schema.ts`                                                     |
| Migrations (generated, never hand-edited)  | `drizzle/`                                                             |
| Seed data, one file per War Week           | `seeds/i.json` … `seeds/xi.json`, the tentative upcoming `seeds/xii.json`; the live XI demo in `seeds/demo/xi.json` |
| Seed format and loader                     | `src/seed/schema.ts`, `src/seed/load.ts`                               |
| Appearance Theme → CSS                     | `src/lib/theme.ts`                                                     |
| Shared UI pieces                           | `src/components/` (shadcn primitives in `src/components/ui/`)          |
| Participant nav, tab bar, footer and theme | `src/components/war-week-chrome.tsx` (the `[edition]` layout and `/history`), `src/components/primary-nav.tsx`; the signed-in nav account is `src/auth/nav-account.ts` |
| Profiles (name, picture) and Delete my account | `src/lib/profile.ts`, `src/queries/profile-join.ts`, `src/app/[edition]/profile/`, `src/mutations/account.ts` |
| Test sign-in (staging only)                | `src/lib/test-sign-in.ts`, `src/app/sign-in/test/`, `src/actions/test-sign-in.ts` |
| Who can do what                            | `src/lib/access.ts` (`can`), `src/auth/authorize.ts`, `src/auth/actor.ts` |
| Smoke test                                 | `scripts/smoke/` (entry: `scripts/smoke/index.ts`)                     |
| Browser flows (Playwright, `pnpm e2e`)     | `e2e/`, `playwright.config.ts`                                         |
| Past wiki text for history                 | `old-wikis/2016.txt` … `old-wikis/2026.txt`                            |
| CI, deployed migrations, seeding           | `.github/workflows/` (`ci.yml`, `seed.yml`), `scripts/vercel-build.sh` |

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
   types, tests, build and smoke against its own Postgres, and a
   migration drift check that fails when `src/db/schema.ts` changed
   without a `drizzle/` migration. The Playwright flows don't run on a PR
   into `staging` (they would add about 16 minutes); run `pnpm gate`
   locally (step 4) instead.
6. **Check the Vercel preview** linked on the PR.
7. **Merge into `staging`.** Vercel's build migrates the staging database,
   then deploys; a failed migration fails the deploy.
8. **Ship to production:** open a PR from `staging` into `main`. Its CI
   is the only one that runs the Playwright flows; if they fail, fix it on
   a branch into `staging` first. Merge it once green.
   Production migrates and deploys. Check https://jg-war-week.vercel.app.

## Recipes

Each has a prompt you can paste into Claude. Replace the `<…>` parts.

### Change copy or text

```text
/implement Change "<old text>" to "<new text>" on the <page> page.
```

Words must follow `CONTEXT.md`. If Claude refuses a word, that's why.

**The banned-term scan.** `src/lib/banned-terms.test.ts` (run by `pnpm test`)
reads the string literals, template text and JSX text of every non-test
`.ts`/`.tsx` file under `src/`, so UI copy can't carry a
banned word: **Heat** (say Match), **Champion** (Winner), **Finalize** and
**Un-finalize** (Close, Closed, Reopen), **Game** (Match for a Bracket or
Head-to-head or League, Attempt for Best score), plus Event, Member, ELO,
Placeholder, Tournament, News and "admin" for a person. Other identifiers and
comments aren't scanned, nor are `scripts/` and `drizzle/`. **Match** and **League**
are no longer banned (League is a Format; League copy says chess, never
"tournament" or "Elo", which stay banned). The `ALLOWLIST` at the top of the test (one
file, one term, the exact literal, a reason) holds only the two Team score
labels, **"Best member"** and **"Sum of members"** in
`src/lib/best-score/config.ts`, allowed despite the banned **Member**; Heat,
Game and Finalize have no exceptions in code. Add an entry only for a
literal the spec itself names. A failing scan names the file, the term and
the word to use instead.

A change people can see also updates `/about` in the same PR: its copy
(`src/app/about/page.tsx`, `src/lib/about.ts`: the "What it does" features, one per row with its still beside its caption
(below it on a phone), copy that reads the same for Teams and free-for-all) and, when a feature card's
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
through the slideshow with → to the Standings countdown as a check) wears
the old edition's theme, so it must be re-recorded too. Use `--stills` only
when the poster's edition is unchanged (`pnpm tsx scripts/about-media.ts
--stills` rewrites the feature-card and Standings stills and leaves the
poster alone). The page has no Standings demo and no hero stills: its
only media are the feature stills and the Finale poster.

Every About still comes in light and dark: the script writes `<name>.png`
under the light Display and `<name>-dark.png` under the dark one, and
`/about` shows the pair member matching the viewer's Display (`AboutStill`,
`data-still-scheme` in `globals.css`). Each "What it does" feature also has a
phone set, `<slug>-phone.png` and `<slug>-phone-dark.png` (390 wide, 640 tall,
2x, the same screen as the desktop still), so it reads at 390: `/about`
shows the phone set below `md` and the desktop set from `md` up
(`data-still-size`). The same `pnpm tsx scripts/about-media.ts` run writes
all of them (30 files in `public/about/`: 7 features x 4, plus the poster
pair). Run it against a fresh build and a server it starts itself, so it
serves the new files. When a run writes a still that wasn't in `public/about/` before
(a new feature, or the first phone set), its server can't serve it yet and the
evidence step fails with "images failed to load": run the script a second time.
Never add or replace only one of a pair.

### Run a new War Week or change this year's theme (no code first)

Organizer screens cover it. Sign in and go to `/admin` (it opens on
Competitions). The admin is one flat nav: **Competitions, Discretionary
points, Schedule, Roster, Announcements, Awards, FAQ, Finale, Settings,
Organizers, Guide**.
There is no Overview and no Setup hub; the old `/admin/setup/...` URLs
redirect to their new homes.

- **`/admin/settings`**: War Week settings (Story Theme, dates, mode, Team
  Label, Leader Title, links, Winner and highlights, editable directly for
  corrections; a free-for-all hides Team Label, Leader Title and the
  Roster's Team controls, and keeps their saved values for if you switch
  back to Teams), the Appearance Theme (colors, font, logo, banner), the
  **Lifecycle** box (Start, End with the computed Winner and highlights,
  Unstart while nothing is scored and it has never been ended, Reopen, and
  **Create next War Week**, which shows only on the latest War Week by start
  date once it is complete). The seed-overwrite warning shows here. **The
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
  page. **`/admin/roster`**: Teams and Participants, with Add Participant and an
  Organizer-only Import (paste from Google Sheets or upload a CSV, preview,
  then Import) at the top, and a search box that filters the list by name or
  email ("N of M").
  **`/admin/competitions`**: Competitions, with their Hosts (a Host sees only
  the ones they host). A row's **Edit**
  opens the Competition's own page (see [Run a Competition from its
  page](#run-a-competition-from-its-page)).
- **On a phone**, the admin sections are a bar fixed to the bottom of the
  screen (labelled Competitions, Points, Schedule, News, More, in Inter whatever the
  font preset; the accessible names, the side column and the More Sheet keep
  "Discretionary points" and "Announcements"); More opens a
  Sheet with the other sections you can see and the edition switcher.
  Display, the way back to the War Week, Slack and Sign out are in the
  avatar account menu in the header. From `md` up it is the side column and
  header. The sections live in `src/lib/admin-sections.ts`.
- **Every admin list row has a visible Edit and Delete button.** The row is
  `SetupListRow` in `src/components/setup-row.tsx`: Edit opens the form in a
  `ResponsiveSheetDialog` (a Sheet on phones, a Dialog from 768px) and
  Delete opens a `ConfirmDialog` and ends in a toast. The Add button sits
  below the list. Competitions' Edit opens the Competition's page (Add
  creates it in a sheet, then opens the page); Days, Schedule Items, Teams,
  Participants, FAQ, Awards, Announcements and Organizers all use it. A record
  is created and edited in the same dialog (`SetupSheet` /
  `ResponsiveSheetDialog`, a full-height sheet on phones); only a thing you
  run gets a page, which today is a Competition (created in a dialog, then
  run on its page). There are no `/new` or `/[id]` pages for Schedule, FAQ,
  Awards or Announcements (the last answers 404). A Team's row reads "Edit <Team Label> <name>". The Hosts field is
  in the Competition page's Settings and saves as you pick.
- **You comes from the roster email only.** A signed-in person is "You" (the
  highlight, Log a Match or Attempt, reporting a Match) only when their email matches a
  Participant's roster email; there is no "Which one is you?" pick. A
  Participant row without an email shows "No email: won't be linked when they
  sign in" on Roster.
- **`/admin/organizers`**: the Organizer list (see
  [Add an Organizer or assign Hosts](#add-an-organizer-or-assign-hosts)).
- **`/admin/discretionary-points`** (Organizers only: give, edit or delete points with no Competition, each with a required reason; the old `/admin/points` redirects here), **`/admin/finale`** (Run the Finale: the slide list, "Open Finale" at closing ceremonies),
  **`/admin/announcements`**, **`/admin/awards`**.

To start next year's edition in the app:

1. When XI is over, open `/admin/settings` on XI and press **End War Week**: the dialog shows the Winner it will record —
   whoever is first in the Standings, "Tie: A & B" when two or more Teams
   or Participants tie for first, blank when nobody scored — and lets you
   add any highlights. There is no way to type a different Winner. XI moves
   to the Archive. The confirm also names any Bracket that isn't closed
   and any open Head-to-head or Best score Competition with Matches or Attempts, or `participation` Competition
   with anyone marked, each linked to its Competition page. Close them first so their placings
   count; it warns, it doesn't stop you.
2. With XI ended and the latest War Week, its Lifecycle box shows **Create
   next War Week** (only then: not while the latest is upcoming or live, and
   not on an older War Week). The edition, number and year are prefilled
   (XII, 12, next year); add the dates and Story Theme. It copies nothing:
   default settings, no Competitions, no FAQ, no Teams or roster. It starts
   `upcoming`, and the admin switches to it so you can set it up.
3. Press **Start War Week** on XII. `/` and `/admin` now go to
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
- **Assign Hosts**: the Hosts field in the Settings of each Competition's
  page (`/admin/competitions`, Edit), saved as you pick (Organizers only).
  A Host is a **Participant on that War Week's roster**: search the roster by
  name (no email is shown). A Participant with no email can be picked; one
  whose email isn't `@jahnelgroup.com` can be picked too and is marked "Can't
  sign in". A Host gets access when they sign in with the email on their
  roster entry, so add it in Roster if they have none; the email is matched
  on each request, so changing a Participant's roster email moves their Host
  access to whoever owns the new one. A Host gets the Admin link and sees
  only the Competitions they host and the Guide: each Competition's page
  (its Placements, Bracket, Matches and Attempts, settings; the Hosts shown
  by name only, no emails). Schedule, Announcements and the Finale are
  Organizer-only, and the server refuses a Host there. Remove the Participant
  from the Hosts field to take access away; it applies on their next request.
  A Schedule Item's "host" text is only what the schedule shows; it doesn't
  make anyone a Host.
- **A fresh database** gets its first Organizers from a seed's `organizers`
  list: a seed load adds any that are missing and never removes one, even
  with `--reset`. After that, manage them in the app. Hosts never come from
  the seeds unless a seed Competition lists them (`hosts`: Participant display
  names from that seed's roster, refused otherwise); a plain reload keeps any
  Host an Organizer added, and `--reset` deletes them along with the War
  Week's Competitions.
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
  - **Host:** give the alias to a roster Participant's email, then pick that
    Participant in a Competition's Hosts field (`/admin/competitions`); no
    other email is shown there.
  - **Organizer:** "inviting" is just adding the alias at
    `/admin/organizers`.
- **Every page shows a "Test sign-in: <email>" banner** while you are in a
  test session.
- **Turn it off.** Remove `TEST_SIGN_IN_SECRET` and redeploy: every test
  session counts as anonymous (pages and the proxy) while it stays
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

### See the app at scale (100 Participants)

```bash
pnpm seed:demo:scale
```

It loads every seed plus the XII scale demo (`seeds/demo/xii-scale.json`:
100 made-up Participants, free-for-all, with a Closed 100-row Placement),
then runs the fixture (`src/seed/scale.ts`) through the app's own
mutations for what the seed format can't hold: Hosts, a 64-Entrant Bracket
with 20 Round 1 results, Participation ticks, Head-to-head Matches and Best score
Attempts. For Teams at scale, the normal XI demo already has 101 Participants. It refuses
a database that is not local. Open `/xii`, its leaderboard and Competitions,
the roster, a Placement sheet and the Bracket tree. Afterwards
`pnpm seed:demo` puts the normal demo back.

Deployed migrations now run in Vercel's build (`scripts/vercel-build.sh`),
before the build and so before the deploy; `migrate.yml` is gone. In the
rollout notes below, read "`migrate.yml`'s run is green" as "the Vercel
deployment of that push is Ready".

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

### Run a Competition from its page

Every Competition has one admin page, **`/admin/competitions/<id>`**: the
Competitions list's **Edit** opens it, and **Add Competition** creates the
Competition in a sheet, then opens it. Organizers use it for any Competition
and a Host for their own; anyone else, and a Host opening another
Competition's page, sees "Organizers and Hosts only."

- **Settings** are on top and **autosave per field**: change a field and it
  saves ("Saved" by the Settings heading, no toast; a refusal shows under
  the field). Name, a rich-text
  **description** (the Announcement editor: headings, lists, links, images by
  URL, no upload), Group, **Hosts**, Format, scoring, Placement Points and the
  Format's own settings are all here.
- **Hosts** are picked from the roster by name, never showing an email. A
  Participant with no email, or one that isn't `@jahnelgroup.com`, can be
  picked (the latter is marked "Can't sign in"); a Host with no email gets
  access once you add one in Roster. A Host sees the Hosts read-only, by
  name, and no emails.
- **Bracket admin** folds the Squads, Entrants and Seed Positions into one
  closed "Entrants and Seed Positions (N)" collapsible once a Match has a
  result (the lock reason stays visible); there is no Round 1 preview. The
  Participant tree uses the full width from `md` up, and an Entrant gets a
  "Jump to your Match" button (`currentMatchFor`).
- **The run area** is below: Record placements (Placement), Entrants and
  Bracket tree (Bracket), Entrants and Matches with **Log a Match** (Head-to-head), Entrants and Attempts with **Log an Attempt** (Best score, Edit and Delete in each person's expanded row), or Who took part
  (Participation), with Close and Reopen. Every Format uses the same two words: **Close** writes the points, **Reopen** withdraws them.
- **Locks** (one table, `src/lib/competition-locks.ts`;
  the page disables a
  locked field with a one-line reason and the server refuses the same change
  with the same words). They come only from play having started or the
  Competition being Closed; there are no scheduled closing times:
  - Never lock: name, description, Group, Hosts, Placement Points (and points
    per Participant), and the **Score unit** (a label). A points change while
    the Competition is Closed applies at the next Close.
  - Lock once any result exists (an Entrant is one): Format, scoring, counts
    toward team. **Score direction** locks per Format once play has started
    there (a Placement row, a Match or Attempt, a Bracket Match result).
  - Lock once the Competition has a Match or Attempt: a Head-to-head
    Competition's draws and Best of, and a Best score Competition's Team score
    ("Locked once the Competition has a Match or Attempt."). A Best of needs
    its two Entrants first, so Entrants alone don't lock it.
  - Lock once a Match result exists: the Bracket kind, Entrants per Match, how
    many advance, the 3rd place match, the Entrants, building the Bracket.
  - Lock only while Closed: self-enroll, Entrant limit, self-report, check-in
    and a Best score Competition's **Max attempts** (which also can't go below
    the most Attempts any one person already has).
  - While Closed everything but the never-locking row is locked
    until you Reopen it. There is no Reset bracket: to start a played Competition
    over, add a new one.
- **Score direction and unit** (none, higher or lower is better, plus an
  optional unit label of up to 20 characters) are in the Settings of
  Placement, Bracket, Head-to-head and Best score (Best score: higher or lower
  only; Participation has neither). With a direction, Places and Winners
  follow the Scores (a Placement's Places, a Group or Head-to-head Match's
  places or Winner), the Score column reads "Score (sec)", and anything you
  set against the Scores shows "set by hand". One module computes it:
  `src/lib/scoring.ts`.
- **Self-report** ("Participants can log their own results") is one
  switch, off by default, on Bracket, Head-to-head and Best score and never on
  Placement (ADR 0011). See the Format sections below for what it allows.
- **Description is rich text.** It shows in full on the Participant
  Competition page. Migration `0030` reset every existing description (see
  "How R18 reached staging and production"), and the seeds restore them: a
  plain-text seed description loads as paragraphs, one per line.
- The old setup pages (`/admin/competitions/<id>/bracket`, `/games`,
  `/participation`, `/admin/brackets/<id>`, `/admin/placements/<id>`) answer
  **308** to the Competition page, so old links and bookmarks still work.

### Run a tournament as a Bracket

Organizer screens cover setting one up and running it. Under
**Competitions**, tap **Add Competition** (it opens a Sheet) and choose its
**Format**: "Bracket" ("A tournament: Entrants play Matches, Round after
Round, to a final."). **Add Competition**, and you land on that
Competition's page, whose Bracket section holds the setup. There, choose the
**Bracket kind** with the toggle: **Head-to-head** (2 per Match, 1 advancing,
a straight 1v1 knockout, and what a new Bracket starts as; it alone has a 3rd
place match) or **Group** (3 to 8 **Entrants per Match** and **how many
advance** from each Match); pick Entrants
(all Teams, or specific Participants) and Generate; then record each Match's
result and Close to write its placings as Points Entries (Placement
Points up to 4 places for a Bracket). No code needed for any of that. While
a Bracket is closed, its settings lock except the name, description,
Group, Hosts and Placement Points ("Locked while the Competition is
Closed. Reopen it first."). The Format can change, on the same
page, until the Competition has a result. There is no Reset bracket: once a
Match has a result the Bracket kind, sizes, 3rd place match, Entrants and
building the Bracket are locked, and a mistake means a new Competition.
(Fixing a result is different: see Edit a result below.)

A Head-to-head Bracket with at least 4 Entrants can have an optional **3rd
place match**, a switch in the Bracket settings (off by default): the two
semifinal losers play it beside the final, and it decides 3rd and 4th. It is
locked once any Match result exists, like the Match size. Without it, only 1st and 2nd
are placed: Close gives Placement Points to 1st and 2nd only, and the
semifinal losers get none and aren't shown. Places come only from the final (and the
3rd place match), so a Bracket's Placement Points stop at 4 places; the
winner is always the final's winner.

One **Bracket tree** serves everyone. It's what a Participant sees on the
Competition page and what an Organizer or Host sees in the Competition page's Bracket
section: a head-to-head
Bracket shows its Rounds left to right joined by lines, a larger Match size
one box per Match with the advancers highlighted. There is no list view. On a
phone the tree scrolls sideways inside its own region, one Round after
another, while the page itself stays put. Results fill in live as they're
recorded. To record a Match, tap **Record result** on it in the tree (an
outline **Edit** once it's recorded) from the admin page or, where the
Competition allows self-report, from your own Match on the public tree: a
dialog centered on a screen, a bottom sheet on a phone. Hosts can do it for
their own Competitions. A Match has no time or place and isn't on the
schedule; a played Match shows "Recorded <time>", when its result was
saved. A Bracket has no Finale of its own; the War Week Finale
(`/<edition>/finale`) is the only one. The rules are under "Bracket rules" and "Finale rules" in
`CONTEXT.md`.

A Head-to-head Bracket is a straight 1v1 knockout. A Group Bracket plays
several Entrants at once, and Organizers tap the whole finishing order
instead of just a winner once a Match holds more than two. With a Score
direction set and every Entrant's Score typed, the places follow the Scores
(equal Scores need your pick, shown as "set by hand").

**Edit a Group Bracket.** After **Generate**, in the tree (until a Round has a
result): set one Match's **advancing** count, **move an Entrant** to another
Match of the same Round (sizes follow), or change a Round's defaults with
**Edit <Round> settings**. Every edit re-projects the later Rounds from the
summed advancers. A Match before the Final with no more Entrants than advance
is a **bye** (never the Final). A setting that would send on as many as it
received is refused. A Round with any result is **locked**.

**Edit a result.** Only the latest result along a path changes. A Match whose
result a later Match already used shows **Edit** and **Clear result**
disabled with "A later Match already used this result. Change that Match
first." (visible text, so it shows on a phone); the server refuses it too.
Clear back from the latest result. In a Group Bracket a Match is editable
only while no later Round has a result; otherwise Edit and Clear result are
disabled with "A later round already has a result. Change that round
first." Editing a finished Round's result while the next Round has no result
is allowed; the next Round re-fills from the new advancers and anything you
moved or set there is lost.

A team Competition can enter **Squads** instead of whole Teams: in the
Bracket section's Squads, **Add Squad** names a group of one Team's
Participants (each Participant in one Squad per Competition), then
"Entrants are: Squads" and **All Squads** make them the Entrants. Each
Squad's Placement Points go to its Team when the Bracket is closed, and
Squads are always seeded at random. The **Participants can log their own
results** switch in the Settings (off by default) lets a Participant whose
roster email matches their sign-in report the result of their own Match from
"Your next Match" (**Report result**); it counts at once, and the Match's
players may edit it while the Competition is open. The results screen shows
"Reported by <name>" on that Match, and the Host or an Organizer can still
change any result there (which clears the line). ADR 0005 and ADR 0011
explain the rule.

(Placement, Head-to-head, Best score and Participation have their own engines under `src/lib/placement/`, `src/lib/series/`, `src/lib/best-score/` and `src/lib/participation/`.)

Bracket behavior goes through `src/lib/bracket/formats.ts`, the one place
that picks an engine from the Bracket's config (its `kind`): Head-to-head runs
the knockout engine in `engine.ts`, Group the flexible multi-Entrant engine in
`groups.ts` (per-Round defaults, per-Match size and advancing, byes, Round
lock). Both are
a `FormatEngine` (building the Matches from Entrants, applying a Match result,
and producing final placings, which points.ts and closeBracket turn into
Points Entries). The display helpers in `src/lib/bracket/view.ts` (Round and
Match names, `nextMatchFor`) also branch on config. Bracket is one Format; to
change how a Bracket plays, change its config or an engine, and describe the
rules under "Bracket rules" in `CONTEXT.md`.

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
slides are the built-ins (Title, By the numbers, Awards, Winners,
Standings countdown, Winner) plus any **Custom slides**. In `/admin/finale`
an Organizer sees the slide list, moves a slide (drag, or ↑/↓), hides or
shows it, and adds a Custom slide (heading, rich-text body, optional
background color; its text colors adjust to read on it) and edits or deletes
it. The Awards slide always reveals one Award per step; there is no layout
setting. Every change saves at once. Only Organizers can open it: a Host can't open
`/admin/finale`. A slide with nothing to show is skipped, and with every
slide hidden the Finale says "Nothing to show yet." The rules are under
"Finale rules" in `CONTEXT.md`. The Standings countdown covers only the
rows ranked 10th or better (ties at 10th included), then says "…and N more
Participants scored" (Teams in a teams War Week); the leaderboard lists
everyone (`finaleTopRows` in `src/lib/finale.ts`).

Schema: slides live in the `finale_slide` table (unique on War Week, kind and
heading, so each built-in is once per War Week and a Custom slide is unique
by heading). A seed's optional `finaleSlides` list is synced like FAQ Items
(`CONTEXT.md`, "Seed idempotence rules").
The demo seeds `seeds/demo/xi.json` and `xii.json` carry a list (the six
built-ins plus a Custom "Thank you").

The slide stills (every slide at 1920x1080 and 390x844, in its final state)
come from `pnpm build && pnpm seed:demo:xii && pnpm stills:finale`, written
to `test-results/finale-stills/` (`--out <dir>` picks another folder, which
it empties first). Run it when a slide's look changes; it reports any slide
that scrolls instead of fitting the projector. Never part of CI.

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
page, where the Host or an Organizer sets:

- **Points per Participant** (N), for individual scoring only: N to each
  Participant who took part. **Team scoring** ranks the Teams by headcount
  (ties sharing the higher place) and pays each place its Placement Points
  (default 3, 2, 1; shown only for team scoring). There is no per-person
  team mode. A Participant on no Team can't take part in a team
  Competition.
- **Self check-in** (off by default): linked
  Participants then see **Check in** on the Competition page until it is
  Closed. Check out
  removes only their own check-in, never a tick you made. If you remove
  someone's check-in they can check in again while it's open; turn Self
  check-in off to stop that.
- The took-part list: tick or untick anyone until Close.
- **Close** / **Reopen**, behind a confirm, as for a Head-to-head or Best score Competition. Teams are counted
  at Close, as they are then. The Format can change, and so can the scoring,
  until anyone is marked ("Locked once the Competition has a result."); a
  Competition with anyone marked can't be deleted.

Who took part isn't seeded. A seed's `participation` Competition may set
`participationPoints` (individual only) and `selfCheckIn`, but they are applied only when the Competition is first
inserted, never on a reload.

### Manage Awards

On `/admin/awards` (Organizers only) **Add Award** opens the form. Its
**Preset** picker offers every Award name already used in any War Week plus
the seven that used to be Categories (War Week MVP, Billable Hours Champ,
Black Midnight, Grow, Grind, Serve, Inspire); picking one fills the name and
its most recent description, and both stay editable. A brand-new name works
too. There are no Categories: the same name, ignoring case and punctuation, is what
ties an Award together across years. `/<edition>/awards` lists the Awards,
each name linking to `/history/awards/<slug>`, which shows that name by War
Week, newest first (case and punctuation don't split a name). `/history` and
`/history/awards` list every name. To make a historic Award group with
another year's, spell it the same in its seed; the wikis' differing spellings
were aligned once (the rename table is in `CONTEXT.md`, "Award preset and
history rules").

### Record a Placement (the default Format)

For one result that is decided once: a trivia night, a step challenge, HQ
attendance. Under **Competitions**, **Add Competition** (the Format starts
as **Placement**), then open its page (Edit on its row): **Record placements**
is its run area, below the Settings. Organizers and the Competition's Hosts can use it; a Participant only sees
the result.

- **Add rows** by search (a Team Competition takes
  Teams, an individual one Participants). Adding and removing
  save at once. There is no Add everyone. Give each row a **Place** and, if you have one, a **Score**;
  Place and Score edits and the **Score direction** save with the one Save
  button.
- **Score direction** (none, higher wins, lower wins) and **Score unit** are in the page's
  Settings; the direction locks once any row exists, the unit never. With a direction, Places fill in from the Scores as you type and
  stay editable, for ties and judgement. Ties share a Place (1, 1, 3).
- **Close** (behind a confirm) turns Places into points through the
  Competition's Placement Points: tied rows each get that place's full
  points, rows with no Place and Places beyond the list earn nothing. It
  refuses a row with a Score but no Place ("Give every row with a Score a
  Place, or clear its Score."), naming the rows, and a sheet with nobody
  placed, and it is disabled while edits are unsaved. **Reopen** withdraws
  the points; rows can't change while Closed.
- Changing the Format or scoring is refused once rows exist ("Locked once
  the Competition has a result.").
- A Closed Placement shows in the Standings, Recent results and the
  Finale's Winners. The Participant's Competition page shows the
  Placements as a results table (see "Read a results table" below).

### Set Placement Points

Each Competition's Placement Points are an open list, highest first, never
increasing, each 0 or more, in the Competition page's Settings, where it saves as you edit. Add a place, remove any
place; there is no quick fill, and the list is usable at 20 or more
places on a phone. A Competition's top prize is its 1st place. The only
limit is a Bracket's 5 places, set by `placementLimit` in
`src/lib/competitions.ts` (the one place the rule lives; 4 since Epic R17).
Placement Points never lock: changed while the Competition is Closed,
they apply at the next Close.

### Give Discretionary points

Points that belong to no Competition (War Week XI's "Subjective Points"):
**Discretionary points** in the Admin nav, Organizers only (a Host sees the
refusal page). **Give Discretionary points** takes a Team or Participant, a
number of points and a required reason. A Participant's points count for
them and toward their Team. Edit (target, points, reason) keeps who entered
it and marks it edited; Delete asks first. They show in the Standings, in a
Team's "where points came from" as "Discretionary: <reason>", Recent results
and the Finale totals. Points a Competition generates are never edited
here; Reopen the Competition instead. The old `/admin/points` URL
redirects. ADR 0010 explains who may do what.

### Read a results table

Every ranked view on a Participant Competition page is one component
(`ResultsTable`, built on the shadcn `Table`), so they all read alike:

- **Columns:** Rank, Participant or Team, Score (with its unit, left out when
  no row has a Score) and War Week points. Click or tap any header to
  sort it (ascending, then descending); it opens sorted by Rank. Cells hold
  values only. At 390px the points fold under the name; nothing is dropped.
- **Winner:** the first place (every tied first place) carries a mark and
  the word "Winner". No Winner is marked when nothing decides first place
  (no points and no Score, or every row tied).
- **Provisional points:** while a Competition isn't Closed, the points
  header shows a "Provisional" badge; focus it, hover it or tap it for
  "Points become final when the Competition is Closed." Close removes the
  badge, and the points are then the generated Points Entries. The numbers
  come from the same rule Close uses, so Close doesn't change them.
- **Top finishers:** the block above the table (or the Bracket) lists every
  place the Competition decides, each with its points, 1st as Winner. A
  Bracket shows 1st and 2nd from the final, plus 3rd and 4th only with a 3rd
  place match; without one only 1st and 2nd are placed (Close gives
  Placement Points to 1st and 2nd only; semifinal losers get none and
  aren't shown). A Group
  final shows the final Match's order.
- **Best score:** one row per person (or Team), from their best Attempt, so
  nobody holds two places. "2 more attempts" under a row expands (keyboard
  too) to the others. In team scoring a Team's row is its **Team score**:
  **Best member** (its best single Attempt) or **Sum of members** (each
  person's best added up). A Host, an Organizer or (self-report on) the person
  edits or deletes an Attempt there. There is no separate list of Attempts.
- **Head-to-head:** always two Entrants, so no leaderboard; the series view shows
  the Matches in order with both Scores and the Winner (or Draw), the series
  score ("2–1") and its Winner once decided, and each Entrant's Placement
  Points (Provisional until Closed). A drawn series (every Match played
  with no majority) says so and names no series Winner.
- **Order and links:** the page reads back link, name and facts,
  **description** (long ones collapse behind "Show more"), enroll button,
  then the results. It has no Points Entries list; points are in the table.
  Organizers and that Competition's Hosts see a **Manage** button to the
  Competition's admin page, which the server decides with the same rules as
  the admin page itself; from a past edition's Competition page it still
  lands on that Competition's admin page, whichever War Week `/admin` shows.
  In a free-for-all War Week the Individual/Team choice and the
  "Individual" label are hidden on the Participant Competition page and
  list, the admin New Competition form, the admin Competitions list and the
  Competition page's Settings.
- The same table is the Standings on `/<edition>/leaderboard`, with each
  row's points breakdown in an expandable row.

### Run a Competition as Head-to-head or Best score

For a showdown, a best of X, or a week-long ladder of casual play — no code
needed. Under **Competitions**, tap **Add Competition** (it opens a
Sheet) and choose its **Format**: **Head-to-head** (a series between two
Entrants: a winner, or a draw when allowed) or **Best score** (each Attempt
records a score; higher or lower is better). **The Format can change until the
Competition has a result** (a Match, an Attempt or an Entrant); after that, add a new
Competition to run it a different way. (One logged
play is a **Match** in Head-to-head and an **Attempt** in Best score.)

**Add Competition**, and you land on that Competition's page, where the Host
or an Organizer sets, in the Settings:

- **Head-to-head:** pick its **two Entrants** (Teams or Participants; always
  exactly two, no enrollment), whether **draws** are allowed and the **Best
  of** 1, 3, 5 or 7 (a new one is Best of 3). Draws and Best of lock once a
  Match exists. Log a Match shows the two Entrants as two fixed rows, with no
  player picker. The series is decided when one Entrant has a majority of the
  wins; then **Log a Match** is disabled with the reason and the server
  refuses a further Match, for Organizers and Hosts too. Editing or deleting a
  Match recomputes it. With draws allowed a series can end drawn: every Match
  played with no majority (win, Draw, Draw is drawn though the wins are
  1–0). A drawn series has no Winner and both Entrants share the higher
  place's full points at Close. **Close waits for a finished series**: it is
  disabled, and the server refuses it, until the series is decided or drawn
  ("Finish the series before closing."). Close used to be allowed on an
  undecided series; it no longer is.
- **Best score:** **Score direction** (higher or lower), **Score unit**,
  **Max attempts per person** (blank for unlimited; the form shows "N attempts
  left", and at 1 the button reads "Update your score" and edits the one
  Attempt) and, in team scoring, **Team score** (Best member or Sum of
  members). There is no Entrant list and no enrollment: any eligible
  Participant (or Team member) logs. A Participant on no Team can't log into a
  team Best score Competition.
- **Score direction and unit** on a Head-to-head Competition make the
  higher or lower Score win each Match (equal Scores are a Draw when allowed,
  otherwise you pick, shown as "set by hand").
- Points for the places come from the Competition's Placement Points, set in
  the same Settings. Each field saves as you change it and shows the saved
  value when you return; the reason shows under a locked one.
- **Participants can log their own results** (off by default): with it on, a
  linked Participant logs a Head-to-head Match as one of the two Entrants (or
  on an Entrant Team) and a Best score Attempt as themselves. With it off,
  only you and the Organizers log. Either way, anyone who could have logged a
  result may edit or delete it while the Competition is open (ADR 0011).
- **Close** / **Reopen**, behind a confirm: Close turns the places into
  Points Entries ("From head-to-head" or "From best score"), the same tie
  rule as closing a Bracket; Reopen withdraws them. A Closed Competition
  refuses every Match and Attempt write, even the Host's, until it's reopened.
  Nothing closes on a timer.

Participants log, edit or delete Matches and Attempts straight from the Competition page (when
self-report is on); a Host or Organizer also does it from the admin page's
run area (**Log a Match** or **Log an Attempt**, Edit, Delete), with the same
rules. A **Log a Match** or **Log an Attempt** card on the home page
lists every open Head-to-head or Best score Competition the signed-in Participant may log in
right now, straight to the form. What the page shows is under "Read a results table" above, for everyone, in
the Archive too once the War Week ends: a Competition left open
when its War Week ends keeps taking results until the Host closes it.

### Run a Competition as a League

For a chess night, run it as a **League**: Entrants play each other one Match
at a time, for match points (win 1, draw ½, loss 0). Under **Competitions**,
**Add Competition**, choose the Format **League**, and you land on its page.
In the Settings:

- **Pairing:** **Round robin** (everyone plays everyone once; the default) or
  **Swiss** (a set number of **rounds**, paired one at a time). Rounds, for
  Swiss only: 1 to N−1 for N Entrants, blank for the default ⌈log₂ N⌉ (3 for
  6 Entrants).
- **Score direction** and **Score unit** (optional): with a direction, the
  better Score wins and equal Scores are a draw; with none, the recorder picks
  A won, Draw or B won.
- **Participants can log their own results** and **Participants can enroll**
  (both off by default), and the Entrant limit.
- Pairing, rounds, Score direction and the Entrants lock once round 1 is
  paired ("Locked once round 1 is paired."). Score unit never locks, and
  self-report and enrollment lock only while Closed.

Then in the run area:

1. **Entrants.** Add Teams or Participants (by the scoring) with the
   Participant picker, or let Participants enroll. There are no Squads.
2. **Pair.** Round robin: **Pair rounds** makes every round at once (the
   circle method; with an odd number, one Entrant sits out each round, worth
   0). Swiss: **Pair round 1**, then **Pair next round** once every Match of
   the round has a result (it groups by match points, never repeats a Match,
   and gives an odd Entrant the bye, worth 1, to the lowest-ranked Entrant
   without one). Round 1 uses a random Seed Position order.
3. **Edit pairings** (per round) swaps two Entrants, either may be the bye or
   sit-out, until a Match in that round has a result (a round robin: until
   either affected Match does). The dialog **warns before saving** if the
   swap repeats a pairing, in a round robin names the pairs that will then
   never meet, and in Swiss names an Entrant who would have a second bye. It
   is a warning, not a refusal.
4. **Clear pairings** deletes every Match while none has a result, which
   unlocks the settings and Entrants again, so a wrong Entrant list can be
   fixed before play.
5. **Record result** on each Match opens a dialog at 1440 and a bottom sheet
   at 390: Scores and A won / Draw / B won (filled in and disabled when the
   Scores decide it). Edit and Clear result follow. With self-report on, a
   player in the Match (or on their Team) records it from the Participant
   page and the other player can edit it; with it off, only you and the
   Organizers record. A bye or sit-out never has a result. Corrections after
   the next Swiss round is paired are allowed; pairings already made stand.
6. **Close** only when the League is finished: every round paired (Swiss: all
   N rounds) and every Match recorded. A Swiss League is also finished when
   every played round is complete and no next round can be paired without a
   repeat Match: Pair next round then reads "Every pairing would repeat a
   Match. Close the League." and Close is open. Until then Close is disabled
   with "Finish every Match before closing." naming the unplayed Matches and
   rounds not yet paired, and the server refuses it. A League needs at least
   2 Entrants to Close. Close writes Placement Points by final standing
   ("From league"); **Reopen** withdraws them.

The Participant page shows Top finishers once Closed, the results table (Rank,
name, W, D, L, Match points, then **H2H** and **SB** in a round robin or
**Buchholz** in Swiss, and War Week points, Provisional until Closed), **Your
next Match** and the rounds. Ties break by head-to-head among the tied then
Sonneborn-Berger (round robin) or Buchholz (Swiss); still level, the place is
shared with full points. The XII demo has **Chess Round Robin** (finished and
Closed) and **Chess Swiss** (round 3 under way).

### Let Participants enroll themselves

The **"Participants can enroll"** switch (off by default) is on a
**Bracket's** or **League's** Settings only — never on a Placement,
Head-to-head, Best score or Participation Competition. Turn it on, and
optionally set an Entrant limit; enrollment closes
the moment the Bracket is built (or a League's round 1 is paired), when the limit is reached, or whenever the
Host closes the Competition. There is no close time.

In team scoring, any Participant on a Team enters or withdraws the whole
Team. Once the Host has added any Squad to a team-scoring Bracket
("Squad: a pair or group from one Team, playing as one entrant"),
Participants join or leave a Squad instead — their own Team's, up to 16
Participants — and Team enrollment turns off. A League has no Squads: a
Participant or Team enters itself. Withdrawing (or leaving a
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
such as inserting fixed reference rows): create it with
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
- **Button variants.** A page's primary action is a solid `default`
  Button (Add …, Record result, Save); secondary actions are `outline`
  (Edit, Cancel); `ghost` is only for icon buttons and tertiary actions.
  Every clickable control shows the pointer cursor, and a disabled
  button, toggle or tab shows not-allowed (a rule in `globals.css`; menu and
  list items stay inert but keep the plain cursor), so don't restyle that per
  button. A component added with `shadcn add` may bring back
  `disabled:pointer-events-none` or `cursor-default`; strip them.
- **Forms seeded from server data follow it after a save.** A client form
  that copies its props into `useState` keeps what it first loaded after
  `router.refresh()`, so a saved value looks lost. Re-derive the fields
  when the saved values change, as the Competition page's Settings do
  (`competition-settings-form.tsx`, tested in
  `competition-settings-form.refresh.test.tsx`); edits in progress survive
  a refresh that changes nothing saved.
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
  the War Week settings form and the Competition page's Settings are the
  exceptions: they autosave (debounced per field, "Saving…" / "Saved" by
  the heading) and have no Save button. Each save sends only its own
  fields (`updateWarWeekSettingsFields`, `saveCompetitionSetting` one field
  at a time), so it never writes back over a newer value; leaving with a
  refused field asks first. Both share `useAutosaveLifecycle` and
  `AutosaveStatusLine` (`src/components/autosave-status.tsx`).
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
  override about to be cleared) and the Announcement form's hint.
- Lay out every field with `Field` / `FieldLabel htmlFor` /
  `FieldDescription` from `ui/field`, and show a form's server error in a
  `FieldError` under its buttons.
- Admin forms post through React's `useActionState` (ADR 0004;
  `src/components/discretionary-points-form.tsx` is the reference). The server
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

### Add or fix history

```text
/implement Update seeds/<edition>.json from old-wikis/<year>.txt: <what's
missing or wrong>.
```

Competiscore data is gone; `old-wikis/`, the live wiki pages (and the Drive
folders they link to) and what you remember are the only sources. For
Claude to read the wiki, sign in to it in the Claude Code browser first.
Leave `seeds/demo/xi.json` alone unless a test needs different demo data. Load locally with `pnpm seed:load seeds/<edition>.json`, then check
`/history` and `/<edition>`. `/history` and an Award name page wear the
current War Week's nav, tab bar, footer and theme (`src/app/history/layout.tsx`).

### How R16 reached staging and production (the reset)

Epic R16 (the Competition model: Placement, Discretionary points, the new
Formats) changed the schema with one migration (`drizzle/0028_*`) and
**reset** the deployed data rather than converting it: neither database
held real users' work worth keeping, and the seed JSON is where the old
shapes were converted (closed Placements by the old totals, XI's
Subjective Points as Discretionary points, demo XII's Step Challenge as a
Placement with Scores). The migration only coerces old rows enough to
apply. Use this as the procedure for any later reset:

1. **Staging.** After the PR merges into `staging` and `migrate.yml`'s run
   on that push is green, run the **Seed** workflow (Actions tab) on
   `staging`, file blank (all seeds), **reset** ticked, `staging` typed in
   **confirm_reset**. Expected: green. Check: `/xi/leaderboard` shows Red
   38.5, Blue 31 (the frozen XI totals); Admin has Discretionary points and
   no Points page; a Team's "where points came from" shows "Discretionary:
   Subjective Points".
2. **Production pre-check, before the `staging` → `main` PR merges** (that
   merge runs the production migration, which can't be undone). In
   production Admin, check War Week XII holds nothing an Organizer entered
   that should be kept (a reset of `seeds/xii.json` deletes its
   Competitions, Hosts and Points Entries), and that every War Week comes
   from a seed (`/history` lists only seeded editions). If either fails,
   don't merge; ask Paul.
3. **Production.** After the `staging` → `main` PR merges and its migrate
   run is green, run the Seed workflow **from `main`** (`seed.yml` refuses
   another branch for production), as for staging, on `production`. Check
   as for staging, on the production URL.

If a migrate run fails, **don't reseed**: the migration test missed an
old-row shape. Fix it on a `fix/…` branch.

### How R17 reached staging and production (the reset)

Epic R17 (Brackets: one Bracket Format with a heat size and how many
advance, a "Head-to-head (single elimination)" preset, an optional 3rd place
match (then the "3rd place game", when Matches were Heats), no seeding by Standings, Forfeit or Heat time & place, and one Bracket
tree for admin and Participants) changed the schema with one migration
(`drizzle/0029_*`) and, as R16 did, **reset** the deployed data rather than
converting it. The migration recreates `competition_format` with `bracket`
in place of `single-elimination` and `heats`, gives every Bracket a full
`bracket_config`, caps a Bracket's Placement Points at 4, and **deletes
every Bracket's Matches and generated Points Entries**, so every Bracket
returns to not generated. The seed JSON is where the old shapes were
converted (demo XII's Chess Heats is a Bracket of 4 per Match with 2
advancing). The procedure is R16's:

1. **Staging.** After the PR merges into `staging` and `migrate.yml`'s run
   on that push is green, run the **Seed** workflow on `staging`, file
   blank (all seeds), **reset** ticked, `staging` typed in
   **confirm_reset**. Expected: green. Check: demo XII's Chess Heats opens
   as a Bracket of 4 per Match with the top 2 advancing; its builder offers
   no 3rd place match; no Match shows a time.
2. **Production pre-check, before the `staging` → `main` PR merges.** In
   production Admin, check no Bracket an Organizer built should be kept (the
   migration deletes every Match and can't be undone). If one should, don't
   merge; ask Paul.
3. **Production.** After the `main` merge's migrate run is green, run the
   Seed workflow **from `main`**, as for staging, on `production`. Check as
   for staging, on the production URL.

If a migrate run fails, **don't reseed**: fix the migration on a `fix/…`
branch.

### How R18 reached staging and production (the reset)

Epic R18 (the admin Competition page: one autosaving page per Competition
with locks, Hosts picked from the roster, a rich-text description and Log a
Game from admin) changed the schema with one migration (`drizzle/0030_*`)
and, as R16 and R17 did, **reset** the deployed data rather than converting
it. The migration changes `competition.description` from `varchar(2000)` to
`jsonb` with `USING NULL`, so **every Competition's description is cleared**
(it can't fail on any old row). The seed JSON is where descriptions come
back: the loader turns a plain-text seed description into rich-text
paragraphs. The procedure is R16's and R17's:

1. **Staging.** After the PR merges into `staging` and `migrate.yml`'s run
   on that push is green, run the **Seed** workflow on `staging`, file
   blank (all seeds), **reset** ticked, `staging` typed in
   **confirm_reset**. Expected: green. Check: demo XI's Settlers of Catan
   shows its description on its Participant page, with its line breaks.
2. **Production pre-check, before the `staging` → `main` PR merges.** In
   production Admin, check no Competition holds a description an Organizer
   wrote that should be kept (the migration clears every description and
   can't be undone). If one should, don't merge; ask Paul.
3. **Production.** After the `main` merge's migrate run is green, run the
   Seed workflow **from `main`**, as for staging, on `production`. Check as
   for staging, on the production URL.

If a migrate run fails, **don't reseed**: fix the migration on a `fix/…`
branch.

### How R21 reached staging and production (migrations 0031 and 0032)

Epic R21 (Competition setup and logging: Close everywhere, no scheduled
times, one self-report setting, score direction and unit, the Bracket kind
and flexible Group Matches, Head-to-head as a two-Entrant series, Best score
Attempt limits) changed the schema with **two hand-edited migrations**, the
precedent of 0028 and 0029 (the one exception to "never hand-edit a
migration": `drizzle-kit generate` asks interactively about renames):

- `drizzle/0031_*` is **pure renames** (`heat` → `bracket_match`, `game` →
  `series_match` and so on; `finalized_at` → `closed_at`,
  `generated_by_bracket` → `generated`). Row-preserving by construction.
- `drizzle/0032_*` **reshapes**: it splits `game` into `series_match` and
  `attempt`, adds `score_unit`, `series_config`, `best_score_config`,
  `max_attempts` and `bracket_match.advance_count`, converts `bracket_config`
  to the new shape, turns Bracket Match Scores numeric, and drops
  `logging_closes_at`, `enroll_closes_at`, `check_in_closes_at`,
  `entrants_open` and `game_config`. Some rows cannot convert and are
  **dropped or nulled**: a Head-to-head's Entrants beyond the two who played
  (or beyond the first two), its Matches among more than two players or past
  seven, Best score Attempts with no score or Host-logged in team scoring, a
  Best score Competition's Entrants, and a Match Score that is not a number.
  Everything dropped is deliberate; the report lists it first.

**Before the production Migrate, run the report.** It is read-only, prints
names and counts only (never an email), and must run **while the database is
still at 0031**, before `migrate.yml` runs 0032:

```bash
pnpm tsx scripts/r21-migration-report.ts
```

Paul runs it with his own credentials against staging, then production (agents
never read `.env*`), and pastes the output in the PR. If it lists anything an
Organizer wants kept, don't migrate; ask Paul. Then, as for R16 to R18:

1. **Staging.** After the PR merges into `staging` and `migrate.yml`'s run is
   green, run the **Seed** workflow on `staging`, file blank (all seeds),
   **reset** ticked, `staging` typed in **confirm_reset**. Check:
   `/xii/competitions` renders, and the Bracket page answers 200.
2. **Production pre-check** before the `staging` → `main` PR merges: the report
   above, plus a look in Admin for anything an Organizer entered that should
   be kept.
3. **Production.** After the `main` merge's migrate run is green, run the Seed
   workflow **from `main`**, as for staging.

The app errors between the deploy and the Migrate job (the tables are
renamed), so confirm **Migrate** succeeded before checking the new deployment,
and **a Vercel rollback past this deploy is unsafe**: it would run the old
code against the new tables. If a migrate run fails, **don't reseed**: fix the
migration on a `fix/…` branch.

### Rolling out R23 (migration 0034)

Epic R23 (League: round robin and Swiss) changed the schema with **one
additive migration**, `drizzle/0034_*`: a `league` value on the Format enum,
the `league_result` type, `competition.league_config`, the `league_match`
table and its CHECKs, and `competition_self_enroll_bracket_only` widened to
admit a League. It converts and drops nothing, so there is no report script.
After the PR merges into `staging`, 0034 applies on its own (the deploy
migrates; nothing to run by hand). Once it has, run **`seed.yml`**
(file blank, all seeds) so the XII demo gains **Chess Round Robin** and
**Chess Swiss**. Check: `/xii/competitions` lists both, and both pages answer 200.
Repeat for production after the `main`
merge. **Roll back only after deleting every League Competition**: an older
deploy has no Format branch for a `league` Competition and would error on it.
This release also changes Head-to-head: Close now waits for a decided or
drawn series.

## Guardrails

- **Never open, cat or paste `.env*` files**, into Claude or anywhere else.
  Claude is told the same; use `.env.example` for variable names.
- **Migrations reach deployed databases only through the deploy path**
  (merge to `staging` / `main`; Vercel's build migrates before it builds).
  Never run `pnpm db:migrate`
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

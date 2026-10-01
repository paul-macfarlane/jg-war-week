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
| Participant pages (home, leaderboard, schedule, teams, competitions, news, awards, FAQ) | `src/app/[edition]/`                    |
| History page                               | `src/app/history/`                                                     |
| Organizer screens                          | `src/app/admin/` (setup, points, standings, announcements, awards)     |
| Server actions behind admin forms          | `src/actions/`                                                         |
| Database reads / writes                    | `src/queries/`, `src/mutations/`                                       |
| Rules with unit tests (standings, schedule, Finale, access…) | `src/lib/` (`*.test.ts` next to each file)           |
| The Bracket engine (seeding, Rounds/Heats, advancing winners, Bracket → Points Entries) | `src/lib/bracket/` (`*.test.ts` next to each file) |
| Bracket builder and results screens                | `src/app/admin/setup/competitions/[id]/bracket/`, `src/app/admin/brackets/[id]/` |
| Database schema                            | `src/db/schema.ts`                                                     |
| Migrations (generated, never hand-edited)  | `drizzle/`                                                             |
| Seed data, one file per War Week           | `seeds/i.json` … `seeds/xi.json`, the tentative upcoming `seeds/xii.json`; the live XI demo in `seeds/demo/xi.json` |
| Seed format and loader                     | `src/seed/schema.ts`, `src/seed/load.ts`                               |
| Appearance Theme → CSS                     | `src/lib/theme.ts`                                                     |
| Shared UI pieces                           | `src/components/` (shadcn primitives in `src/components/ui/`)          |
| MCP server (Claude connector)              | `src/app/api/mcp/route.ts`, tools in `src/mcp/`, list in `src/mcp/tools.ts` |
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
(`src/app/about/page.tsx`, `src/lib/about.ts`) and, when a feature card's
screen changed, its still. Regenerate the stills from the seeded demo, never
by hand, after `pnpm build` with a freshly loaded seed
(`pnpm seed:load --reset seeds/*.json && pnpm seed:demo`):

```bash
pnpm tsx scripts/about-media.ts --stills
```

Without `--stills` it also re-records the Finale poster still
(`finale-poster.png`); only do that when the Finale screen itself changed.
`--stills` also rewrites the home Standings hero's three stills
(`standings-before.png`, `standings-entry.png`, `standings-after.png`).

### Run a new War Week or change this year's theme (no code first)

Organizer screens cover it. Sign in and go to `/admin`:

- **`/admin/setup`**: the **Lifecycle** box (Start, End with the computed
  Winner and highlights, Reopen), War Week settings (Story Theme, dates,
  mode, Team Label, Leader Title, links, Winner and highlights, editable
  directly for corrections), the Appearance Theme
  (colors, font, logo, banner), Days, Teams and roster, Competitions (with
  their Hosts), Schedule and FAQ. The Appearance Theme form shows both
  color schemes: whichever one the five colors you set are the base
  palette for, and the other scheme's colors, derived from them
  automatically. Any of the derived scheme's five colors can be
  overridden; changing a background across light and dark clears every
  override you haven't touched yourself. Viewers never see your Setup
  screen's scheme — each picks their own Display (Light, Dark or System)
  from the header menu (the phone More Sheet, the desktop TopNav, or the
  Admin header).
- **On a phone**, the admin sections are a bar fixed to the bottom of the
  screen (Overview, Points, Announcements, Setup, More); More opens a Sheet
  with the other sections you can see, the edition switcher, Display and
  your account. From `md` up it is the side column and header as before.
  The sections live in `src/lib/admin-sections.ts`.
- **Setup rows open in a Sheet.** On Teams & roster and Competitions, each
  row is one "Edit <name>" button that opens its form in a
  `ResponsiveSheetDialog`, with Save and Delete in a sticky footer; "Add …"
  opens the empty form. A Team's row reads "Edit <Team Label> <name>". "Assign
  Hosts" (the Hosts field) is inside the Competition's Sheet, and its one
  Save saves the Hosts with the rest.
- **`/admin/organizers`**: the Organizer list (see
  [Add an Organizer or assign Hosts](#add-an-organizer-or-assign-hosts)).
- **`/admin/points`**, **`/admin/standings`** (Run the Finale: "Open Finale" at closing ceremonies, and "Finale: <Competition>" for each finalized Bracket),
  **`/admin/announcements`**, **`/admin/awards`**.

To start next year's edition in the app:

1. In `/admin/setup`, press **Create next War Week**. The edition, number
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
   and any open `games` Competition with Games, each `games` one linked to
   its Games setup page. Finalize or close them first so their placings
   count; it warns, it doesn't stop you.
3. Switch to XII and press **Start War Week**. `/` and `/admin` now go to
   XII. Only one War Week can be live, so XI must end first.

Organizers can still pick any Archive edition in the switcher to correct
its results.

A seed file for a new edition is optional (for demo data or a bulk
import). If you use one, load it with the **Seed** workflow in the GitHub
Actions tab (pick the environment and the file). A reload never changes a
War Week's status, Winner or highlights. Once organizers edit a War Week in
the app, stop reloading its seed: a reload overwrites their other edits.

### Add an Organizer or assign Hosts

No code. There are three roles: **Organizers** run every War Week, a
**Host** runs the Competitions an Organizer assigns them, and everyone else
signed in is a **Participant** (`CONTEXT.md`, "Access rules").

- **Add or remove an Organizer**: `/admin/organizers` (the Organizers link
  in the Admin nav). Add a `@jahnelgroup.com` email; it works on their next
  page load. Any Organizer can remove any other, or themselves, as long as
  one Organizer is left. The list is global: one list for every War Week.
- **Assign Hosts**: `/admin/setup/competitions`, the Hosts field in each
  Competition's Sheet, saved with its Save (Organizers only). A Host needs
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
  rollback window, then drop it in its own migration.

### Run a knockout Competition as a Bracket

Organizer screens cover setting one up and running it. Under
**Setup → Competitions**, tap **Add Competition** (it opens a Sheet) and
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
its Bracket page, not the Setup form.

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
`/admin/standings` ("Finale: <Competition>"). The rules are under "Bracket
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

### Run a Competition as Games

For a showdown, a best of X, or a week-long ladder of casual games — no code
needed. Under **Setup → Competitions**, tap **Add Competition** (it opens a
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
express (copying rows between tables): create it with
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
  (a centered Dialog at `lg` and up, a bottom Sheet below) — live in
  `src/components/`. Reach for one of those before building a new control.
  Only `EntityCombobox` does search and chips.
- Below `sm`, every admin control is at least 44px tall and wide: `min-h-11
  min-w-11`, then from `sm` back to today's size — `sm:min-h-0 sm:min-w-0`,
  or `sm:min-h-<the variant's height>` (e.g. `sm:min-h-6` for `xs`,
  `sm:min-h-7` for `sm`, `sm:min-h-9` for `default`/`lg`) so desktop is
  unchanged. `Input`, the combobox and the Setup buttons follow it. The shadcn select trigger's
  default height is now 44px below `sm` and 36px from `sm` (an edit in
  `ui/select.tsx`), so it sits level with an `Input`, and its list opens
  below the trigger rather than over the field above it.
- A bottom Sheet (`ui/sheet.tsx`) and `ResponsiveSheetDialog` dismiss any
  open toast as they open (`DismissToasts` in `ui/sonner.tsx`), so a toast
  never covers their fields.
- A long admin form puts its submit row in `StickyFormActions`
  (`src/components/sticky-form-actions.tsx`): below `md` it sticks above the
  admin section bar so Save stays in reach; from `md` it sits in the flow.
  Give the form `pb-*` and its fields `scroll-mb-*` so a focused field is
  not hidden under it.
- Popups portal into the themed root through `ThemeRoot`, which is wired
  into `ui/popover`, `ui/select`, `ui/combobox`, `ui/alert-dialog`,
  `ui/dialog` and `ui/sheet`, so they keep the War Week's Appearance Theme.
  `ThemeRoot`'s `scheme` prop pins its subtree to one color scheme whatever
  the viewer's Display — the Setup form's two previews use it so an
  Organizer sees both the light and the dark palette rendered live, side by
  side, regardless of their own Display.
- A warning that still lets the save through uses the `--warning` token
  (`text-warning`), not a hardcoded amber — it's tuned to pass AA against
  each color scheme's background, unlike a raw Tailwind amber class. Its
  users today: Setup's contrast warnings and its flip notice (an Organizer
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
  description, setup rows).
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
`get_announcements`, `get_awards`, `get_faq`, `list_history`,
`get_history`, `get_bracket` (a Competition's Bracket by name, with each
Heat's time and place, and a Squad's `participants` by name; never who
reported a result) and `get_games` (a Competition run as Games, by name:
its settings, leaderboard ranked by Game Type and its Games newest first;
never an email or who logged one). `get_bracket` (`src/mcp/bracket.ts`) is
the model for a tool that looks something up by name and whitelists what
it returns.

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

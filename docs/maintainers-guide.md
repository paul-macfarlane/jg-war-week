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
| Seed data, one file per War Week           | `seeds/i.json` … `seeds/xi.json`                                       |
| Seed format and loader                     | `src/seed/schema.ts`, `src/seed/load.ts`                               |
| Appearance Theme → CSS                     | `src/lib/theme.ts`                                                     |
| Shared UI pieces                           | `src/components/` (shadcn primitives in `src/components/ui/`)          |
| MCP server (Claude connector)              | `src/app/api/mcp/route.ts`, tools in `src/mcp/`, list in `src/mcp/tools.ts` |
| Who can do what                            | `src/lib/access.ts` (`can`), `src/auth/authorize.ts`, `src/auth/actor.ts` |
| Smoke test                                 | `scripts/smoke.ts`                                                     |
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
4. **Check it.** `pnpm gate` (type-check, lint, tests, build, smoke). It
   must pass. Needs Docker Postgres running (`docker compose up -d`), and
   `DATABASE_URL` must point at it: smoke resets every seeded War Week, so
   it refuses any database that isn't on `localhost`, `127.0.0.1` or
   `[::1]`. If yours comes from Vercel, run
   `DATABASE_URL=<the .env.example value> pnpm gate`.
5. **Open a PR into `staging`.** Ask Claude to "commit and open a PR into
   staging", or `gh pr create --base staging`. CI runs on the PR: lint,
   types, tests, build, smoke against its own Postgres, and a migration
   drift check that fails when `src/db/schema.ts` changed without a
   `drizzle/` migration.
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

### Run a new War Week or change this year's theme (no code first)

Organizer screens cover it. Sign in and go to `/admin`:

- **`/admin/setup`**: the **Lifecycle** box (Start, End with the Winner and
  highlights, Reopen), War Week settings (Story Theme, dates, mode, Team
  Label, Leader Title, links, Winner and highlights), the Appearance Theme
  (colors, font, logo, banner), Days, Teams and roster, Competitions (with
  their Hosts), Schedule and FAQ.
- **`/admin/organizers`**: the Organizer list (see
  [Add an Organizer or assign Hosts](#add-an-organizer-or-assign-hosts)).
- **`/admin/points`**, **`/admin/standings`** (Run the Finale: "Open Finale" at closing ceremonies),
  **`/admin/announcements`**, **`/admin/awards`**.

To start next year's edition in the app:

1. In `/admin/setup`, press **Create next War Week**. The edition, number
   and year are prefilled (XII, 12, next year); add the dates and Story
   Theme, and choose what to copy (settings are on; Competitions, with
   their Hosts, and the FAQ are off). Organizers are global, so there's
   nothing to copy for them. It starts `upcoming`, and the admin
   switches to it so you can set it up while XI stays current.
2. When XI is over, switch back to XI in the header's edition switcher and
   press **End War Week**: confirm the Winner (prefilled from first place)
   and any highlights. XI moves to the Archive.
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
- **Assign Hosts**: `/admin/setup/competitions`, the Hosts field on each
  Competition (Organizers only). A Host needs no Participant record. They
  get the Admin link and see only their Competitions in Admin: its Points
  Entries, Bracket, setup and linked Schedule Items, plus Announcements for
  that War Week. Remove the email to take it away; it applies on their next
  request. A Schedule Item's "host" text is only what the schedule shows;
  it doesn't make anyone a Host.
- **A fresh database** gets its first Organizers from a seed's `organizers`
  list: a seed load adds any that are missing and never removes one, even
  with `--reset`. After that, manage them in the app. Hosts never come from
  seeds; a plain reload leaves them alone, and `--reset` deletes them along
  with the War Week's Competitions.
- **Expand/contract.** The old per-edition `organizer_emails` column on
  `war_week` is still in the database, unused, so a rollback stays safe.
  Ticket 18 (`.scratch/hardening/issues/18-drop-war-week-organizer-emails.md`)
  drops it in a later release; don't build on it.

### Run a knockout Competition as a Bracket

Organizer screens cover setting one up and running it: set the Competition's
**Format** to single elimination under `/admin/setup/competitions`, open its
Bracket builder to pick Entrants (all Teams, or specific Participants) and
Generate; then record each Heat's result from the results screen
(`/admin/brackets/<id>`) and Finalize to write its placings as Points
Entries. No code needed for any of that. While a Bracket is finalized, its
Competition's scoring and Placement Points can't change ("Un-finalize the
Bracket first."); its name and description still can.

To add a new Format (single elimination is the only one today):

```text
/implement Add a <name> Format to Competitions, alongside single
elimination. Follow src/lib/bracket/ (types.ts, seeding.ts, engine.ts,
points.ts, view.ts, each with its test) for the shape a Format needs:
building the bracket structure from Entrants, advancing a Heat's winner,
and turning a finished bracket into Points Entries. Add it to the Format
select on the Competition form and to the builder/results screens.
```

The engine is deliberately separate from the UI: `src/lib/bracket/` has no
React imports and never reads or writes the database itself, so a new
Format's rules are unit-testable on their own before any screen uses them.

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
`pnpm drizzle-kit generate --custom --name <what-it-copies>` so it gets its
own journal entry, and write only that file.

### Add or change a form control

Convert a field:

```text
/implement Convert the <field> on the <form> to shadcn's <Select / Switch /
…>, or our <EntityCombobox / DatePicker / DateRangePicker / TimeCombobox /
ColorField>, keeping the same state and the same submitted name and value.
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
- The app's own wrappers — `EntityCombobox`, `DatePicker`,
  `DateRangePicker`, `TimeCombobox`, and `ColorField` — live in
  `src/components/`. Reach for one of those before building a new control.
  Only `EntityCombobox` does search and chips.
- Popups portal into the themed root through `ThemeRoot`, which is wired
  into `ui/popover`, `ui/select`, `ui/combobox`, `ui/alert-dialog` and
  `ui/sheet`, so they keep the War Week's Appearance Theme.
- Lay out every field with `Field` / `FieldLabel htmlFor` /
  `FieldDescription` from `ui/field`, and show a form's server error in a
  `FieldError` under its buttons.
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

`/llms.txt` picks the new tool up from `src/mcp/tools.ts`.

### Add or fix history

```text
/implement Update seeds/<edition>.json from old-wikis/<year>.txt: <what's
missing or wrong>.
```

Competiscore data is gone; `old-wikis/` and what you remember are the only
sources. Load locally with `pnpm seed:load seeds/<edition>.json`, then check
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

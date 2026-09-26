# jg-war-week

War Week: themes, schedule, teams, competitions (including single-elimination
Brackets), points, awards, announcements, and a closing-ceremony Finale, for
Jahnel Group's annual War Week — one live edition at a time, with a curated
Archive of every past one. See `CONTEXT.md` for the domain glossary.

**Changing the JG War Week app?** Start with the
[maintainer's guide](./docs/maintainers-guide.md): access, where things
live, the branch-to-production loop, and prompts to give Claude.

## Fresh clone setup

Prerequisites: Node 24, `pnpm` via corepack (`corepack enable`), Docker
running locally.

```bash
cp .env.example .env.local   # fill in real values as later tickets need them
docker compose up -d          # starts local Postgres on localhost:2345
pnpm install
pnpm db:migrate
pnpm seed:all                 # loads every War Week, 2016 (I) to 2026 (XI)
pnpm dev                      # http://localhost:3000
```

### Seeds

`seeds/<edition>.json` holds one War Week each: `i.json` (2016) through
`x.json` (2025) are the history, extracted from `old-wikis/` and fixed by
hand; `xi.json` is War Week XI with its real schedule, Teams, roster and
Competitions plus fictional mid-week demo data (a close race). Edit a file and reload it; setup data follows the seed, while keyed
Points Entries, Awards and Announcements are only inserted once (see
`CONTEXT.md`, "Seed idempotence rules"). Organizers can also edit War Week
settings, the Appearance Theme, Days, Teams, the roster, Competitions,
Schedule Items and FAQ Items in
`/admin/setup`; reloading a seed
overwrites those edits with the seed's values, so update the seed to match
or stop reloading it once organizers are editing in the app.

- `pnpm seed:all` loads every seed. `pnpm seed:load <file> [<file> ...]`
  loads specific ones. Every file is validated before anything loads; each
  War Week then loads in its own transaction.
- `--reset` (e.g. `pnpm seed:load --reset seeds/xi.json`) deletes each War
  Week first, including organizer-entered points, Awards and Announcements,
  so the demo starts from exactly the seed. Never use it on a War Week
  organizers are running.

Checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Smoke test and slice gate

`pnpm smoke` runs an end-to-end check against a production build: it applies
migrations, loads every seed (once with `--reset`, then again to prove
idempotence; this wipes those War Weeks in your local database), starts the app with `pnpm start -p 3100`,
and asserts `/` redirects to `/xi`, `/xi` and `/xi/leaderboard` respond, and
`/api/mcp` answers `initialize`, `tools/list`, and a `tools/call` of
`get_current_war_week` with War Week XI's data, both with a session and with
a smoke-only `MCP_TOKEN` bearer token (anonymous still gets 401). It prints one `ok - <check>`
or `FAIL - <check>: <detail>` line per assertion and exits 0 only if every
check passed.

Prerequisites: Docker Postgres running (`docker compose up -d`) and a fresh
production build (`pnpm build`) before running `pnpm smoke`.

`pnpm gate` runs the full slice gate used before every commit: type-check,
lint, vitest, production build, then the smoke test —
`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke`.

## Connect Claude to JG War Week

The app exposes a read-only Model Context Protocol server over Streamable
HTTP at `/api/mcp` (production: `https://jg-war-week.vercel.app/api/mcp`).
Its tools are `get_current_war_week`, `get_leaderboard`, `get_schedule`,
`get_announcements`, `get_awards`, `get_faq`, `list_history` and
`get_history`. Every tool is read-only and returns only what a signed-in
Participant sees, and no tool returns an email
or the Organizer allowlist (Announcement authors come back as the handle
before the `@`).

`/llms.txt` (public, static copy, no War Week data) describes the site, its
pages and these tools for AI agents. Its tool list comes from
`src/mcp/tools.ts`, the same metadata the MCP route registers.

`/api/mcp` lets a request in when either of these holds; otherwise it answers
401:

- a signed-in `@jahnelgroup.com` browser session;
- `Authorization: Bearer <MCP_TOKEN>`, where `MCP_TOKEN` is a server-only
  env var (unset or blank turns token auth off).

**Claude Code (or any client that can send headers).** Set `MCP_TOKEN`
(`openssl rand -base64 32`) in the environment, redeploy, then:

```bash
claude mcp add --transport http jg-war-week https://jg-war-week.vercel.app/api/mcp --header "Authorization: Bearer <token>"
```

**claude.ai / Claude Desktop custom connector.** Those connectors support
only OAuth or no auth, and this server only takes a session or a bearer
token, so a custom connector there needs OAuth support this server doesn't
have yet. Until then, only Claude Code or another header-capable client can
connect.

## Organizer sign-in

Every page needs a `@jahnelgroup.com` Google sign-in: anonymous visitors
are sent to `/sign-in` and come back afterwards. Organizers also manage the
current War Week at `/admin` (linked from the header, and from More on
mobile). A War Week's Organizers are the `organizerEmails` in its seed file.

Local setup (needed to use the app in a browser; `pnpm smoke` runs without
it by signing its own test sessions):

1. In Google Cloud Console, create an OAuth client (Web application) with an
   **Internal** consent screen, and add the redirect URI
   `http://localhost:3000/api/auth/callback/google`.
2. In `.env.local`, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and
   `BETTER_AUTH_URL=http://localhost:3000`.
3. `pnpm db:migrate`, then `pnpm dev` and open `/admin`.

Any Google account outside `@jahnelgroup.com` is refused at sign-in, even if
the consent screen were misconfigured. A JG employee who isn't on the
allowlist can sign in but `/admin` refuses them.

`/api/mcp` is locked too: without a session it answers 401 unless the
request carries the `MCP_TOKEN` bearer token; see "Connect Claude to JG War
Week".

## Deployment (Vercel + Neon)

Production: **https://jg-war-week.vercel.app** (MCP at
`https://jg-war-week.vercel.app/api/mcp`). Staging:
**https://jg-war-week-staging.vercel.app**.

- **Hosting:** the Vercel project is connected to this GitHub repo. A push to
  `main` builds and deploys to production; every other branch (including
  `staging`) gets a preview deployment behind Vercel's team login.
- **Databases:** separate Neon Postgres databases for production and
  staging. Vercel's Production environment uses the production database;
  Preview deployments (including `staging`) use the staging database.
- **Vercel env vars** (Project Settings → Environment Variables, per
  environment): `DATABASE_URL` (that environment's Neon connection string)
  and `DATABASE_DRIVER=neon`, plus the auth variables from `.env.example`
  (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` set to that deployment's URL,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
  Staging and production each need their own `BETTER_AUTH_URL`, and the
  OAuth client needs each deployment's
  `<deployment URL>/api/auth/callback/google` as a redirect URI. A build with
  no `BETTER_AUTH_SECRET` (e.g. CI) logs a "default secret" error while
  collecting page data; it is harmless there, but a deployment without the
  secret answers 500 on any page that checks the session.
- **GitHub repo secrets:** `PROD_DATABASE_URL` and `STAGING_DATABASE_URL`,
  used by the Migrate and Seed workflows below.

Release flow: merge PRs into `staging` (staging database migrates, preview
deploys) → merge `staging` into `main` (production database migrates,
production deploys). Load or refresh seed data with the Seed workflow; check
the deploy by confirming `/` redirects to `/xi`, `/xi` responds 200, and
`/api/mcp` answers a `tools/call` of `get_current_war_week`.

## Deployed migrations

`.github/workflows/migrate.yml` runs `pnpm db:migrate` on every push to
`staging` (against the `STAGING_DATABASE_URL` repo secret) and `main`
(against `PROD_DATABASE_URL`). A branch whose secret is unset logs a notice
and skips. Generate migrations locally with `pnpm db:generate` and commit the
`drizzle/` output; never run `db:migrate` by hand against a deployed database.

Seeds are never loaded on deploy. To load them, run the **Seed** workflow from
the Actions tab: pick `staging` or `production` and optionally one file under
`seeds/` (blank loads all). Tick **reset** and type the environment name in
**confirm_reset** to replace existing demo data (see `--reset` above). Production can only be seeded from `main`.

<!-- atlas-v3:readme:start -->

## Atlas

This repo uses Atlas, a Claude Code plugin that acts as a shared path for AI-assisted development — generated, customizable policies, guidelines, and guardrails that keep agent-driven work safe and consistent without locking teams into one rigid workflow. Read [`docs/atlas-operators-guide.md`](./docs/atlas-operators-guide.md) for how to work in this repo, in plain language, and the **Atlas** section in [`CLAUDE.md`](./CLAUDE.md) for the policy the agents follow.

Everything Atlas generated here — hooks, the `CLAUDE.md` section, `docs/agents/` — is a **base recommendation**, not fixed policy. Adapt it to this project's actual needs and processes.
<!-- atlas-v3:readme:end -->

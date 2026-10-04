<!-- atlas-v3:testing:start -->
# Testing and proof of work

This document is the authoritative repository policy for verification commands,
acceptance evidence, and `PASS`, `FAIL`, `BLOCKED`, and `SKIPPED` verdict
semantics.

Run surface: **local + deployed**.

Read this guide while planning acceptance criteria, Definition of Done,
fixtures, and verification. Resolve the applicable commands and evidence rules
into each execution packet; implementation workers execute that packet without
rereading this guide.

## Commands

| Check | Command | Coverage | When | Status |
|---|---|---|---|---|
| typecheck | `pnpm typecheck` | Type correctness across the app | Per slice gate, before PR | verified |
| lint | `pnpm lint` | Static code issues | Per slice gate, before PR | verified |
| format | `pnpm format` (check: `pnpm format:check`) | Consistent formatting | Before lint | verified |
| unit | `pnpm test` (vitest) | Pure modules and services through public interfaces; no DB for pure-module tests | During implementation and per slice gate | verified |
| build | `pnpm build` | Next.js production build | Per slice gate, before PR | verified |
| smoke | `pnpm smoke` (needs `pnpm build` and local Postgres via `docker compose up -d`) | Migrates, loads every seed twice (first with `--reset`, which wipes those War Weeks in the local DB, then plain to prove idempotence), starts the app; /, /xi, /xi/leaderboard, /api/mcp respond; /xi/news permanently redirects to /xi/announcements; seed row counts (including `placement`, the same after two loads as after one) and DB constraints, each proven by an insert the database refuses (`points_entry_reason_without_competition`, `points_entry_exactly_one_target`, the Placement target CHECK `placement_exactly_one_target`, and `competition_participation_columns` for an individual Participation Competition with Placement Points, a team one with N, and a non-Participation Format with N); pages and admin actions over HTTP; the five retired admin Competition, Bracket and Placement routes each answering 308 to the Competition page at `/admin/competitions/<id>`; Discretionary points (the admin page, give, edit and delete over HTTP, a Host and a Participant refused); the Head-to-head and Best score Competitions' pages; a Game logged over HTTP (a Host or Organizer's from the admin Competition page too) and refused for a Participant not linked by email; a Head-to-head Competition's closed and ended-War-Week render; the Formats over MCP with no `@` in any output (`get_games` for Head-to-head and Best score, `get_participation`, `get_placements`, `get_bracket` answering `bracket: null` for Placement, Participation and Head-to-head and returning a Bracket, and `get_discretionary_points`); the Bracket loop (a head-to-head Bracket, 2 per Heat with 1 advancing, with a 3rd place game: set, 4 Teams entered, generated, 4 Heat Results recorded, finalized; the champion and generated points shown, `/xi/finale/<id>` 200 then 404 after Un-finalize), whose `get_bracket` names the Format Bracket with heat size, advancing and 3rd place game, a `recordedAt` per played Heat, the 3rd place game marked, the final's winner as champion, no Heat time, place or Forfeit and no `@`; a Heats-size Bracket and a Squad Bracket likewise, with no timed Heat, no Forfeit and no seeding by Standings anywhere; Participation (the seeded Competition page, check-in over HTTP, `get_participation` over MCP); Award Categories (seeded keys, tags after two loads, grouping); `/history/awards` (200, newest first, 404); the final XII scale phase (the scale seed plus fixture loaded twice with no row count changing, 100 Participants and 64 Entrants, `/xii`, `/xii/leaderboard`, `/xii/competitions` and the Bracket page answering 200, `localSeedFiles()` restored); the Finale (`/xi/finale` opens on the Title slide, no Standings in the HTML), `/admin/finale` rendering, and `finale_slide` seed idempotence (War Week XI's seven slides, with the same ids after the second load) | Per slice gate, before PR | verified |
| e2e | `pnpm e2e` (Playwright; needs `pnpm build` and local Postgres via `docker compose up -d`; first time `pnpm exec playwright install chromium`) | Browser flows in Chromium over the production build on port 3200, after migrating and reloading every seed with `--reset` and signing stub JG sessions (no Google): anonymous and non-JG visitors sent to `/sign-in`; an Organizer's Discretionary points (give, edit, delete) move `/xi/leaderboard` and the Reason is required, a Host gets the refusal page, and `/admin/points` redirects; a Host records a Placement sheet (adds Participants by search, Scores fill the Places, breaks a tie, Finalizes so the Standings and Recent results move, Reopen withdraws, a Participant is refused), screenshotted at 1440 and 390; a head-to-head Bracket built, recorded, advanced and finalized into Points Entries and played as a Finale ("Your next Heat" names the Round and opponent with no time or place, each played Heat shows "Recorded <time>", and the final state at once under reduced motion); a Heats-size Bracket run to Points Entries, with the End War Week warning; a head-to-head Bracket of 8 with a 3rd place game run to Finalize, whose Points Entries are 10, 7, 5 and 3 for the four placed Entrants and nothing for anyone else; a Squad Bracket with self-report: a Participant reports and their Squad advances, a second report on that Heat is refused, the Host sees who reported and overwrites; the Finale's Standings countdown ends on first place (the slideshow stepped with → to the Standings countdown, whose leader is first place); the Finale slide list (reorder by ↑/↓ and drag, hide and show), the built-in slides (Awards one per step, Winner) and the per-Category Awards layout, and Custom slides (add, edit, delete, readable colors, axe); `/history` and every past edition render; server-refused form fields show their error and take focus; the viewer's Display (Light / Dark / System) changes every themed page, survives reload and follows the OS; axe contrast on three pages in both schemes; a Participant logs a Head-to-head Game from the home "Log a Game" shortcut and the form keeps its input across the `md` (768px) resize, the Host re-picks the winner by keyboard, End War Week warns about the open Competition, and the Host closes it and the Standings move; a Participant enrolls, withdraws and re-enrolls in a Bracket and is refused once it's built; the Squad help line; a team Participation Competition run end to end; the one admin Competition page per Competition (`regression-r18-competition-page`): Settings autosave per field, each lock shown disabled with its reason and refused by the server with the same reason (Format and scoring once a result exists; a Head-to-head Best of 3 saved with two fixed Entrants, its settings locked once a Game exists; heat size, advancing and building the Bracket once a Heat Result exists; the closing times only while Finalized), a Format change between Formats until a result exists, and a Host seeing the page with the Hosts by name only; Hosts picked from the roster by name with the email beneath (no-email and non-@jahnelgroup.com Participants disabled with a reason; `regression-r18-hosts`); a rich-text description (headings, lists, links, images by URL) saved from the Settings and rendered in full on the Participant Competition page (`regression-r18-description`); a Host or Organizer logging, editing and deleting a Game from the admin Competition page's Entrants and Games (`regression-r18-games-admin`); Award Categories added, renamed, archived and restored, and the Awards grouping; a Category through the years at two viewports; the one Bracket tree: an Organizer records Heats from the tree on the Competition page and Participants see the same tree with no List toggle (Record result on an unplayed Heat, Edit on a recorded one, shown only to who may use them, the Heat Result opening as a dialog at 1440 and a bottom sheet at 390), a Heats-size tree with its advancers highlighted, a self-reporting Participant recording their own Heat from the public tree while nobody else sees Record result on it, the tree scrolling sideways in its own "Rounds" region at 390 while the page never does, and axe on the tree in both schemes; computed cursors (pointer on controls, not-allowed on a disabled button the pointer actually reaches); the top nav centred at 1280 and 1024 and the phone header; `/history` and a Category page in the current War Week's chrome and theme; Games settings and Placement Points that persist after leaving and returning; a new Competition given 20 Placement Points places in the list editor at 390, every place reachable with no sideways scroll, screenshotted; the Participant Competitions list with every status and a two-line preview at 1440 and 390 (`regression-r19-list`); the 100-Participant scale pass screenshotted at 1440 and 390 with no sideways scroll and a picker found by email with no cap (`regression-r19-scale`). Specs that run a Bracket on a seeded (Finalized Placement) Competition open it first with `openForBracket` and put its Placements and Points Entries back. Screenshots under `test-results/e2e/<test>/` | Per slice gate, before PR, and in CI after smoke | verified |
| run | `pnpm dev` | Local dev server | Manual verification and smoke | verified |
| gate | `pnpm gate` | typecheck, lint, test, build, smoke and e2e (Playwright) in order | Per slice gate, before PR | verified |

`verified` means the command ran successfully here. `inferred` means configuration names it but setup did not execute it. `unavailable` is an explicit gap.

## Evidence policy

- Repository-local proof-artifact root: `test-results`.
- Clear the entire proof-artifact root before capturing evidence for each work
  package. It intentionally contains only the latest work package's evidence.
- For UI screenshots and videos, use one directory per test name beneath the
  proof-artifact root. Rerunning a test replaces that test directory.
- Visual/browser behavior: screenshot per smoke test when visual state matters; no video.
- Integration and non-UI behavior: captured vitest and smoke output when an artifact is needed beyond the command result.
- External integration: smoke result against the Vercel deployment when a slice includes deploy.
- Sensitive data: never include secrets, env values, OAuth tokens, or real employee personal data beyond names already on the public JG wiki.
- Any screenshot, video, test report, captured output, or other artifact cited as
  `PASS` evidence is saved beneath `test-results` and committed
  on the feature branch. The PR links to the committed path; it never describes
  an uncommitted local file as attached evidence.
- Screenshot is the default visual proof. Add video only when motion, timing, or
  a multi-step interaction is material and a still image cannot prove it. Do not
  require screenshots or video when the repository has no UI/browser surface.
- Failure-only diagnostics not cited as `PASS` evidence, such as large traces,
  may remain uncommitted when repository policy says so.
- A blocked or skipped check records the attempted command and raw failure.
- `BLOCKED`, `SKIPPED`, ambiguity, and worker self-report are never `PASS`.

Run formatting before lint review, avoid unrelated reformatting, and rerun
affected tests after automatic fixes. Give every real integration seam at least
one criterion against the real dependency. Name test accounts, seed data,
confirmation flows, and cleanup. Human-gated criteria name the prerequisite,
human action, expected result, and post-action check. Runnable work must be
startable and exercisable by a fresh context using committed instructions.

Use `PASS` when evidence proves the criterion, `FAIL` when observable behavior is
incorrect, `BLOCKED` when it cannot be observed or exercised, and `SKIPPED` only
for an approved exception with the attempted command and reason. Sanitize every
retained artifact before storage or sharing.
<!-- atlas-v3:testing:end -->

## Team rules

- **Keep the showcase current.** A user-visible change updates `/about`
  (copy, and media via `scripts/about-media.ts` where affected) and
  `docs/maintainers-guide.md` in the same PR. Part of every Definition of
  Done. Decided 2026-09-26.
- **Keep the regression checklist current.** `docs/regression-checklist.md`
  is the agent-run regression suite. A PR that changes a page, a flow or a
  role's access updates that page's lines in the same PR. Part of every
  Definition of Done. Running it is on demand, never in CI. Decided
  2026-10-01.
- **Every test assertion can fail.** A spec never skips an assertion
  because an element wasn't found (`if (await x.count() > 0)`), and never
  asserts something that holds either way (`toBeDefined()` on a value that
  may be null). A missing element is a failure. Decided 2026-10-03 (R15).
- **A spec that changes shared seeded data puts it back.** A spec either
  owns a seeded record no other spec touches, and says so in a comment, or
  snapshots it and restores it in `finally` (`snapshotBracket` /
  `restoreBracket` in `e2e/db.ts` for Brackets). Decided 2026-10-03 (R15).

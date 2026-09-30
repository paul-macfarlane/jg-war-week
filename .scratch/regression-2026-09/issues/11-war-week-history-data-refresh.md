# 11: Refresh War Week XI and historical seed data

**What to build:** War Week XI data is out of date, and older War Weeks need checking against the wiki.

**Blocked by:** none

**Status:** done

**Source:** regression feedback item 2, 18

## Notes

Paul signs in to the wiki in Chrome and has Claude read from there (Claude in Chrome) to update seeds. Competiscore data is gone; sources are the wiki and `old-wikis/` only.

## Acceptance criteria

- [x] War Week XI seed matches the real results.
- [x] Older editions are checked against the wiki and corrected where wrong.
- [x] `pnpm gate` passes on the updated seed.

## Comments

### [DECISIONS] 2026-09-29

With Paul, while reading the wiki together (read-only, in the Claude Code browser signed in as Paul):

- **XI records team points only.** The wiki's final scoreboard gives each event's points per Team, not individual winners, so every scored XI Competition becomes a plain team `points` Competition with one Points Entry per Team that scored. No invented names; no XI Awards or Announcements (the wiki lists none).
- **Full rosters for 2022–2025**, names only (no emails), from the wiki's team lists. Award recipients not on a roster stay as teamless Participants (2022 Matt Salvatore, Joe C; 2024 Mark Zweigenthal). Alias merged: 2024 roster "Daniel Schuldt" = Dan Schuldt. Not merged (per Paul, may be different people): 2023 roster "Bhuwan Gokhool" and Stairs Challenge placer Ashvin Gokhool are separate Participants, both Gryffindor as the wiki lists them.
- **The XI demo moves to `seeds/demo/xi.json`.** Smoke, e2e, `about-media` and the demo-dependent unit tests load it in place of the real XI (`src/seed/local-files.ts`); `pnpm seed:demo` loads it locally. The Seed workflow only loads `seeds/*.json`, so deployed databases get the real XI.

### [SOURCES] 2026-09-29

- Live wiki pages 2021–2026 match `old-wikis/` (normalized text within ~70 characters); 2026's scoreboard in the snapshot was already final: Red 38.5, Blue 31.
- Wiki URLs are `/home/war-week/war-week-<year>`; every seed's `wikiUrl` was the guessed `/war-week-<year>` and is fixed (hardening #01's "old wiki links" item).
- 2018 (III): "(DO NOT USE) FINALE VERSION - War Week 2018" slides and Announcements #1 and #4 in the WW18 Drive folder → Awards (Catan, Chess, Code Wars 1st–3rd, International Day outfit) and highlights.
- 2019 (IV): "War Week 19 Executive Presentation" confirms the existing Awards; adds the hours totals and the Pot Luck Challenge (Non-Kelmar).
- 2017 (II): the "Must See JG" project deck and "War Week Planning" doc → highlights.
- 2016 (I), 2020 (V): Drive folders hold photos, posters and planning notes only; nothing added. The 2020 notes sheet (a "Jason Only" tab and personal impact statements) was deliberately not read.
- 2021 (VI), 2025 (X): the pages are pre-week, so there is still no winner or Awards; X now has its roster.

### [DEPLOY NOTE]

Seed loads only set `status`, `winner` and `highlights` on first insert and never touch existing Points Entries or Awards. Staging and production need a Seed workflow run **with reset** for `xi.json` (to drop the demo points and set `complete` / Red) and for `ii`, `iii` and `iv` (their new highlights). Rosters, `wikiUrl` and III's new Awards apply on a plain reload. A reset deletes anything organizers entered by hand for those editions.

### [CLOSEOUT] 2026-09-29

- Branch `chore/11-war-week-history-data-refresh`, base `staging`.
- `seeds/xi.json`: complete, winner Red, 24 team Points Entries totalling Red 38.5 / Blue 31, highlights; demo moved to `seeds/demo/xi.json` (`src/seed/local-files.ts`, `pnpm seed:demo`).
- `seeds/vii`–`x.json`: full rosters (125 / 117 / 103 / 104). `ii`, `iii`, `iv`: highlights; `iii`: 6 Awards. Every seed: real `wikiUrl`.
- Tests: `seeds.test.ts` checks the real XI scoreboard and that XI keeps the demo's schedule, roster and theme; archive smoke follows the new wiki URLs and III's Awards.
- Gate: PASS. Full `pnpm gate` run (`test-results/11-gate/gate.txt`) passed typecheck, lint, unit and build, with two archive smoke checks failing on the old wiki URL and III being link-only; after fixing those, `test-results/11-gate/gate-rerun.txt` passed typecheck, lint, 3058 unit tests, 201 smoke checks and 43 e2e. Run with `DATABASE_URL` / `DATABASE_DRIVER` from `.env.example` (local Postgres).
- Human follow-up: the Seed workflow reset runs in [DEPLOY NOTE]; hardening #01 can tick its "old wiki links" item (Slack root links still undecided).


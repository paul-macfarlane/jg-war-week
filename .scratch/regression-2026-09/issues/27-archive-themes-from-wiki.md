# 27: Archive Appearance Themes match each year's wiki art

**What to build:** Give each past War Week (2016–2025) the Story Theme name and colors of its wiki page's poster or header art, instead of the colors the first extraction guessed from text.

**Blocked by:** none

**Status:** done

**Source:** follow-up to ticket 11 (PR #95), 2026-09-30

## Need

- **Participant (History):** the Archive should look like the War Weeks people remember. Five editions (2016–2018, 2020, 2021) had placeholder Story Themes ("War Week 2016"), and several palettes contradicted the art (2021's Spartan red was blue; 2024's "Back in Black" was neon pink).

## Decisions (Paul, 2026-09-30)

- Seeds only: Story Theme names, colors and font preset. No images: the posters reuse copyrighted characters, so no wiki art is copied into `public/`.
- Every theme must still pass `src/seed/archive-contrast.test.ts` (WCAG AA, light and dark Display).
- XI (2026, The Matrix) and IV's colors (2019, Star Wars) already matched and keep their colors.

## Acceptance criteria

- [x] I–X carry the Story Theme and palette of their wiki art; names come from the art (I "I Want You", II "We Can Do It!", III "Blue Label", IV "Star Wars: A New War Begins", V "Pirates", VI "Spartans").
- [x] `archive-contrast.test.ts` passes for every edition in both schemes.
- [x] `pnpm format:check && pnpm gate` passes.

## Comments
- 2026-09-30 [SOURCES]: headers and posters on each wiki page, read-only in the Claude Code browser: 2016 Uncle Sam "I Want You", 2017 Rosie "We Can Do It!", 2018 blue beer-label parody, 2019 Star Wars "A New War Begins", 2020 pirate-skull engraving ("War Week V"), 2021 Spartan helmet on red, 2022 retro Karate Kid poster, 2023 Hogwarts at night, 2024 AC/DC-style "Back in Black", 2025 Survivor logo over jungle.
- 2026-09-30 [PREVIEW]: rendered every edition in light and dark Display before and after; accents adjusted after the first pass (III pale blue, VI black, VII rust) because the page's top block uses the accent. VI's red is the brightest (#6a1510) that keeps muted text at 4.5:1.
- 2026-09-30 [CLOSEOUT]: branch `feat/27-archive-themes-from-wiki`. `seeds/i.json`–`x.json` themes; archive smoke reads VIII's primary from the database instead of hard-coding it; `e2e/theme.spec.ts` uses VII as its light-base edition (X is now dark-base). Gate: `test-results/27/gate.txt` passed format, typecheck, lint, 3058 unit, build and 201 smoke, with one e2e failure (the X light-base test); after the fix `test-results/27/gate-rerun.txt` passed format, typecheck, lint and 43 e2e. Theme fields are setup data: a plain Seed reload applies them (and overwrites any theme edits made in /admin/setup for those editions).


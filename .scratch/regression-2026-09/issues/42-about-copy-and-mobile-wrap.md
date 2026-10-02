# 42: About says what the app is, once, and fits a phone

**What to build:** Rewrite `/about`'s copy (`src/app/about/page.tsx`, `ABOUT_FEATURES` in `src/lib/about.ts`) to sell the JG War Week app as the one place for War Week at Jahnel Group: no hackathon leftovers, no redundancy, no over-promise on history, no "no code" or light/dark selling. Fix the hero paragraph overflowing on a phone.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's public-pages review, 2026-10-01, items 1, 2, 4–14

## Need

- **Participant / Organizer (first visit):** About should tell them in a minute what the app is and what it does. Today it repeats itself ("Why it exists" vs "Why we built this", spreadsheets vs scattered history), sells table stakes (no code, light and dark), over-promises history, and pitches maintainers (GitHub, maintainer's guide) on a page for players.
- **Anyone on a phone:** the hero paragraph is cut off horizontally and can't be scrolled (the root has `overflow-hidden`).

## Decisions

Approved copy is quoted; write it as given.

- **Headline:** "Everything War Week, in one place." (replaces "Run War Week in one place, and keep every year of it.").
- **Hero paragraph:** keep only "The JG War Week app is where Jahnel Group runs War Week: the Story Theme, the schedule, the players, the Competitions, the points and the Finale, on every phone in the building." Remove "Organizers set it up with no code…" and "Every edition works in light and dark…"; no replacement. ("the Teams" → "the players", see mode-neutral below.)
- **One "Why we built this" section** replaces both "Why it exists" (its three problem cards, Competiscore included, and its closing paragraph) and the old "Why we built this":

  > War Week has run at Jahnel Group every year since 2016. Each year, the schedule, the Teams, the rules and the points were spread across a wiki page, Slack and a scoring tool, and Organizers spent the week answering what's on, where, and who's winning.
  >
  > The JG War Week app is the one place for all of it. Organizers and Hosts run the week here, everyone else follows along from their phone, and past War Weeks are a tap away.

- **"What it does": six key-feature cards**, one or two sentences each, in the app's navigation order with setup first:
  1. Organizer and Host setup (Admin)
  2. Schedule, Now and Next (Home, Schedule)
  3. Points and Standings (Leaderboard)
  4. Announcements (News)
  5. Competitions: Brackets and Games (More → Competitions)
  6. The Archive (History)

  Drop "One War Week live at a time" and "Ask Claude" (cards and their `public/about/lifecycle.png`, `ask-claude.png`). Remove "Every still below is the app on the seeded demo War Week." Keep the Finale block; keep the install line, shortened. Card slugs for the new cards are this ticket's call; ticket 43 regenerates every still against them (until then, reuse the closest existing PNG).
- **Mode-neutral copy:** the page describes the app in any year, Teams or free-for-all (XII is free-for-all). E.g. "you're highlighted wherever you appear", not "your Team is highlighted".
- **Closing section:** keep the "Open War Week …" button and "Sign-in is Google, @jahnelgroup.com accounts only."; drop the maintainer's guide button and the "source is on GitHub" sentence (the footer already links GitHub). Delete `MAINTAINERS_GUIDE_URL` if nothing else uses it.
- **No hackathon marketing** anywhere on the page; keep the header kicker "Jahnel Group War Week · since 2016" and the metadata description in line with the new copy (no "every War Week since 2016" promise).
- **Mobile:** at 390px no text is cut off and the page has no horizontal scroll; diagnose the overflow (likely a hero grid item sized by `AboutStandingsDemo`) rather than hiding it.
- Update `src/app/about/page.test.tsx` (it currently expects "Competiscore" once).

## Acceptance criteria

- [ ] `/about` shows the approved headline, hero paragraph and "Why we built this" text verbatim, and contains none of: "no code", "light and dark", "Competiscore", "spreadsheets", "The history is back", "maintainer's guide", "Every still below", "Why it exists".
- [ ] "What it does" has exactly the six cards above, in that order, each one or two sentences.
- [ ] No copy assumes Teams mode.
- [ ] At 390×844, `document.documentElement.scrollWidth <= clientWidth` on `/about` and the hero paragraph wraps fully; screenshot under `test-results/r7-public-pages/about-390/`. Same at 1440×900 under `about-1440/`.
- [ ] `src/app/about/page.test.tsx` asserts the removed phrases are absent and the six cards are in order.
- [ ] `pnpm gate` passes.

## Comments

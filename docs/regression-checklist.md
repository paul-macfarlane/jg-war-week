# Regression checklist

A pass to run each year before War Week (and after any change to the pages
it covers), so stale themes, stale copy and phone overflow are caught without
re-discovering what to look at. An agent can run it line by line: each line
says how to check it.

## Setup

- Seed the current edition's demo and build: `docker compose up -d`, then
  `pnpm build && pnpm seed:demo:<edition>` (e.g. `pnpm seed:demo:xii`), then
  `pnpm start`. The demo makes `<edition>` the one live War Week, so it is
  the "current War Week" (`getCurrentWarWeek`: live, else next upcoming,
  else latest complete) every themed page reads.
- **Viewports:** run every line at laptop **1440×900** and iPhone
  **390×844**.
- **Theme check:** a page "wears the current War Week" when its themed root
  (`[data-theme-root]`) carries the inline `--light-*`, `--dark-*` and
  `--font-sans` of `warWeekThemeStyle` (`src/lib/theme.ts`) for the current
  War Week, taken from `seeds/demo/<edition>.json`'s colors and font (or, to
  compare against the app itself, sign in and read `/<edition>`'s root,
  since `/<edition>` is not public), and the screenshot shows that
  edition's colors and font, not a past edition's.
- **No horizontal scroll:** on each page,
  `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
  That alone cannot catch clipping (`/about`'s root has `overflow-hidden`),
  so also check that no visible text element (`h1,h2,h3,p,li,a,button,span`)
  has a `getBoundingClientRect()` that extends past the viewport's left or
  right edge.
- Save a screenshot per page per viewport under
  `test-results/<work-package>/<page>-<width>/` and record each line's result
  in the ticket's closeout.

## Public Pages

`/sign-in`, `/about`, `/privacy`, `/terms`, signed out.

- [ ] **Sign-in wears the current War Week.** Open `/sign-in`; its colors
      and font match the current War Week (theme check above).
- [ ] **About wears the current War Week, stills included.** Open `/about`;
      the page passes the theme check, and every still (the hero Standings,
      the Finale poster and each "What it does" card) shows the current
      War Week's colors, not a past edition's. If not, refresh them:
      `pnpm build && pnpm seed:demo:<edition>`, then
      `pnpm tsx scripts/about-media.ts`.
- [ ] **About is up to date, without redundancy or salesy copy.** Read
      `/about` against the app today: every "What it does" card describes a
      feature that exists, in the app's navigation order; nothing is said
      twice; no hackathon leftovers, maintainer pitch or over-promise; no
      copy assumes Teams mode (the current War Week may be free-for-all).
- [ ] **Privacy and Terms are up to date and name the admins.** Read
      `/privacy` and `/terms`: everything they say is true of the app today,
      nothing is said twice, they pass the theme check, and the contact line
      reads "Contact the Jahnel Group admins."
- [ ] **Footer shows the current year.** Every public page's footer reads
      "© <this year> Jahnel Group".
- [ ] **Nothing is cut off on a phone.** At 390×844, every public page passes
      the no-horizontal-scroll check, and no text is clipped (read the
      screenshot: every heading and paragraph wraps fully).

## Later sections

Admin, Competitions and the other areas get their own sections here as
regressions are found in them.

# 44: Privacy and Terms wear the current War Week and name the Jahnel Group admins

**What to build:** `/privacy` and `/terms` follow the current War Week's Appearance Theme, as `/about` and `/sign-in` do, instead of the hardcoded XI Matrix `STATIC_PAGE_THEME`; their contact line becomes "Contact the Jahnel Group admins."

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's public-pages review, 2026-10-01, items 15 and 16

## Need

- **Anyone reading them:** Privacy and Terms still look like XI (Matrix green on black) while the rest of the app wears XII.
- **Anyone with a data question:** the admins are who can act on it, not "the War Week Organizers or Jahnel Group".

## Decisions

- Read the current War Week (`getCurrentWarWeek`: live, else next upcoming, else latest complete), `export const dynamic = "force-dynamic"`, fall back to `ABOUT_FALLBACK_THEME` with no War Week, exactly like `/about`. Delete `STATIC_PAGE_THEME`.
- Both pages stay in `PUBLIC_PATHS`; no access change.
- Privacy's "Corrections or removal" and Terms' contact line read "Contact the Jahnel Group admins."; "Last updated" on both becomes the ship date.
- Check the rest of both pages' copy is still true of the app today (avoid redundancy); no other rewrites unless something is wrong.

## Acceptance criteria

- [ ] With the XII demo current, `/privacy` and `/terms` render in XII's colors and font; with no War Week, in `ABOUT_FALLBACK_THEME`. Unit tests cover both.
- [ ] `STATIC_PAGE_THEME` no longer exists.
- [ ] Both pages say "Contact the Jahnel Group admins." and no longer mention "War Week Organizers or Jahnel Group".
- [ ] No horizontal scroll at 390×844; screenshots at 390×844 and 1440×900 under `test-results/r7-public-pages/privacy-*/` and `terms-*/`.
- [ ] `pnpm gate` passes.

## Comments

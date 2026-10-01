# 30: Admin header and section nav on a phone

**What to build:** On a phone, `/admin` gets a one-row header and a fixed bottom section bar with a More Sheet, like the participant side. The desktop side column stays as it is.

**Blocked by:** none

**Status:** in-progress

**Source:** mobile regression pass 2026-09-30 (ticket 18)

## Need

- **Organizer, Host:** At 375x812 the header in `src/components/admin-shell.tsx` wraps into 4 rows, 173px (209px with the "Editing the Archive" banner), before any content: title and Story Theme, the edition switcher, "Back to War Week" and the Display menu, then the email and Sign out. The section nav below it is a sideways-scrolling strip 920px wide: about 2.5 of 8 sections show, the current one isn't scrolled into view (on Setup, Announcements, Awards and Organizers it's offscreen), and nothing is sticky. An Organizer entering points at the event can't see where they are or get to another section with one thumb.
- The participant side already solves this: a fixed bottom tab bar with a More Sheet (`BottomTabBar` in `src/components/primary-nav.tsx`, `src/components/more-menu.tsx`).

## Decisions

- Phone means below `md`, the breakpoint the admin shell already uses for its side column. From `md` the header and side column render exactly as today.
- Bottom bar tabs: Overview, Points (label for Points Entries), Announcements, Setup, More. The same four for Organizers and Hosts.
- More Sheet (a shadcn `Sheet`, `side="bottom"`, like the participant More): the remaining sections the viewer may open (Organizer: Guide, Finale, Awards, Organizers; Host: Guide, Finale), then the edition switcher (when there's more than one edition), Display, "Back to War Week <Edition>", and "Signed in as <email>" with Sign out. Reuse the `MoreMenu` row styling; don't hand-roll a menu.
- Header below `md`: one row holding "War Week <Edition> admin" (linked to `/admin`) and nothing that wraps. The Story Theme, edition switcher, back link, Display, email and Sign out move into the More Sheet.
- The "Editing …" banner (`editingBanner`) stays, under the header.

## Acceptance criteria

- [ ] At 375x812 the admin header is one row, at most 56px tall; with the banner, header plus banner is at most 96px.
- [ ] Below `md` a bottom bar is fixed to the viewport (with `env(safe-area-inset-bottom)` padding) on every `/admin` page, with the tabs above. The current section's tab is marked `aria-current="page"` and highlighted; for a section inside More (Guide, Finale, Awards, Organizers), the More tab is highlighted and the section is highlighted in the Sheet.
- [ ] A Host sees no Awards or Organizers anywhere in the bar or the Sheet (the `organizerOnly` rule in `SECTIONS` still decides).
- [ ] The More Sheet closes after a link in it navigates, as the participant one does.
- [ ] Nothing hides under the bar: `main` and the footer get bottom padding for the bar, and toasts (the `Toaster` in the shell) show above it.
- [ ] Both navs keep `aria-label="Admin sections"` (smoke checks it in `scripts/smoke/admin.ts` and `scripts/smoke/hosts.ts`), or smoke is updated to match.
- [ ] From `md` the header, side column and content render as today (compare a 1280px screenshot before and after).
- [ ] `src/components/admin-shell.test.tsx` covers: Host sections hidden in the bar and Sheet; the More tab marked current for an in-More section.
- [ ] Playwright: an Organizer at 375px on `/admin/setup` sees Setup current in the bar, opens More, goes to Awards, and the Sheet closes; a Host at 375px sees no Awards or Organizers. Screenshots at 375px and 1280px under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-30: claimed by `/atlas-implement` (work package `regression-r5`), `ready-for-agent` → `in-progress`; branch `feat/regression-r5-admin-on-a-phone` from `staging` `50acefb`. Execution record: `../epics/R5-execution.md`.

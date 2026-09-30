# 32: Admin lists fit a phone; free-for-all drops Team

**What to build:** Below `md`, the Points ledger, Announcements and Awards lists render each row as a stacked card with its actions in view. In a free-for-all War Week, Awards and Points Entry stop asking about a Team.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** mobile regression pass 2026-09-30 (ticket 18)

## Need

- **Organizer, Host:** At 375px the tables scroll sideways and hide their actions:
  - Points ledger (`src/app/admin/points/page.tsx`): the table is 874px wide in a 343px column, rows are about 140px tall because Note wraps, and Entered by, Entered at and Edit are offscreen.
  - Announcements (`src/app/admin/announcements/page.tsx`): 776px wide, with Edit, Pin/Unpin and Delete offscreen.
  - Awards (`src/app/admin/awards/page.tsx`): Edit and Delete sit at the far right.
  - The Edit links on all three are 21-24px text links.
- **Organizer:** Awards shows a Team column (headed with the Team Label) in a free-for-all War Week; XII is free-for-all with no Teams.
- **Organizer, Host:** The Points Entry form's target field reads the Team Label before a Competition is chosen, even in a free-for-all War Week (`src/components/points-entry-form.tsx:162`). It should read "Participant" there.

## Decisions

- Below `md`, each list is a `<ul>` of cards (shadcn `Card`, as `standings.tsx` uses); from `md` the tables stay as they are. No new shadcn component needed.
- Ledger card: Competition and Awarded to, Points prominent; Note in full (the Bracket/Games badge as today); "Entered by <email> · <time>", then "edited <time>" when set; actions (Edit and Delete, or "Change in Games" / "Change in the Bracket").
- Announcement card: Title with the Pinned badge; Posted by; Published; Videos only when above 0; Edit, Pin/Unpin and Delete under today's permission rules (`mayChange`, `isOrganizer`).
- Award card: Name; Team when shown; Participants; Edit and Delete.
- Edit links on these three pages use `buttonVariants({ variant: "outline" })` and are at least 44px tall below `sm`. (Delete and Pin sizes are ticket 34.)
- Team on Awards is hidden when the War Week's Mode is `free-for-all` and no Award in it has a Team. The Award form (`src/components/award-form.tsx`) hides its Team field in a free-for-all War Week unless the Award being edited already has a Team, so it can be cleared.
- `PointsEntryForm` takes the War Week's `mode` from both callers (`src/app/admin/points/page.tsx`, `src/app/admin/points/[id]/page.tsx`). Before a Competition is chosen, the label and `aria-label` read "Participant" in a free-for-all War Week and the Team Label otherwise. After a choice they follow the Competition's scoring, as today.

## Acceptance criteria

- [ ] At 375px on XI, `/admin/points`, `/admin/announcements` and `/admin/awards` have no horizontal scroll (page and list), and every row's actions are visible without scrolling sideways.
- [ ] From `md` the three tables render as today.
- [ ] Edit links on the three pages are at least 44x44px below `sm`.
- [ ] On a free-for-all War Week with no Team on any Award (e.g. seeded I or XII), `/admin/awards` has no Team column or card line and the Award form has no Team field; on XI (teams) both show.
- [ ] Points Entry form on a free-for-all War Week reads "Participant" before a Competition is chosen; on XI it reads the Team Label. Unit render test for both.
- [ ] Playwright screenshots of the three pages at 375px and 1280px under `test-results/e2e/<test>/` (create an Award in the test if the seed has none).
- [ ] `pnpm gate` passes.

## Comments

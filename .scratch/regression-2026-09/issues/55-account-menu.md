# 55: An avatar account menu, everywhere

**What to build:** Replace the header's email text, `DisplayMenu` and Sign out (desktop) and the More sheet's "Signed in as" and Display rows (phone) with one **account menu**: an avatar button (initials until ticket 60 adds pictures) in the top-right of the participant header and the admin header, at every width, opening: your name and email, **Profile** (added by ticket 60; not shown before then), **Display** (Light / Dark / System), **Admin** (when you're an Organizer or Host; in admin it reads "Back to War Week"), **Join the Slack channel** (when the War Week has a Slack URL), **Sign out**.

**Blocked by:** 54

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, P2; grilling Q2, Q5

## Decisions

- shadcn `dropdown-menu` (or `menu`) via `pnpm dlx shadcn@latest add`, portaled through `ThemeRoot`; on phones it may use the same component (a menu is fine on a phone; no sheet needed).
- Admin's header keeps a visible "Back to War Week" link on desktop; on phones it's in the menu.
- Home's "Join the Slack channel" button is removed (moves here).
- Display stays stored per device (`ww:display`).

## Acceptance criteria

- [ ] Header at 1440×900 and 390×844, participant and admin: avatar only on the right; the menu has the items above for an Organizer, and no Admin item for a plain Participant. Screenshots of the open menu.
- [ ] Display change from the menu still updates every themed page (existing e2e adjusted).
- [ ] Keyboard: the menu opens with Enter, items reachable by arrows, Escape closes.
- [ ] `pnpm gate` passes.

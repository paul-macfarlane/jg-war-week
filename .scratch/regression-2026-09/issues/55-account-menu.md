# 55: An avatar account menu, everywhere

**What to build:** Replace the header's email text, `DisplayMenu` and Sign out (desktop) and the More sheet's "Signed in as" and Display rows (phone) with one **account menu**: an avatar button (initials until ticket 60 adds pictures) in the top-right of the participant header and the admin header, at every width, opening: your name and email, **Profile** (added by ticket 60; not shown before then), **Display** (Light / Dark / System), **Admin** (when you're an Organizer or Host; in admin it reads "Back to War Week"), **Join the Slack channel** (when the War Week has a Slack URL), **Sign out**.

**Blocked by:** 54

**Status:** done

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

## Comments

- 2026-10-02 [AI CODE REVIEW] (atlas-implement): Two fresh Opus reviewers read `0e19fa6..d7c4096`, one per axis. The orchestrator adjudicated each finding against the cited hunks; the full record is in `../epics/R9-execution.md` [AI CODE REVIEW]. One blocking finding: F2, settings autosave wrote the whole row and could revert a newer Winner. It was fixed in `aae6856`/`6360357` with partial saves merged over the locked row. Every non-blocking finding was fixed or approved as a deviation.
- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/114. Branch `feat/regression-r9-navigation`; worker D55 (Sonnet), commit `9b6d277`; orchestrator fix `a814715` (admin phone header ≤56px); review fixes `aae6856`.
  - AC1 PASS: the avatar only, top right, in the participant and admin headers at 390×844 and 1440×900. The menu has name/email, Display, Admin (or "Back to War Week" in admin; links `/admin/points`), Slack, Sign out; no Admin for a plain Participant. Covered by `e2e/regression-r9-account.spec.ts`; screenshots `account-menu-participant-*`, `account-menu-plain-*`, `account-menu-admin-*`. No Profile item (ticket 60).
  - AC2 PASS: `e2e/theme.spec.ts` changes Display through the menu and every themed page follows.
  - AC3 PASS: e2e: Enter opens, arrows move, Escape closes and returns focus.
  - AC4 PASS: gate at `6360357`.
  - Accepted deviation: the admin header shows the email's local part, not the roster name, until ticket 60.

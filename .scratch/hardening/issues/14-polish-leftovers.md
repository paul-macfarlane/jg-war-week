# 14: Polish leftovers

**What to build:** The remaining user-facing rough edges from `.scratch/war-weeker/issues/34` and the accepted custom-inputs polish.

**Blocked by:** 12 (the forms change first)

**Status:** ready-for-agent

## Scope

- `/about` top bar says "Sign in" to a signed-in user (`src/app/about/page.tsx:47-53`). It stays static (no session read), so show a neutral "Open JG War Week" link instead.
- `/xi/teams` cards show a bare member count (`src/components/roster.tsx:91`). Label it ("8 Participants").
- "Delete 1 pts" becomes "Delete 1 point" (`src/app/admin/points/page.tsx:165`).
- Announcements show the author's full email (`src/components/announcement-card.tsx:34`). Show the Participant display name when account linking matches, else the part before `@`.
- Native scrollbars stay light on dark Appearance Themes. Set `color-scheme` from the theme.
- Re-check visually and close if already fixed:
  - save confirmations on the War Week and Days setup (custom-inputs Phase B added toasts)
  - the rich-text toolbar's active state
- custom-inputs Phase C:
  - long badges clip instead of wrapping
  - home skeleton padding
  - the Avatar accent outline
- Finale: reduced motion still needs a Start press. Keep that; the ceremony needs a deliberate start. Record the decision in CONTEXT.md "Finale rules".
- Only the newest pinned Announcement shows on home. Keep it (accepted); no change.

## Acceptance criteria

- [ ] Before and after screenshots per item under `test-results/`.
- [ ] `/about` and the maintainers guide are updated where copy changed.
- [ ] `pnpm gate` passes.

## Comments

# 13: Decide how /admin is themed

**What to build:** Editing next War Week in last year's theme feels odd. Paul noted this may be moot.

**Blocked by:** none

**Status:** wontfix

**Source:** regression feedback item 8

## Notes

Recommendation from triage: theme /admin by the War Week being edited (doubles as a preview) and make sure /admin opens on the upcoming War Week. **Needs info:** confirm whether this is still a problem.

## Acceptance criteria

- [x] Decision recorded; if kept, /admin uses the edited War Week's theme and opens on the upcoming one.

## Comments

**2026-09-28, Claude (grill-with-docs):** Likely moot once ticket 12 lands (every theme works in the viewer's preferred mode). Revisit after 12.
- 2026-09-29 (Paul): confirmed moot at R2 plan approval: after R2, `/admin` follows the viewer's own light or dark Display like every other page. Closed as `wontfix` in R2's closeout (`../epics/R2-execution.md` decision 11, E-1).
- 2026-09-30 [CLOSEOUT]: closed `wontfix` (moot) by Epic R2: `/admin` now follows the viewer's own Display like every other page, and already opens on the current War Week for an Organizer. Paul confirmed at R2 plan approval. PR https://github.com/paul-macfarlane/jg-war-week/pull/94.

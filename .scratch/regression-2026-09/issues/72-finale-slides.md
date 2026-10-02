# 72: The Finale becomes a slideshow

**What to build:** `/[edition]/finale` becomes a sequence of full-screen **Finale slides** the Organizer steps through on the projector (Space, →, click: next; ←: back; Escape: exit to the first slide). Each War Week has an ordered slide list the Organizer reorders (drag, with keyboard alternatives) and hides in admin → Finale. This ticket ships the framework and one slide: the **Standings countdown** (today's Finale, unchanged, playing when its slide starts). Tickets 73 and 74 add the rest.

**Blocked by:** none

**Status:** ai-review

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A4; grilling Q19, Q27

## Decisions

- The Finale rules hold: it never reorders or recomputes Standings; nothing auto-advances; reduced motion skips animations but still waits for the presenter.
- Slide order and hidden flags stored per War Week (schema); a War Week with no saved list uses the default order: Title, By the numbers, Awards, Champions, Standings countdown, Winner.
- The Bracket Finale is unchanged.
- Viewers other than the presenter just see the slideshow; no sync between screens.
- CONTEXT.md: **Finale** and **Finale slide**; Finale rules updated.

## Acceptance criteria

- [ ] Unit tests for the slide-list resolution (default, reordered, hidden).
- [ ] e2e: an Organizer moves the Standings slide and hides one; the Finale plays in that order; the existing "Finale plays to first place" e2e passes through the slideshow.
- [ ] `pnpm gate` passes.

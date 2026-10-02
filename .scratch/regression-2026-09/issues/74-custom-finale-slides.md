# 74: Custom Finale slides

**What to build:** In admin → Finale, an Organizer adds **Custom slides** (heading, rich text with the ticket 64 editor including images and video, optional background color from the War Week's palette or a custom color that passes contrast) and places them anywhere in the order, edits and deletes them.

**Blocked by:** 72, 64 (editor)

**Status:** ai-review

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** grilling Q19, Q27

## Acceptance criteria

- [ ] e2e: add a custom slide with an image between Awards and Standings; the Finale shows it there.
- [ ] Contrast of a custom background with text passes (axe or the theme contrast helper).
- [ ] `pnpm gate` passes.

# 107: About page: a Finale sizzle video

**What to build:** The About page's closing-ceremony highlight shows a short sizzle video of the Finale instead of (or as well as) the still poster, captured from the seeded demo like the other About media, in both Display schemes.

**Blocked by:** none

**Status:** needs-info

**Priority:** low (Paul: in scope, after the Competition work)

**Source:** Paul's regression feedback 2026-10-03 (Public: closing ceremonies video); grilling Q15

## Notes

- Today the still is deliberate: `src/components/about-finale-demo.tsx` says "not a looping video" and `src/app/about/page.test.tsx:99` asserts no `<video>`; both change.
- Paul has done this for the journeys app; **needs info:** where that implementation lives, to reuse its capture and playback approach.
- Respect reduced motion (show the poster); keep page weight reasonable.

## Acceptance criteria

- [ ] `scripts/about-media.ts` writes the video in light and dark; `/about` plays it muted and looping, and shows the poster under reduced motion.
- [ ] `pnpm gate` passes.

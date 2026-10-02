# 64: The Announcement editor matches journeys

**What to build:** Bring the rich-text editor (`src/components/rich-text-editor.tsx`, `src/lib/rich-text/extensions.ts`, the content schema and sanitizer in `src/lib/rich-text/content.ts`, and the server viewer `src/components/rich-text.tsx`) up to the journeys editor (`../journeys/src/components/journeys/rich-text-editor.tsx`, `../journeys/src/lib/rich-text/`): headings H1–H3, underline, strikethrough, quotes, image captions, the image tools menu, keyboard shortcuts (with their hints) and a placeholder. Keep the video node. Images can be uploaded (Vercel Blob, from ticket 60) as well as added by URL.

**Blocked by:** 60 (Blob storage)

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-01, A5; grilling Q15

## Decisions

- The closed content set grows to journeys' set plus video; the zod schema and sanitizers (write and render) grow with it, and existing stored content stays valid.
- Heading levels render under the page's `h1` the way journeys normalises them.
- Port journeys' editor tests (`extensions`, `insert-image`, `placeholder`, `shortcuts`).
- Used everywhere the editor is (Announcements now; custom Finale slides in ticket 74).

## Acceptance criteria

- [ ] Ported unit tests pass; the sanitizer keeps every new mark/node and strips anything else.
- [ ] e2e: an Organizer posts an Announcement with a heading, a quote, an uploaded captioned image and a video; the participant page renders all four. Screenshots at both viewports.
- [ ] `pnpm gate` passes.

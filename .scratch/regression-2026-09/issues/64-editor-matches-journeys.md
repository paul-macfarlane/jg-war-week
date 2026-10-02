# 64: The Announcement editor matches journeys

**What to build:** Bring the rich-text editor (`src/components/rich-text-editor.tsx`, `src/lib/rich-text/extensions.ts`, the content schema and sanitizer in `src/lib/rich-text/content.ts`, and the server viewer `src/components/rich-text.tsx`) up to the journeys editor (`../journeys/src/components/journeys/rich-text-editor.tsx`, `../journeys/src/lib/rich-text/`): headings H1–H3, underline, strikethrough, quotes, image captions, the image tools menu, keyboard shortcuts (with their hints) and a placeholder. Keep the video node. Images can be uploaded (Vercel Blob, from ticket 60) as well as added by URL.

**Blocked by:** 60 (Blob storage)

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A5; grilling Q15

## Decisions

- The closed content set grows to journeys' set plus video; the zod schema and sanitizers (write and render) grow with it, and existing stored content stays valid.
- Heading levels render under the page's `h1` the way journeys normalises them.
- Port journeys' editor tests (`extensions`, `insert-image`, `placeholder`, `shortcuts`).
- Used everywhere the editor is (Announcements now; custom Finale slides in ticket 74).

## Acceptance criteria

- [x] Ported unit tests pass; the sanitizer keeps every new mark/node and strips anything else.
- [x] e2e: an Organizer posts an Announcement with a heading, a quote, an uploaded captioned image and a video; the participant page renders all four. Screenshots at both viewports.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-02 [SCOPE CHANGE] (Paul): images by URL only in R11; no upload and no Blob (R10 shipped without Blob, so "Blocked by: 60 (Blob storage)" no longer holds). AC2's "uploaded captioned image" becomes "a captioned image added by URL". Upload returns with Blob in a later ticket. Plan: `../epics/R11-execution.md`.

## [AI CODE REVIEW]

See `../epics/R11-execution.md` [AI CODE REVIEW] (one review for the epic, both axes; no open blocking findings).

## [CLOSEOUT]

2026-10-02, branch `feat/regression-r11-content`. AC1 PASS (`src/lib/rich-text/*.test.ts`, `src/components/rich-text.test.tsx`); AC2 PASS (`e2e/regression-r11-editor.spec.ts`, captioned image by URL per the scope change; screenshots under `test-results/e2e/regression-r11-editor-*/`); AC3 PASS (`test-results/r11-content/gate-final.txt`). Commits `d30033c`, `565ca74`, `de713eb`. Full record: `../epics/R11-execution.md` [CLOSEOUT].

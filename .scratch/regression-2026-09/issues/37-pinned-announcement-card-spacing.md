# 37: Pinned Announcement card fits its content

**What to build:** The pinned Announcement on a War Week's home page is only as tall as what it says.

**Blocked by:** none

**Status:** done

**Source:** mobile regression pass 2026-09-30 (ticket 18)

## Need

- **Participant:** On staging `/xii` at 375px, the pinned Announcement card shows a one-line Announcement above mostly empty space. It's the first thing on the home page (`src/app/[edition]/(home)/page.tsx:87`), so the rest of the page drops below the fold.

## Decisions

- Find the cause before fixing it. `AnnouncementCard` (`src/components/announcement-card.tsx`) sets no height, so the likely cause is the body: empty paragraphs the editor saves (each one a line plus the `gap-3` in `src/components/rich-text.tsx`), or a video URL that renders nothing but still takes space. Fix it where it starts: if it's empty paragraphs, `RichText` skips leading and trailing empty paragraphs at render (stored content unchanged; no migration). Record the cause in the closeout.
- The same card on `/<edition>/news` gets the same fix.

## Acceptance criteria

- [ ] A one-line pinned Announcement's card at 375px is no taller than its header, the line and the card padding (under 160px without video).
- [ ] Unit test for the cause (e.g. `RichText` renders no element for leading or trailing empty paragraphs, and keeps empty paragraphs between text).
- [ ] Playwright screenshot of `/xii` (or a seeded War Week with a pinned one-line Announcement) at 375px under `test-results/e2e/<test>/`.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-30: claimed by `/atlas-implement` (work package `regression-r5`), `ready-for-agent` → `in-progress`; branch `feat/regression-r5-admin-on-a-phone` from `staging` `50acefb`. Execution record: `../epics/R5-execution.md`.
- 2026-09-30 [BLOCKED]: human gate H1. A one-line pinned Announcement made through the editor on XI stores one paragraph, no video, and its card is 112px at 375 on `/xi` and `/xi/news` (<160), so the cause on staging `/xii` is not reproduced and no code changed. Resume: Paul pastes staging `/xii`'s pinned Announcement `body` JSON and `video_urls` (or a 375px devtools screenshot of the tall element), then `/atlas-implement .scratch/regression-2026-09/epics/R5-admin-on-a-phone.md`; a local Announcement with that body must reproduce ≥160px before the fix. Alternative: Paul descopes 37 from R5 (it returns to `ready-for-agent` on its own).
- 2026-09-30 [AI CODE REVIEW]: D37 landed after the two-reviewer pass; the orchestrator reviewed its diff on both axes: no finding (paragraph content is text-only in the sanitized schema, so the empty check is safe). Full tables: `../epics/R5-execution.md` [AI CODE REVIEW].
- 2026-09-30 [CLOSEOUT]: D37 `4bee992` (Sonnet), after human gate H1 (scope change recorded in `R5-execution.md`); review fixes `f79549c`. Criteria 37-1 … 37-3 PASS; `pnpm format:check && pnpm gate` exit 0 at `4bee992` (`test-results/r5-gate/gate.txt`); screenshots `test-results/e2e/regression-r5-r5-37-*/`. PR https://github.com/paul-macfarlane/jg-war-week/pull/107. `in-progress` → `ai-review` → `done`. Details: `../epics/R5-execution.md` [CLOSEOUT].

# 09: Small UI and accessibility bugs

**What to build:** Fix the confirmed small bugs carried over from `.scratch/war-weeker/issues/34` and `.scratch/custom-inputs/execution.md`.

**Blocked by:** none

**Status:** done

## Scope

- **Archive contrast** (axe on `/history`, `/x`, `/i`): `text-foreground/60` in `src/components/archive.tsx:179,195`, the Survivor label, War Week I's orange links.
- **Focus after deleting a setup row** falls to `body`; move it to a sensible neighbor. The delete dialog's `pending` state never shows (`setup-row.tsx`, `ConfirmDialog`).
- **The `/admin/announcements` Videos column** ignores videos embedded in the body (`src/app/admin/announcements/page.tsx:55`).
- **A disabled Switch's label isn't dimmed; the Scoring select can show raw `team` in free-for-all** (custom-inputs Phase A).

## Acceptance criteria

- [x] axe reports no contrast violations on `/history`, `/x`, `/i` (screenshot and axe output under `test-results/`).
- [x] After deleting a setup row, focus lands on the next row, or on the Add button when the list is empty.
- [x] The Videos count includes embedded videos (unit test on the count helper).
- [x] `pnpm gate` passes.

## Comments

**2026-09-26, Claude (atlas-implement, epic A) — [CLOSEOUT]** Delivered by D09 (worker: opus, `926a1bb`), plus orchestrator fix `e2ed4ee` (the Archive card footer's wiki link on `bg-muted/50`, which axe caught at 4.03–4.19:1) and review fix `86b1af6` (an emptied list focuses the Add button).
- Contrast: a `--primary-text` token, contrast-safe `--accent-foreground`, and `text-muted-foreground` in the archive, hero, nav and footer. `src/lib/archive-contrast.test.ts` checks every seed's pairs, including the card footer. Approved interpretation: the fix reaches the nav, hero and footer that `/x` and `/i` render, and accent text flips to black on 7 of 11 past themes (XI unchanged).
- AC1 PASS: axe-core 4.13.0 finds 0 violations on `/history`, `/x` and `/i` at desktop and phone widths. axe couldn't parse the 4 `oklch(… none)` nodes it marked incomplete, so they were measured directly at 5.95:1 and 6.89:1. `test-results/hardening-a-axe/`
- AC2 PASS: focus lands on the next row's first control, or the Add Competition button when the list empties, and the confirm shows "Delete…" while pending. `test-results/hardening-a-focus/`. Interpretation: deleting the last row of a non-empty list focuses the previous row (unit-tested).
- AC3 PASS: `announcementVideoCount` in `src/lib/announcements.test.ts`, used on `/admin/announcements`
- AC4 PASS: `test-results/hardening-a-gate/gate.txt`
- Also: a disabled Switch now dims its label, and the Scoring select keeps its "team" option in a free-for-all War Week.
- PR: https://github.com/paul-macfarlane/jg-war-week/pull/78

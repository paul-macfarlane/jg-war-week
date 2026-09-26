# 09: Small UI and accessibility bugs

**What to build:** Fix the confirmed small bugs carried over from `.scratch/war-weeker/issues/34` and `.scratch/custom-inputs/execution.md`.

**Blocked by:** none

**Status:** in-progress

## Scope

- **Archive contrast** (axe on `/history`, `/x`, `/i`): `text-foreground/60` in `src/components/archive.tsx:179,195`, the Survivor label, War Week I's orange links.
- **Focus after deleting a setup row** falls to `body`; move it to a sensible neighbor. The delete dialog's `pending` state never shows (`setup-row.tsx`, `ConfirmDialog`).
- **The `/admin/announcements` Videos column** ignores videos embedded in the body (`src/app/admin/announcements/page.tsx:55`).
- **A disabled Switch's label isn't dimmed; the Scoring select can show raw `team` in free-for-all** (custom-inputs Phase A).

## Acceptance criteria

- [ ] axe reports no contrast violations on `/history`, `/x`, `/i` (screenshot and axe output under `test-results/`).
- [ ] After deleting a setup row, focus lands on the next row, or on the Add button when the list is empty.
- [ ] The Videos count includes embedded videos (unit test on the count helper).
- [ ] `pnpm gate` passes.

## Comments

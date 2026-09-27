# 14: Polish leftovers

**What to build:** The remaining user-facing rough edges from `.scratch/war-weeker/issues/34` and the accepted custom-inputs polish.

**Blocked by:** 12 (the forms change first)

**Status:** done

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

### [AI CODE REVIEW] Epic D (2026-09-27)

Two independent reviewers (opus) read `1c4d76d..136e5ba`; the orchestrator adjudicated each finding against the cited hunks. Fixes in R1 `72a8620`.

**Implementation and spec conformity**
- F1 **blocking**, resolved: the dark-scrollbar change put `color-scheme` on ThemeRoot (a non-scrolling div) while `:root` was forced `light`, so the viewport scrollbar stayed light (before/after screenshots were byte-identical). Now the edition layout's root carries `data-color-scheme`, `html:has([data-color-scheme="dark"])` lifts it; `e2e/theme.spec.ts` proves `/xi` dark, `/x` and `/history` light.
- F2 resolved: a refused setup-row Delete's error never cleared and masked later Saves.
- F3 resolved: React 19's post-action form reset blanked a focused `type="number"` Points input on an Enter-submitted refusal; Points is `type="text" inputMode="decimal"`, and the forms e2e submits with Enter and checks the value survives.
- F4 resolved: video links and Placement Points errors sat outside a `Field data-invalid` (no focus, no `aria-invalid`); rich-text fields focused the Bold button, now the editor.
- F5 resolved: unit tests for `fieldErrorsOf`, `formErrorOf`, `participantCountLabel`, `formatPointsLabel` (now worded from the shown number). **Deviation approved:** no e2e submits End War Week or Create next War Week (it would end or create a War Week mid-suite); smoke covers the actions and `ConfirmDialog`'s props are now a discriminated union.
- F6 resolved: End War Week's refusal no longer survives Cancel and reopen.
- F7 resolved: the rich-text label is `FieldTitle` (not a `<label>` labelling nothing).
- F8 resolved: Save Hosts added to the 12-AC1 keep-list; ticket 14 closeout below.
- F9 resolved: author matching uses `sameEmail` (now exported; `null` never matches).
- Coverage judged sufficient: the reviewer read every converted form, the helper and all ticket 14 items.

**Coding standards**
- S1 resolved: "member" (banned) in a comment → "Participant count".
- S2–S5 resolved: comments wrongly said MCP shows the author email (it shows the handle); one `authorHandle` and `AuthorCandidate` in lib shared by MCP and queries; dead re-export removed.
- S6 resolved: ADR 0004 "Built" section and a guide sentence record server-only validation and when a form closes over state vs reads `FormData`.
- S7 **deviation approved**: per-field `Field`/`aria-invalid`/`FieldError` wiring stays explicit, so each field visibly owns its error.
- S8–S10 resolved: `NextWarWeekActionResult` exported; settings input built key by key (no cast); `ConfirmDialog` union.
- S11 **deviation approved**: `expectRefused` stays local to each test file, as existing tests do.
- S12–S16 resolved: keep-list, `about-media.ts` header, import merge, CONTEXT.md author-display rule, duplicate skeleton PNGs removed.

Remaining risks: headless Chromium draws overlay scrollbars, so the scrollbar proof is the computed `color-scheme` on `<html>`, not pixels; admin and sign-in pages don't follow a dark theme (only the edition pages are themed wholesale).

### [CLOSEOUT] Ticket 14 (2026-09-27)

Branch `feat/hardening-d-forms-and-polish`, PR https://github.com/paul-macfarlane/jg-war-week/pull/81. Verified `pnpm gate` on `72a8620` (local Postgres 17, Chromium): exit 0; 82 files / 1411 tests; smoke 177 ok, 0 FAIL; e2e 22 passed — `test-results/hardening-d-gate/gate.txt`.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC1 before and after screenshots per item | PASS | `test-results/hardening-d-polish/<item>/`: about-top-bar, roster-count, points-delete-confirm, announcement-author, dark-scrollbar (+ `note.md`, `e2e/theme.spec.ts`), long-badge (+ `note.md`), home-skeleton, avatar-outline; re-checks closed as already fixed with one screenshot and `note.md`: setup-save-toasts, toolbar-active |
| AC2 `/about` and the guide updated where copy changed | PASS | "Open JG War Week"; all eight `/about` stills regenerated with `scripts/about-media.ts --stills` (Announcements now shows a name); guide "Change copy or text" paragraph; `test-results/hardening-d-docs/grep.txt` |
| AC3 `pnpm gate` | PASS | `test-results/hardening-d-gate/gate.txt` |

Decisions kept: reduced motion still needs a Start press (CONTEXT.md Finale rules); only the newest pinned Announcement shows on home (no change).

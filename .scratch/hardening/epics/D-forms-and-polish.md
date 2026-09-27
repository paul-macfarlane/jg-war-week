# Epic D: Forms and polish

**What to build:** The admin forms on `useActionState` + Zod, then the remaining user-facing polish, as one work package, one branch and one PR into `staging`.

**Tickets:** `12`, then `14` (files under `../issues/`)

**Branch:** `feat/hardening-d-forms-and-polish`

**Blocked by:** Epic C (its PR merged into `staging`)

**Status:** done

## Order

1. `12`: forms, the Zod field-error helper, the accessibility carry-overs.
2. `14`: polish on top of the new forms, with before and after screenshots.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] `/about` and `docs/maintainers-guide.md` match every user-visible change.
- [ ] `pnpm gate` passes locally and in CI.

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

### [CLOSEOUT] Epic D (2026-09-27)

Branch `feat/hardening-d-forms-and-polish`, PR https://github.com/paul-macfarlane/jg-war-week/pull/81. Verified `pnpm gate` on `72a8620` (local Postgres 17, Chromium): exit 0; 82 files / 1411 tests; smoke 177 ok, 0 FAIL; e2e 22 passed — `test-results/hardening-d-gate/gate.txt`.

| Criterion | Verdict | Evidence |
|---|---|---|
| Each ticket records its closeout and is `done` | PASS | tickets 12 and 14 (this commit) |
| `/about` and the maintainer's guide match every user-visible change | PASS | `test-results/hardening-d-docs/grep.txt`; `public/about/*.png` |
| `pnpm gate` passes locally and in CI | PASS locally; CI on the PR | `test-results/hardening-d-gate/gate.txt`; CI run recorded in `test-results/hardening-d-ci/runs.md` |

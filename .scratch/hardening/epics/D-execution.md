# Execution: Epic D (forms, then polish)

Epic: `D-forms-and-polish.md`. Tickets `../issues/12-forms-on-useactionstate-and-zod.md`, then `../issues/14-polish-leftovers.md`. Branch `feat/hardening-d-forms-and-polish` from `staging` `1c4d76d` (Epic C merged in #80). One PR into `staging`. Run surface: local + deployed (CI runs the gate on the PR; nothing deploys from this epic).

## Resolved decisions (execution, not contract)

- **Result shape.** A refusal may name fields: `WriteResult` / `Parsed<T>` failure becomes `{ ok: false; error: string; fieldErrors?: FieldErrors }` with `FieldErrors = Record<string, string>` (`src/lib/result.ts`). `error` stays the first message, so every existing consumer, action test and smoke assertion is unchanged; forms read `fieldErrors` when present.
- **The helper.** `src/lib/form-errors.ts`: `fieldErrorsFrom(error: ZodError, options)` → `{ error, fieldErrors }`, one message per top-level path key (first issue wins), worded by the existing label + "must …" rules. `parseWith` (lib/setup), `parsePointsEntryInput`, `parseAwardInput`, `parseAnnouncementInput`, `parseScheduleItemInput`, `parseFaqItemInput`, `parseClosingInput`, `parseNextWarWeekInput` all route their failure through it so the server's refusal carries the per-field map. Bracket parsers keep the first-message shape (their forms don't convert, below). Unit-tested.
- **Where validation runs.** On the server only. Actions keep their typed `(id, input)` signatures; the form's `useActionState` action is a client function `(prev, formData) => serverAction(id, inputFrom(formData))`. Native `required` / `maxLength` / `type` give the instant cases; everything else is one round trip, so every submit exercises the path the AC names ("a field error from the server"). "One schema shared by client and server" is met as one lib module: the action parses with it and the form imports its input type and field names, so a `fieldErrors` key always matches a rendered field.
- **FormData.** Native and shadcn-wrapper controls post named inputs; the wrapper reads them with `formData.get(name)`. `RichTextEditor` content (JSON) is closed over from React state; `EntityCombobox multiple` posts one hidden input per id (`formData.getAll`).
- **Field errors and focus.** `src/components/form-field-errors.tsx` (client): `Field` gets `data-invalid`, its control `aria-invalid`, and `FieldError` shows `fieldErrors[name]` under the field. After a refused submit, focus moves to the first `[data-slot=field][data-invalid=true]` in DOM order — its first focusable control (the `FOCUSABLE` selector from `setup-row.tsx` moves to the shared module). The form-level `FieldError` under the buttons keeps showing `error` when no field owns it.
- **Toasts.** Every converted form's success toasts "<Entity> saved" (create and edit alike; "Announcement posted" → "Announcement saved"; setup rows' "added" → "saved"). Buttons keep their verb (deleted, pinned, unpinned, started, reopened, "is in the Archive"); "War Week XII created" stays (a new edition, not an edit). Refusals keep the error toast plus the inline message.
- **Kept on `startTransition`, with the reason (12-AC1 record):**
  - `confirm-dialog` (`ConfirmActionButton`), `announcement-admin-buttons` (Pin/Unpin), `setup-schedule-faq-buttons` (Move up/down), `admin-edition-switcher`, the Start/Reopen buttons in `war-week-lifecycle-controls`: buttons with no fields; `useActionState` adds nothing.
  - `bracket-builder`: Format select, Entrants save, Generate and Clear are button-driven with a confirm-and-retry (`force`) loop and whole-form refusals; no per-field error exists to show.
  - `bracket-results`: a Heat Result is a winner button plus Save, gated by a reset confirm; its refusals are about the Heat, not a field.
  - `organizers-editor`, `competitions-editor` are not in ticket 12's list; `competitions-editor`, `days-editor`, `teams-editor` change only as callers of `useSetupRow`.
  - `ConfirmDialog` gains an optional `form` prop: the confirm button becomes `type="submit" form={id}`, so End War Week's fields (Winner, Highlights) post through `useActionState` while the dialog stays the one confirm.
- **Accessibility carry-overs** (ticket 12): the rich-text editor's visible "Body"/"Answer" text is its accessible name (`getByRole("textbox", { name: "Body" })`) and no `<label>` labels nothing; the editor's link, image and video panels use `Field`/`FieldLabel htmlFor`/`Input`/`FieldDescription`; the Participants/Entrants pickers' accessible name includes "(n chosen)"; `SuggestionCombobox` takes an `id` and its callers pass it with `htmlFor`; the settings form's ids are all `settings-<field>`.
- **Ticket 14 items:** `/about` header link "Open JG War Week" → `/`; roster "8 Participants" / "1 Participant"; the Points Entry delete confirm says "1 point" / "2.5 points"; Announcement cards show `authorName` (the War Week's Participant whose email matches the author's, case-insensitively, else the part before `@`; pure `announcementAuthorName` in `src/lib/announcements.ts`, composed in `src/queries/announcements.ts`; admin pages keep the email); `warWeekThemeStyle` adds `colorScheme` ("dark" when the background's contrast against white beats black) and `globals.css` sets `color-scheme` for `:root`/`.dark`; `Badge` wraps (`h-auto min-h-5 whitespace-normal`, no clipping); the home `loading.tsx` container matches `(home)/page.tsx` (`md:py-8`, no `px-4 py-6`); the Avatar's `after:` border ring goes (a Team-colored fill needs no outline); the Days-setup toasts and the toolbar active state are re-checked with a screenshot and closed if already fixed; CONTEXT.md "Finale rules" records that reduced motion still needs a Start press.
- **About media.** `public/about/announcements.png` shows the author email, so ticket 14 changes it; `scripts/about-media.ts` regenerates every still and the video and needs ffmpeg (absent here) — see Human gates.

## Structure: sequential, four deliverables, direct checkout

| Order | Deliverable | Owns | Model |
|---|---|---|---|
| 1 | **D0** foundation + reference: `src/lib/result.ts`, `src/lib/form-errors.ts` (+test), every `parse*` above routed through it (+tests), `src/components/form-field-errors.tsx`, `confirm-dialog.tsx` `form` prop, `points-entry-form.tsx` converted, `e2e/forms.spec.ts` (Points Entry case), `docs/maintainers-guide.md` form-control notes | opus |
| 2 | **D1a** `war-week-settings-form.tsx` (+ids), `next-war-week-form.tsx`, `war-week-lifecycle-controls.tsx` (End War Week), `e2e/forms.spec.ts` settings case | sonnet |
| 3 | **D1b** `announcement-form.tsx`, `award-form.tsx`, `faq-item-form.tsx`, `schedule-item-form.tsx`, `setup-row.tsx` (+ callers `days-editor`, `teams-editor`, `competitions-editor`), `rich-text-editor.tsx` panels + name, `suggestion-combobox.tsx` id, `bracket-builder.tsx` picker name, toast wording; 12-AC1 keep-list recorded on ticket 12 | sonnet |
| 4 | **D2** ticket 14: before screenshots on the D1b-integrated build, the changes, after screenshots; `test-results/hardening-d-polish/<item>/`; CONTEXT.md; `/about` + guide copy | sonnet |

Isolation: direct checkout, one worker at a time. D1a and D1b touch disjoint components; predicted shared files are only `e2e/forms.spec.ts` (D0 then D1a) and `docs/maintainers-guide.md` (D0 then closeout). Sequential was chosen to keep one `useActionState` pattern (D0 is the reference the others copy) and to skip worktree env/DB setup; the closeout re-checks whether D1a ∥ D1b would have collided.

## Verification map

| Criterion | Command / action | Real dependencies | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| 12-AC1 every in-scope component on `useActionState` or a recorded reason | `grep -ln useActionState src/components/*.tsx; grep -ln startTransition src/components/*.tsx` against the keep-list above (also recorded on ticket 12) | none | converted: points-entry, settings, next-war-week, lifecycle (End), announcement, award, faq, schedule, setup-row; kept: the listed ones only | `test-results/hardening-d-docs/grep.txt` | after D1b | `src/components/**` |
| 12-AC2 server field error under its field; focus on the first invalid field | `pnpm e2e` (`e2e/forms.spec.ts`): settings form Slack URL `http://…` → "Slack URL must be an https URL." under Slack URL and `document.activeElement` is that input; Points Entry points `9999999` → "Points must be at most 999999.99." under Points and focus on it; screenshots | local Postgres, built app, Chromium | 2 new tests pass | `test-results/e2e/forms-*/` | Points Entry after D0; settings after D1a; final after D2 | `src/components/**`, `src/lib/**`, `src/actions/**`, `e2e/**` |
| 12-UNIT the helper and each parser's field map | `pnpm test -- src/lib` | none | green; `form-errors.test.ts` covers first-issue-per-field, label + "must" wording, nested path → top key | `test-results/hardening-d-d0/vitest.txt` | after D0 | `src/lib/**` |
| 12-AC3 / 14-AC3 / E-AC3 gate | `pnpm gate` | local Postgres, built app, Chromium | exit 0; smoke 0 FAIL; e2e 19 passed (17 + 2) | `test-results/hardening-d-gate/gate.txt` | after D2 | any change |
| 14-AC1 before/after per item | `ls test-results/hardening-d-polish/*/` | built app at the pre-D2 commit for "before" | one dir per item with `before.png` and `after.png`; re-check items closed as fixed have one screenshot and a note | `test-results/hardening-d-polish/` | after D2 | the polished files |
| 14-UNIT author name, color scheme | `pnpm test -- src/lib/announcements src/lib/theme` | none | green | `test-results/hardening-d-d2/vitest.txt` | after D2 | those files |
| 14-AC2 / DoD-DOCS / E-AC2 showcase current | `grep -n "Open JG War Week" src/app/about/page.tsx`; guide mentions `useActionState`, the field-error helper and the author name; `public/about/announcements.png` regenerated by `scripts/about-media.ts` (and `schedule.png` if its pinned Announcement shows the author line) | ffmpeg + Chrome for the media | as stated | `test-results/hardening-d-docs/grep.txt`; the stills' commit | after D2 | `src/app/about/**`, `docs/maintainers-guide.md`, `public/about/**` |
| E-AC1 tickets `done` with closeout | `grep -n '^\*\*Status' .scratch/hardening/issues/{12,14}-*.md .scratch/hardening/epics/D-*.md` | none | all `done` | ticket files | closeout | ticket files |
| E-AC3 CI | the PR's CI run | GitHub CI | green, smoke and e2e included | `test-results/hardening-d-ci/runs.md` | after push | any change |

## Human gates

- **ffmpeg for the About media** (announced for D2's checkpoint; actionable now). Prerequisite: `brew install ffmpeg` on this Mac (Chrome is present). Human action: install it. Expected result: `ffmpeg -version` exits 0, so `pnpm tsx scripts/about-media.ts` can regenerate `public/about/*.png` and `finale.mp4` after D2. Post-check: the script runs and `git status` shows `public/about/announcements.png` changed. Without it, E-AC2's media half is `BLOCKED` with the attempted command, and the still is regenerated in a follow-up.

## Progress

- 2026-09-26: plan recorded; proof root cleared; epic and tickets 12, 14 claimed (`in-progress`).
- D0 accepted (`86ed6fb`, opus): `fieldErrorsFrom`, `form-field-errors.tsx`, `ConfirmDialog form`, Points Entry on `useActionState`, `e2e/forms.spec.ts` Points case. Orchestrator rerun of `src/lib`: 39 files / 1036 tests (`test-results/hardening-d-d0/vitest.txt`).
- D1a accepted (`8b433a3`, sonnet): settings (ids `settings-<field>`), next War Week, End War Week (form inside the confirm); settings e2e case.
- D1b accepted (`0fc11dc`, sonnet): Announcement, Award, FAQ, Schedule, setup rows; a11y carry-overs; "saved" toasts; keep-list on ticket 12. Its report claimed e2e 19/19, but `e2e/bracket.spec.ts` failed on `0fc11dc` (the Entrants picker's accessible name changed); D2 fixed the locator. Recorded as a D1b regression caught in D2, not a flake.
- D2 accepted (`e77de3f`, sonnet): every ticket 14 item with before/after under `test-results/hardening-d-polish/`; toasts and toolbar re-checked and closed as already fixed.
- Scope decision (operator, 2026-09-26): About media via a `--stills` flag on `scripts/about-media.ts`, not ffmpeg. Orchestrator commit `136e5ba`: the flag, all eight stills regenerated (the Announcements still now shows a name, not an email), a "refresh /about" paragraph in the maintainer's guide; run log `test-results/28-splash/`.
- Aggregate review started; epic and tickets `ai-review`.
- Aggregate review: 1 blocking (dark scrollbar never reached `<html>`) and 20 non-blocking; R1 `72a8620` (opus) fixed all but three approved deviations; see `[AI CODE REVIEW]` on the tickets.
- Verification on `72a8620`: `pnpm gate` exit 0 (82 files / 1411 tests; smoke 177 ok / 0 FAIL; e2e 22 passed). Evidence `test-results/hardening-d-{gate,docs,d0,polish}/`, `test-results/e2e/`.

## Isolation re-check

Predicted: D1a and D1b sequential to share one pattern, with `e2e/forms.spec.ts` and the guide as the only shared files. Actual (`git show --name-only 8b433a3` vs `0fc11dc`): no shared source file; the only overlap is e2e screenshots each rerun rewrote. The real constraint was shared mutable state — one local Postgres, port 3200 and one `.next` build that both workers' e2e runs needed — which parallel worktrees would have had to split (per-worktree database and port, as Epic C's D1 did). Next time: D1a ∥ D1b in worktrees with their own DB and port is safe.

## Closeout

| Deliverable | Worker / model | Commit |
|---|---|---|
| D0 field-error foundation, Points Entry | atlas-worker / opus | `86ed6fb` |
| D1a settings, next War Week, End War Week | atlas-worker / sonnet | `8b433a3` |
| D1b Announcement, Award, FAQ, Schedule, setup rows, a11y | atlas-worker / sonnet | `0fc11dc` |
| D2 ticket 14 polish | atlas-worker / sonnet | `e77de3f` |
| M1 `about-media --stills`, stills, guide | orchestrator | `136e5ba` |
| R1 aggregate review fixes | atlas-worker / opus | `72a8620` |

Deviations: `aria-invalid` props on the shadcn wrappers; state-sourced input in forms with rich-text or list fields; `about-media --stills` instead of ffmpeg (operator choice); no UI e2e for End War Week / Create next War Week; D1b's worker reported e2e green while `bracket.spec.ts` failed on its commit (fixed in D2). Every criterion PASS; see the `[CLOSEOUT]` records on the epic and tickets 12 and 14, all `done`. PR https://github.com/paul-macfarlane/jg-war-week/pull/81.

# Execution record: Epic R18, the admin Competition page

Contract: [`R18-admin-competition-page.md`](./R18-admin-competition-page.md) (one work package) and its parts
[`101`](../issues/101-one-admin-competition-page.md), [`103`](../issues/103-rich-text-competition-description.md),
[`102`](../issues/102-hosts-from-the-roster.md), [`104`](../issues/104-log-games-from-admin.md),
with the decisions in each and `../grilling-2026-10-03.md`.
No `/atlas-plan` ran. On 2026-10-03, `/atlas-implement` derived this plan against `staging` at `d2d38b6` (PR #128 R17 and PR #129 red-team merged).
Red-team: required; pass 1 resolved in the epic.
Branch: `feat/regression-r18-admin-competition-page`.

## [EXECUTION PLAN]

2026-10-03.

### Run record

- Work package `regression-r18`; branch from `staging` at `d2d38b6`, the review comparison point.
- **Isolation:** a worktree at `.claude/worktrees/regression-r18/war-weeker` (Paul asked, so R19 work in the main checkout is undisturbed). It runs against its own local database `war_weeker_r18` in the `war-weeker-postgres` container, smoke on `SMOKE_PORT=3110` and e2e on `E2E_PORT=3210`, so a smoke or e2e reseed in either checkout never touches the other's data.
- Structure: **sequential** inside the worktree. The epic makes the shared files serial (one owner at a time, part order 101 → 103 → 102 → 104): the new page under `src/app/admin/competitions/[id]/`, its settings components, `src/components/competitions-editor.tsx`, `src/lib/autosave.ts`, `src/actions/setup.ts`, `src/mutations/setup.ts`, `src/mutations/brackets.ts`, `src/lib/competitions.ts`, `src/db/schema.ts`, `drizzle/`, `src/seed/schema.ts`, `src/seed/load.ts`. Every part edits the page and its settings component, so none run in parallel.
  - **D101S — per-field save, locks, Format change (server half of 101).** One per-field save path in `src/mutations/setup.ts` / `src/actions/setup.ts` that checks the role and the lock table and refuses with the one-line reason; "a result" defined once; Format change between any Formats with the new Format's create defaults, Placement Points kept (first 4 for a Bracket); `GAMES_KEEP_FORMAT`, `PARTICIPATION_KEEPS_FORMAT`, `HAS_RESULTS_ERROR` and every `force` option on the Bracket mutations removed with their callers' paths; Postgres tests for every lock row and every role refusal in 101's ACs.
  - **D101P — the page (UI half of 101).** `/admin/competitions/[id]` with Settings on top autosaving per field (extending `src/lib/autosave.ts` to boolean, number, list, rich-text, email-set values; "Saved" indicator; failed save at its field; forms follow server data after a save), the Format's run area below (Entrants and tree, Games, Record placements, who took part; Finalize / Close / Reopen), the disabled-with-reason locked fields, Host view (Hosts read-only names, no other email), the Competitions list's Edit opening the page and Add creating in a sheet then opening it; the five old routes `permanentRedirect` to it and every caller updated; old pages, the edit sheet and their tests deleted; e2e specs written (not run) for 101's ACs.
  - **D103 — rich-text description and the one migration.** `competition.description` → `jsonb` `Content`; `script -q /dev/null pnpm db:generate` once → `drizzle/0030_*.sql` hand-edited to `ALTER COLUMN "description" SET DATA TYPE jsonb USING NULL`; `contentInputSchema` on write (Announcement limits, no 2000 cap); seed schema accepts content or string, loader converts strings (helper beside `src/lib/rich-text/plain-text.ts`); every reader renders rich text or `toPlainText` (Participant page, admin page, archive, MCP); the description field on the page uses the Announcement editor; unit, Postgres and e2e tests per 103's ACs.
  - **D102 — Hosts from the roster.** `EntityCombobox` multi-select of roster Participants by name with email beneath; no-email / non-JG options disabled with their reasons; an off-roster Host shown as their email with a warning, removable; saved through D101's per-field autosave; roster and Host emails loaded for Organizers only; tests per 102's ACs.
  - **D104 — Log a Game from admin.** Games list and Log a Game on the Head-to-head and Best score run area, `GameForm` reused with any Entrant pickable, edit and delete (delete behind `ConfirmDialog`); existing Game authorization; e2e per 104's ACs.
  - **DE — smoke and e2e** on the integrated branch: smoke's admin and Bracket paths moved to the new page, the five 308 redirects checked over HTTP; build once; full smoke and e2e serially; fix test-side defects, report product defects.
  - **DX — docs:** `CONTEXT.md`, `docs/agents/testing.md` smoke and e2e rows, `/about` copy and stills, `docs/maintainers-guide.md` (including the reset), `docs/regression-checklist.md`.
  - Then the aggregate review, `pnpm format:check && pnpm gate` on the integrated commit, closeouts and the PR.
  - Edges: D101S → D101P → D103 → D102 → D104 → DE → DX → gate.
- 101 is split into a server and a page deliverable: the server half (locks and refusals) is independently testable through Postgres tests, and the page builds on it. Both are 101; part order is unchanged.
- Workers run, from the worktree, `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` with `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker_r18?sslmode=disable DATABASE_DRIVER=pg`. Postgres test files must run, not skip. A part may leave the gate red; DE ends with it green.
- Proof-artifact root `test-results`: the prior work package's `test-results/r17/`, the stale `test-results/r10-accounts/` and `test-results/e2e/` are removed in the claim commit; the gate regenerates `test-results/e2e/`, DX regenerates `test-results/about-media/`. R18 evidence: `test-results/r18/` (vitest summary with skipped count, gate log) and `test-results/e2e/<test>/`.

### Resolved decisions

- **Migration:** one `drizzle/0030_*.sql`, owned by D103. A later schema need comes back to the orchestrator, which amends 0030 serially (regenerate from the 0029 snapshot and reapply the hand edit), never adds 0031.
- **Lock reasons** are defined once (a module beside `src/lib/competitions.ts`) and read by both the server refusal and the disabled field, so the two can't drift.
- **Interim state:** between D101S and D101P the old edit sheet and pages may not compile against removed `force` options; D101P ends with typecheck, lint and unit green. D103 may leave typecheck red only until its own end.

### Verification map

| Criterion | Command / action | Surface | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| E1 migration `USING NULL` | `grep -n 'USING NULL' drizzle/0030_*.sql`; no other `USING`, no `RENAME` | repo | one hit on description; nothing else | closeout | after D103 | `drizzle/` |
| E2 seeds load twice | `pnpm test src/seed/seed-sets.test.ts` | vitest, Postgres | row counts unchanged on second load, plain-text descriptions | `test-results/r18/vitest.txt` | after D103 | `seeds/`, `src/seed/`, `drizzle/` |
| E3 skip grep | `git diff d2d38b6 -- e2e src scripts \| grep -n '^+.*\(\.skip(\|\.fixme(\|\.only(\)'` | repo | no hits | closeout | before gate | any test change |
| E4 retired-route grep | `grep -rn '/admin/brackets/\|/admin/placements/\|/bracket"\|/games"\|/participation"' src scripts e2e` | repo | only the redirect pages and redirect tests | closeout | after DE | any route change |
| E5 testing.md rows | review | repo | smoke and e2e rows describe the new page, locks, Hosts from the roster, rich-text description, Log a Game from admin; no retired route | DX commit | after DX | later flow change |
| E6 showcase | review `/about`, stills, guide (incl. R18 reset), checklist | repo | updated where user-visible | DX commit | after DX | later UI change |
| E7 CONTEXT | review `CONTEXT.md` | repo | Competition page, settings / run area, which settings lock; description rich text; Hosts from roster by name; no Reset bracket | DX commit | after DX | — |
| E8 closeouts | part files and epic | repo | closeouts, `done`, PR URL | closeout commit | closeout | — |
| E9 PR step | PR body | GitHub | reset listed as Paul's post-merge step | PR | closeout | — |
| E10 gate | `pnpm format:check && pnpm gate`; PR CI | local + CI | exit 0; CI green | `test-results/r18/gate.log` | before PR | any change |
| P101-e2e-formats | `pnpm e2e` (101 per-Format spec) | build, Postgres | per Format: setting kept over reload and leave/return; result added → locked field shows reason | `test-results/e2e/<test>/` | after DE | page, setup mutations |
| P101-e2e-format-change | `pnpm e2e` | build | Placement → Bracket → Head-to-head on a new Competition; each Format's settings and run area | `test-results/e2e/<test>/` | after DE | page |
| P101-e2e-host | `pnpm e2e` | build | Host edits settings, Hosts read-only, no email but their own in the HTML | `test-results/e2e/<test>/` | after DE | page, queries |
| P101-pg-locks | `pnpm test src/mutations` (setup tests) | vitest, Postgres | each lock row refused with reason once it applies, accepted before; always-open fields accepted while Finalized | `test-results/r18/vitest.txt` | after D101S | `src/mutations/setup.ts` |
| P101-pg-roles | `pnpm test src/mutations` | vitest, Postgres | Host refused Hosts; other Host refused; Participant refused; Format change applies defaults, keeps 4 Placement Points for a Bracket | vitest.txt | after D101S | setup mutations |
| P101-redirects | `pnpm smoke` | build, Postgres | five old routes answer 308 to the new page | `test-results/r18/gate.log` | after DE | redirect pages |
| P101-no-force | `grep -rn 'HAS_RESULTS_ERROR\|force' src/mutations/brackets.ts src/actions/brackets.ts` plus `grep -rn HAS_RESULTS_ERROR src e2e scripts` | repo | no hits | closeout | after D101S | brackets |
| P103-e2e | `pnpm e2e` (103 spec) | build | heading, list, link written by an Organizer render on the Participant page | `test-results/e2e/<test>/` | after DE | description editor/renderer |
| P103-unit | `pnpm test` (seed helper test) | vitest | "Line one\nLine two\n\nLine three" → three paragraphs, in order | vitest.txt | after D103 | helper |
| P103-pg-sanitise | `pnpm test` (setup mutation test) | vitest, Postgres | `javascript:` link / `<script>` node refused or stripped on save | vitest.txt | after D103 | save path |
| P102-e2e | `pnpm e2e` (102 spec) | build | Organizer searches, picks two Hosts, autosaves; Host signs in and records a result | `test-results/e2e/<test>/` | after DE | picker, Host access |
| P102-unit | `pnpm test` (options test) | vitest | no-email excluded; non-JG disabled with reason; two "Sam Lee" shown with emails | vitest.txt | after D102 | options helper |
| P102-pg | `pnpm test` | vitest, Postgres | Host refused saving Hosts | vitest.txt | after D101S | setup mutations |
| P104-e2e-log-edit | `pnpm e2e` (104 spec) | build | Host logs a Best score attempt for a Participant from admin, edits it; Competition Games leaderboard shows the edit | `test-results/e2e/<test>/` | after DE | games admin |
| P104-e2e-delete | `pnpm e2e` | build | delete behind `ConfirmDialog`; it leaves the leaderboard | `test-results/e2e/<test>/` | after DE | games admin |

Human gates: none before or during delivery. **Announced for later (outside this work package):** the epic's reset of staging then prod (Seed workflow with reset; prod pre-check before the `staging` → `main` merge). It needs the merged PR, so it goes in the PR description as Paul's post-merge step (E9).

## [PROGRESS]

- 2026-10-03, D101S (Opus): `d05e896`. Lock table and reasons once in `src/lib/competition-locks.ts` (`SETTING_LOCKS`, `settingLockReason`, `settingNote`, `hasResult`); facts from `src/queries/competition-locks.ts`; one per-field save `saveCompetitionSetting` (`src/mutations/competition-settings.ts`, action in `src/actions/setup.ts`) checking role, then lock, then the field's own rules. Format change between any Formats with create defaults; Placement Points kept, first 4 for a Bracket. `GAMES_KEEP_FORMAT`, `PARTICIPATION_KEEPS_FORMAT`, `HAS_RESULTS_ERROR`, `THIRD_PLACE_LOCKED` and every `force` removed. Choices: Head-to-head / Best score settings and Entrants open lock with a result; points per Participant never locks; a Bracket's Squads are deleted on a Format change. 14 Postgres tests; vitest 188 files / 3855 passed, 0 skipped.
- 2026-10-03, D101P (Opus): `e4f0a41`, `6438fa5`. `/admin/competitions/[id]` (Settings form `src/components/competition-settings-form.tsx`, run area `run-area.tsx`); `src/lib/autosave.ts` holds any value (`sameValue`, `reseed`, `unsavedFields`); the five retired routes `permanentRedirect`; the edit sheet and old pages deleted; the retired per-setting server actions deleted so no endpoint skips the lock table; `savePlacements` no longer writes Score direction. New and rewritten e2e specs (not run here). Vitest 191 / 3876, 0 skipped.
- 2026-10-03, D103 (Sonnet): `b052a82`. `drizzle/0030_woozy_amphibian.sql` = `ALTER TABLE "competition" ALTER COLUMN "description" SET DATA TYPE jsonb USING NULL;`. `contentInputSchema` on save; `RichTextEditor` on the page, `RichText` on the Participant page; seeds take content or a string (`plainTextToContent` / `descriptionContent` in `src/lib/rich-text/from-plain-text.ts`). MCP, archive and lists never read a Competition description. The orphaned D101P parsers deleted. Vitest 192 / 3839, 0 skipped.
- 2026-10-03, D102 (Sonnet): `b7b38cf`. `buildHostOptions` (`src/lib/host-options.ts`), `getHostCandidates` (Organizers only); `EntityCombobox` multi-select; `JgEmailChips` and `email-entry` deleted. **Reading of 102:** its AC says Participants without an email are excluded, its Decisions say shown disabled with "Add an email in Roster"; built as disabled (not selectable), which satisfies both. Vitest 192 / 3840.
- 2026-10-03, D104 (Sonnet): `303f082`. `AdminGames` in the Head-to-head / Best score run area reuses `GameLog` and `GameForm` with no preselected player; existing Game authorization unchanged. Vitest 193 / 3843.
- 2026-10-03, DE (Opus): `f4a26b3`, `1114387`, `8cfe895`, `7491138`. Smoke checks the five 308s signed in. Product fixes: a Format change to a Games Format crashed the settings form (null config; now `gamesConfigOf`); one "Who took part" heading. Test-side fixes: Individual scoring for Placement cases; r5 reload after `withParticipantEmail`; `placement.spec.ts` focuses the picker instead of clicking (Base UI drag-select added an extra row when the list opened above the search). Smoke 266 ok / 0 FAIL; e2e 118 passed, 0 failed, 0 skipped, 0 flaky.
- 2026-10-03, DX (Sonnet): `1913e25`. `CONTEXT.md`, `docs/agents/testing.md` smoke and e2e cells, `docs/maintainers-guide.md` (Competition page recipe; "How R18 reached staging and production (the reset)"), `docs/regression-checklist.md`, `organizer-guide.tsx`; `/about` stills regenerated (copy unchanged).
- 2026-10-03: all parts integrated; epic and parts `in-progress` → `ai-review`; aggregate code review starts.

# Epic E: Bracket formats, milestone slice

**What to build:** The part of ticket `16` that must land before the 2027-01-21 milestone, as one work package, one branch and one PR into `staging`: the End War Week warning for an unfinalized Bracket, the **Heats** Format (T9), and removing the unbuilt `per-heat` and `both` Bracket points modes from the code. T10 (qualifiers or groups → knockout) is dropped (see "Scope changes"). The rest of ticket 16 (Squads, self-report, Heat times and Now/Next, round robin with ties, double elimination, the T6/T14 extras, seeded Brackets, seeding by Standings or drag) stays in the ticket for later epics and never delays this one.

**Tickets:** `16` (item 1 of its Order table, plus the End War Week warning and the points-mode removal from "Also carried"); files under `../issues/`

**Branch:** `feat/hardening-e-bracket-formats`

**Blocked by:** Epic D (its PR #81 merged into `staging`); ticket 16's own blockers 03 and 13 are `done` and merged

**Status:** done

## Order

1. The End War Week warning (small, independent; ticket 16 says "do this first, with item 1").
2. T9 Heats: multi-entrant Heats, the top N of each Heat advancing until one Heat is left.
3. Remove the `bracketPoints` field from the code (with item 2's wiring).

## Acceptance criteria

Ticket 16's contract for T9 and the warning (`.scratch/brackets/spec.md` stories 10, 11, 15–18, 22 and its Engine decisions), plus:

- [ ] Engine unit tests for the Heats Format: generation for 2–17 Entrants across the config values the builder offers (including the refused combinations), byes and short Heats, advancement and snake seeding, reset of later Rounds, final placings and ties, `pointsFor` under placings.
- [ ] Single elimination behaves exactly as before: the existing engine, mutation, smoke and Playwright bracket checks pass unchanged in what they assert.
- [ ] A Playwright flow builds, runs and finalizes a Heats Bracket on the XI demo seed and finds its "From bracket" Points Entries; a Playwright check opens End War Week while a Bracket is unfinalized, sees the warning naming it, and cancels.
- [ ] Screenshots at 375px and 1280px of the Heats builder, results screen and participant view; zero horizontal overflow at 375/768/1280.
- [ ] The migration applies to the seeded local database; every seed still loads twice; smoke passes on it.
- [ ] CONTEXT.md (glossary and "Bracket rules"), `/about` copy and media, the Organizer guide and `docs/maintainers-guide.md` match every user-visible change.
- [ ] No code reads or writes `bracketPoints`; Bracket points come only from placings and the Competition's Placement Points.
- [ ] Ticket 16 records a `[PROGRESS]` comment for this slice and its `Status:` line is unchanged (it stays open for the rest of its Order table); this epic records its closeout and is set to `done` in this branch.
- [ ] `pnpm gate` passes locally and in CI.

## Scope changes against ticket 16 and the brackets spec (Paul, 2026-09-26)

- **T10 dropped.** Ticket 16 credits "qualifiers or groups → knockout" with ~14 past uses, but Paul confirmed none needs a new Format: Pool is plain single elimination, and Bouncy Ping Pong ran as two Competitions (a points qualifier, then a four-Entrant single-elimination Bracket of the top finishers). Two Competitions stay the answer. Round-robin Groups, Group tables and their tiebreaks belong to T7.
- **One new column, no stage/round tables.** Following spec Decision W5 (single-stage rows), `heat` gains only `slot_count`; no `stage`, `pool` or new tables in this slice. Details in `E-execution.md`, decision 10. Planner's call (Paul deferred to it).
- **Heats end "until one Heat is left"**; no fixed-Rounds option (Paul approved).
- **Per-heat and both points removed** (Paul): no Competition needs points per Heat; past multi-entrant games paid only 1st place, which Placement Points on the Competition already express. This epic removes `bracketPoints` from the code; the `competition.bracket_points` column and its enum are dropped in a later migration, after this ships to `main`, so an Instant Rollback never meets a missing column.
- **No seeded Bracket in XI** (ticket 16 "Seeds"): Paul has no history to seed one from. Open for a later epic only if that changes.

## Comments

- 2026-09-26 [EXECUTION PLAN]: claimed by Atlas (`/atlas-implement`, Epic E); branch `feat/hardening-e-bracket-formats` from `staging` `cb8162b`; plan, decisions and verification map in `E-execution.md`. Ticket 16 stays `ready-for-agent` (this slice is part of it).

### [AI CODE REVIEW] Epic E (2026-09-27)

Two independent reviewers (opus) read `cb8162b..3acf5a9` (excluding `test-results/`, `drizzle/meta/`, `public/`); the orchestrator adjudicated each finding against the cited hunks. Fixes in R1 `cf80839`.

**Implementation and spec conformity**
- F2 **blocking**, resolved: a Heat settings save could store a config Generate refuses and, with the force confirm, wipe every Heat Result (8 Entrants, switch to 3 per Heat with 2 advancing). `setCompetitionFormat` now runs `validateConfig` against the saved Entrants before clearing anything (new DB test); the builder disables Save for a refused choice, clamps "how many advance" when the Heat size changes, and gives each disabled option its refusal as a hint.
- F1 resolved at closeout (evidence and tracker records, not a code defect).
- F3 resolved: the overflow check also covers the open results Sheet (`role=dialog`).
- F4 resolved: the Heats flow opens the participant view as a Round-1 advancer ("Advanced to Round 2 · waiting for Round 1 to finish", then "Your next Heat · Final" with three opponents), with screenshots and overflow checks.
- F5 resolved: the unused `src/lib/bracket/index.ts` barrel (re-exporting single elimination only) removed.
- F6 resolved: the wave-2 progress note now describes the snake deal correctly.
- F7 resolved: Organizer guide (2–8 per Heat, forfeiters finish behind the rest of their Heat, placings), the maintainer's add-a-Format recipe, and CONTEXT.md's forfeit rule.
- F8 **deviation approved**: the single-elimination builder preview gains Heat-name labels and "Bye — advances"; no existing assertion changes.
- Coverage judged sufficient: the reviewer probed Heats edge cases with a scratch script (byes, forfeits in later Rounds, edits after the Final, one-slot Heats) and read every changed file.

**Coding standards**
- S1 resolved: the End War Week warning in both guides.
- S2 resolved: a banned-term comment ("matching") reworded; a new `(event) =>` renamed. The scan against `staging` shows no new hits (`test-results/hardening-e-docs/grep.txt`).
- S3–S5 resolved: Organizer guide copy, CONTEXT.md bye rule ("before the Final"), README and CI comment list every browser flow.
- S6 resolved: the maintainer's guide says `view.ts` display helpers also branch on Format.
- S7–S11 resolved: one `heatsConfig` helper, one `isDecided` (`heat-status.ts`), `heatSizes` private, `loadBracket` comment, simpler seed-schema check.
- S12 **deviation approved**: `src/queries/unfinalized-brackets.ts` stays its own file (the plan named it).

Remaining risks: the refusal hint on a disabled option is a hover `title`, so on touch only the current choice's refusal shows; changing the Heat size resets "how many advance" to the highest valid value.

### [CLOSEOUT] Epic E (2026-09-27)

Branch `feat/hardening-e-bracket-formats`, PR https://github.com/paul-macfarlane/jg-war-week/pull/84. Verified `pnpm format:check && pnpm gate` on `cf80839` (local Postgres 17, Chromium, `DATABASE_DRIVER=pg`): exit 0; 86 files / 2247 tests; smoke 178 ok, 0 not ok; e2e 23 passed. CI on the PR: 2 checks passing.

| Criterion | Verdict | Evidence |
|---|---|---|
| Engine unit tests for the Heats Format | PASS | `test-results/hardening-e-focus/engine-tests.txt` (899 tests; every config over 2–17 Entrants played to a champion; 318 accepted / 130 refused), `engine-probe.txt` |
| Single elimination behaves exactly as before | PASS | `test-results/hardening-e-gate/single-elim-diff.txt` (only the approved slot-2 expectation changes), `gate.txt` |
| Playwright Heats flow to "From bracket" entries; End War Week warning | PASS | `e2e/bracket-heats.spec.ts` in `gate.txt`; `test-results/e2e/bracket-heats-*/` |
| Screenshots 375/1280; zero overflow 375/768/1280 | PASS | `test-results/e2e/bracket-heats-*/` (builder, results Sheet, results after the Final, participant, participant advanced) |
| Migration applies; seeds load twice; smoke passes | PASS | `test-results/hardening-e-migrate/`; `gate.txt` |
| CONTEXT.md, `/about`, Organizer guide, maintainer's guide current | PASS | `test-results/hardening-e-docs/grep.txt`; `public/about/brackets.png` |
| No code reads or writes `bracketPoints` | PASS | `grep.txt` (only the column mapping in `schema.ts`/`enums.ts`) |
| Ticket 16 `[PROGRESS]`, Status unchanged; epic closeout and `done` | PASS | ticket 16 and this file |
| `pnpm gate` locally and in CI | PASS | `gate.txt`; PR #84 checks |

Deliverables (workers): D1 End War Week warning (sonnet), D2 schema/migration/seam (opus), D3 Heats engine (opus), D4 wiring/DB tests/smoke (opus), D5 UI (opus), D6 flow/docs/About (sonnet), R1 review fixes (opus). Deviations: slot-2 expectation (decision 10); snake-deal Heat sizes (decision 2, packet corrected); About stills regenerated by the script; F8, S12. Follow-ups: drop `competition.bracket_points` and its enum in a `chore/` migration after this is on `main`; the possible Escape-clears-Entrant-picks bug (raised as its own task).


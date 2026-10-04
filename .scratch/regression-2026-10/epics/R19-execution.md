# Execution record: Epic R19, Participant list and scale

Contract: [`R19-participant-list-and-scale.md`](./R19-participant-list-and-scale.md) (one work package) and its tickets
[`105`](../issues/105-competitions-list-status.md) and [`106`](../issues/106-hundred-participants.md),
with the decisions in each and `../grilling-2026-10-03.md` (Q9, Q13).
No `/atlas-plan` ran. On 2026-10-03, `/atlas-implement` derived this plan against `staging` at `6543151` (PR #130 R18 merged).
Red-team: not required (no schema change planned; a schema need found by the scale pass stops the run and comes back to Paul).
Branch: `feat/regression-r19-list-and-scale`.

## [EXECUTION PLAN]

2026-10-03.

### Run record

- Work package `regression-r19`; branch from `staging` at `6543151`, the review comparison point.
- **Isolation:** direct checkout of the main repo (Paul: no worktree needed now that R18 is merged). The deliverables run one at a time, so nothing else edits the checkout. The idle R18 worktree at `.claude/worktrees/regression-r18/` is left alone.
- Structure: **sequential**, in the epic's order 105 → 106 (the scale pass covers the new list), then docs.
  - **D105, the Participant Competitions list.** One pure status function (Not started; Underway, with a Bracket's round, e.g. "Round 2 of 4" or "Final"; Closed; Done · Winner: X, listing every tied winner) with unit tests per Format and state. The list query supplies the facts it needs. Each row shows the name, a two-line description preview (`toPlainText` of the rich-text description, clamped to two lines), the status and the Format and scoring badges, with no max badge. Home's Recent results shares the winner logic where it fits. An e2e spec screenshots the list at 1440 and 390 with each status present on seeded data.
  - **D106, 100 Participants.** A 100-Participant demo seed and a scale pass over every page that lists or picks people. Fixes what breaks; files larger findings as tickets.
  - **DX, docs:** `CONTEXT.md`, `docs/agents/testing.md` smoke and e2e cells, `docs/maintainers-guide.md`, `docs/regression-checklist.md`, `/about` copy and stills where the list shows.
  - Then the aggregate review, `pnpm format:check && pnpm gate` on the integrated commit, closeouts and the PR.
  - Edges: D105 → D106 → DX → gate.
- Parallelism rejected: D106's scale pass screenshots and may fix the list D105 builds (`src/components/competitions.tsx`, `src/queries/competitions.ts`, the list page), and both deliverables add e2e specs that reload seeds into the one local database. Re-checked at closeout.
- Workers run `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`; Postgres test files must run, not skip. D105 and D106 also run `pnpm build` and their own e2e specs (`pnpm exec playwright test <spec>`); D106 runs `pnpm smoke`.
- Proof-artifact root `test-results`: R18's `test-results/r18/` and `test-results/e2e/` are removed in the claim commit; `test-results/about-media/` stays until DX regenerates it. R19 evidence: `test-results/r19/` (vitest summary, gate log) and `test-results/e2e/<test>/`.

### Resolved decisions

- **Status function:** one pure module in `src/lib/` (unit-tested). The page passes it facts from the query, and it returns a status kind plus its label parts. "A result" means the same as in R18's `hasResult` (`src/lib/competition-locks.ts`), so the list and the locks can't disagree about Not started. *Closed* = Games or Participation closed without a 1st place to name; *Done · Winner: X* = Finalized (Placement, Bracket) or Closed (Head-to-head, Best score, team Participation) with a 1st place, every tied winner listed. An individual Participation Competition that is closed has no winner, so it shows *Closed*.
- **Winner** comes from the same place Home's Recent results takes it: the target(s) of the highest generated Points Entry (`src/lib/recent-results.ts`). Shared as one helper rather than a second rule.
- **Bracket round label:** "Round N of M" for the first unplayed round; "Final" when the final is the round in play (a 3rd place game in that round doesn't change the label).
- **Where the 100 Participants live (106):**
  - **Free-for-all:** a new `seeds/demo/xii-scale.json`, an alternative to `seeds/demo/xii.json` for the same edition (XII, live, free-for-all). It has 100 made-up Participants with made-up emails (`@example.com`, or `@jahnelgroup.com` only for the handful who host), and none taken from real people. It covers a Placement over many Participants, a 64-Entrant Bracket built with round 1 partly recorded, Participation ticks, a Head-to-head, a Best score, Discretionary points and Finale slides. `pnpm seed:demo:scale` loads every committed seed plus it, the way `seed:demo:xii` does. It lives under `seeds/demo/`, so the Seed workflow never loads it into a deployed database.
  - **Teams:** the XI demo (`seeds/demo/xi.json`, live, teams) already has 101 Participants in Teams, and every smoke and e2e run loads it. The teams half of the scale pass walks its pages; it gets no second teams seed.
- **Smoke covers the scale seed** as a final phase: load every committed seed plus `xii-scale.json` with `--reset`, then again without, assert its row counts (100 Participants, 64 Entrants) are unchanged, request its main pages, then restore `localSeedFiles()` with `--reset`.
- **The scale e2e spec** loads the scale seed in `beforeAll` and restores `localSeedFiles()` with `--reset` in `afterAll` (team rule: a spec that changes shared seeded data puts it back; e2e runs one worker).
- **Search** in `EntityCombobox` pickers matches name and email, with no result cap.
- **Findings:** small fixes in this branch; larger ones go in new `needs-triage` tickets under `.scratch/regression-2026-10/issues/` (from 108) and in `.scratch/backlog.md`. Every finding is recorded in 106's file.
- **CONTEXT.md:** the grilling glossary names nothing for R19. Add the Competition **status** words (Not started / Underway / Closed / Done) only if they become user-facing terms; the list is user-facing, so DX adds one entry.

### Verification map

| Criterion | Command / action | Surface | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|
| P105-unit | `pnpm test src/lib/competition-status.test.ts` (name as built) | vitest | a case per Format and state: Not started, Underway (Bracket "Round N of M", "Final"), Closed, Done with one winner and with a tie | `test-results/r19/vitest.txt` | after D105 | status module |
| P105-e2e | `pnpm e2e` (`regression-r19-list` spec) | build, Postgres | the list at 1440 and 390 shows each of the four statuses, a two-line preview and no max badge | `test-results/e2e/<test>/` | after D105 | list page, query, seeds |
| P106-seed-twice | `pnpm smoke` scale phase; `pnpm test src/seed/` (scale seed loads twice) | build, Postgres | row counts unchanged on the second load; 100 Participants, 64 Entrants | `test-results/r19/gate.log`, vitest.txt | after D106 | `seeds/demo/xii-scale.json`, `src/seed/` |
| P106-screens | `pnpm e2e` (`regression-r19-scale` spec) | build, Postgres | screenshots at 1440 and 390 of the roster, Standings and leaderboard, Placement sheet, Entrants, a picker, the 64-Entrant Bracket tree, Participation ticks, Finale, Home and the Competitions list, with no sideways page scroll | `test-results/e2e/<test>/` | after D106 | any of those pages, scale seed |
| P106-search | e2e or unit: a picker finds a Participant by email | vitest or build | match by name and by email; no cap over 100 | vitest.txt or e2e dir | after D106 | `EntityCombobox` |
| P106-names | review `seeds/demo/xii-scale.json` | repo | made-up names and emails only | closeout | after D106 | the seed |
| P106-findings | review 106's file | repo | findings listed; larger ones filed as tickets and in the backlog | closeout commit | after D106 | — |
| E1 showcase | review `/about`, stills, guide, checklist | repo | updated where user-visible | DX commit | after DX | later UI change |
| E2 CONTEXT | review `CONTEXT.md` | repo | Competition status entry | DX commit | after DX | — |
| E3 testing.md | review | repo | smoke and e2e cells name the scale seed phase and the new specs | DX commit | after DX | later flow change |
| E4 skip grep | `git diff 6543151 -- e2e src scripts \| grep -n '^+.*\(\.skip(\|\.fixme(\|\.only(\)'` | repo | no hits | closeout | before gate | any test change |
| E5 closeouts | ticket files and epic | repo | closeouts, `done`, PR URL | closeout commit | closeout | — |
| E6 gate | `pnpm format:check && pnpm gate`; PR CI | local + CI | exit 0; CI green | `test-results/r19/gate.log` | before PR | any change |

Human gates: none. No deploy step (no schema change, nothing to reset).

## [PROGRESS]

- 2026-10-03, D105 (Opus): `541d63eb`. `src/lib/competition-status.ts` (`competitionStatus`, `competitionStatusText`, `bracketRoundInPlay`), 27 unit cases. `getCompetitions` supplies the facts in one batch per War Week: `hasResult` counts, a new batched `loadBrackets` (`src/queries/brackets.ts`; `loadBracket` delegates to it) and winners from the existing `finalWinners` (`src/lib/recent-results.ts`, already shared by Recent results and the Finale), so no second rule. Row: name, status badge, `line-clamp-2` preview of `toPlainText`, Format and scoring badges. No seed change: the spec adds an Underway Bracket and a Closed Participation of its own and deletes them in `finally`. Choices accepted: a Finalized Placement or Bracket with no Placement Points shows "Done" with no winner; ties read "Winners: A, B". Vitest 195 files / 3888 passed, 0 skipped; `regression-r19-list` e2e passed.
- 2026-10-03, D106 (Opus): `4c66899b`, `7ef301eb`, `998ff0b2`, `848b5332`, `b5c1c343`. `seeds/demo/xii-scale.json` (100 made-up Participants, free-for-all, live XII; generator `scripts/xii-scale-seed.ts`).
  - **[SCOPE CHANGE]** The seed format can't hold Hosts, Entrants, generated Heats, Heat Results, Games or Participation ticks. A post-load fixture (`src/seed/scale.ts` `applyScaleFixture`, run by `scripts/seed-scale.ts`) adds them through the app's own mutations, skipping any part whose rows already exist. `pnpm seed:demo:scale` is the seed load followed by the fixture. Neither the seed schema nor the DB schema changed.
  - What it holds: a Finalized 100-row Placement with a tie, an empty Placement, a 64-Entrant Bracket (64 Heats with the 3rd place game, 20 of Round 1 recorded), Participation with 72 ticks, a Head-to-head with 40 Games and a Best score with 60.
  - Smoke phase `scripts/smoke/scale.ts`: loads twice, counts unchanged, 100 Participants and 64 Entrants, four pages answer 200, then `localSeedFiles()` is restored. The Postgres seed-sets case proves the same. `e2e/regression-r19-scale.spec.ts` screenshots every page at 1440 and 390, plus XI's 101 in Teams.
  - Fixes: Organizer-only pickers (Discretionary points, Awards) search by email through a hidden `keywords` field; Placement sheet names wrap at 390.
  - Filed 108–113.
  - Smoke OK=278 FAIL=0; vitest 195 files / 3913 passed, 0 skipped; e2e for the two specs passed, 8 tests.
- 2026-10-03: D105, D106 and DX integrated (DX `2597428f` plus orchestrator fix `1af9afe9`: the email rule moved from the Host entry to the You rule in CONTEXT, the scale fixture's real contents in the guide, the checklist naming the pickers that search by email; `/about` copy never describes the list, so no copy or still change). Epic and tickets `in-progress` → `ai-review`; aggregate code review starts.
- **[SCOPE CHANGE]** 2026-10-03: the plan's decision "Search in `EntityCombobox` pickers matches name and email" is narrowed to the Organizer-only pickers (Discretionary points, Awards). The run-area pickers are used by Hosts and Log a Game by Participants, and sending them Participant emails would break CONTEXT's email rule, so that choice goes to Paul as ticket 108.
- 2026-10-03, DR1 (Sonnet): `ec45a799`. The review fixes listed below. Vitest 195 / 3915, 0 skipped; the scale, list and placement e2e specs passed.
- 2026-10-03, gate (orchestrator):
  - The first full gate on `d2801cd8` passed.
  - The gate on `ec45a799` failed once, in `bracket-heats`: after Escape the Entrants list sometimes stayed open and widened the page at 375. This flake was already on `staging`: it fails 1 in 4 repeats on `65431510` too, checked in a throwaway worktree and removed afterwards.
  - Fixed on the test side in `9bdf6a21` by waiting for the list to close (6 of 6 repeats pass). The final gate on `9bdf6a21` passed.

## [AI CODE REVIEW]

2026-10-03. Two fresh Opus reviewers read `git diff 65431510 HEAD`, one per axis. The orchestrator ruled on each finding by reading the hunks it cites. **Blocking: none.**

**Technical implementation and spec conformity** (reviewer checked every AC; status rules, round logic, winner sharing, privacy gates, fixture guard and smoke restore found correct):

| # | Finding | Severity | Disposition |
|---|---|---|---|
| T1 | `src/seed/scale.ts`: the fixture isn't atomic; a crash partway leaves a partial XII that a rerun skips | non-blocking | Accepted risk: `pnpm seed:demo:scale` resets XII first; the seed-sets case asserts the full state |
| T2 | `src/queries/competitions.ts`: `Promise.all` on one tx client (pg@9 deprecation) | non-blocking | Accepted: the repo's existing pattern (`getRecentResults`, enrollment); a repo-wide follow-up |
| T3 | Redundant Heat count query | non-blocking | Fixed `ec45a799` (Heats from `loadBrackets`) |
| T4 | Scale e2e titles overclaim (one name for "all 100") | non-blocking | Fixed `ec45a799`: exactly 100 roster rows, "(64 chosen)", "72 of 100" |
| T5 | Placement wrap fix had no regression assert | non-blocking | Fixed `ec45a799`: no ellipsis, height over 1.5 lines, no Remove on a Finalized sheet |
| T6 | Awards picker email search untested | non-blocking | Fixed `ec45a799` (e2e: exactly "Pim Ocelot") |
| T7 | Smoke "Last:" comment stale; restore depends on the faq table | non-blocking | Fixed `ec45a799`: scale phase moved before the error-boundary step |
| T8 | No Heats-engine bye or final + 3rd place game case | non-blocking | Fixed `ec45a799` (two cases) |
| T9 | Tie order: the list sorts by name, Home keeps entry order | non-blocking | Accepted (cosmetic; the list's order is stable) |
| T10 | Backlog line stale | non-blocking | Fixed `cc330f93` |

**Coding standards** (CLAUDE.md UI rules, no cursor classes, made-up data, put-back and every-assert-can-fail team rules found clean):

| # | Finding | Severity | Disposition |
|---|---|---|---|
| C1 | Checklist said the leaderboard lists every Participant (only those with points) | non-blocking | Fixed `cc330f93` |
| C2 | CONTEXT called the status "one word" | non-blocking | Fixed `cc330f93` ("label") |
| C3 | Ticket 108 quoted the old email rule | non-blocking | Fixed `cc330f93` |
| C4 | R19 records dated 2026-10-04; commits are 2026-10-03 local | non-blocking | Fixed `cc330f93` |
| C5 | Backlog status | non-blocking | Fixed `cc330f93` |
| C6 | Email search narrowing logged as a fix, not a scope change | non-blocking | Fixed `cc330f93` ([SCOPE CHANGE] above) |
| C7 | `scale.ts` comment didn't match the stride-37 key | non-blocking | Fixed `ec45a799` |
| C8 | `AwardFormOptions.email` declared on the query but filled by the page | non-blocking | Fixed `ec45a799` (`AwardFormPickerOptions` beside the form) |
| C9 | Long one-line script headers | non-blocking | Fixed `ec45a799` |

Earlier orchestrator fix to DX (`1af9afe9`): the email rule moved from the Host entry to the You rule in CONTEXT; the guide names the fixture's real contents; the checklist names the pickers that search by email.

## [CLOSEOUT]

2026-10-03.

- **Repository delivery:** `war-weeker`, branch `feat/regression-r19-list-and-scale` from `staging` at `6543151`, direct checkout of the main repo, which Paul confirmed twice.
- **Deliverables:**
  - D105 (Opus): `541d63eb`.
  - D106 (Opus): `4c66899b`, `7ef301eb`, `998ff0b2`, `848b5332`, `b5c1c343`.
  - DX (Sonnet): `2597428f`, plus orchestrator fix `1af9afe9`.
  - Review doc fixes (orchestrator): `cc330f93`.
  - DR1 (Sonnet): `ec45a799`.
  - Gate flake fix (orchestrator): `9bdf6a21`.
- **Isolation check:** the plan serialized D105 and D106, partly because D106 might edit the list files. That prediction didn't come true: D106's commits touch none of `src/components/competitions.tsx`, `src/queries/competitions.ts` or the list page. Only DR1 later edited `src/queries/competitions.ts`. The other reason held: both deliverables' e2e specs reseed the one local database, and D106 regenerated D105's list screenshots. A parallel run would still have needed separate databases.
- **Scope changes and approved readings:**
  - The scale fixture runs through the app's mutations because the seed format can't hold Hosts, Entrants, Heats, Games or ticks.
  - Email search applies only to Organizer-only pickers; the Host and Participant pickers are ticket 108.
  - A Finalized Placement or Bracket with no Placement Points reads "Done".
  - Ties read "Winners: A, B".
- **Verified run command:** `pnpm format:check && pnpm gate` with `DATABASE_URL=postgres://…@localhost:2345/war_weeker DATABASE_DRIVER=pg`, exit 0 on `9bdf6a21`:
  - lint 0 errors, 10 warnings, the same as `staging`;
  - vitest 195 files, 3915 tests passed, 0 skipped;
  - smoke 278 ok, 0 FAIL;
  - e2e 127 passed (6.1m), 0 failed, 0 skipped, 0 flaky.

  Log: `test-results/r19/gate.log`. No deploy and no schema change, so nothing to reset.

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| P105-unit | PASS | gate.log (vitest; `competition-status.test.ts` 29 cases) |
| P105-e2e | PASS | `test-results/e2e/regression-r19-list-*/competitions-list-{1440,390}{,-in-view}.png`; gate.log |
| P106-seed-twice | PASS | gate.log: smoke `the XII scale demo loads twice with no row count changing`, `100 Participants and 64 Entrants`; seed-sets Postgres case |
| P106-screens | PASS | `test-results/e2e/regression-r19-scale-*/` (each page at 1440 and 390, no sideways scroll asserted); gate.log |
| P106-search | PASS | e2e: `@` lists all 100, `pim.ocelot@jahnel` finds one (Discretionary points and Awards pickers); `entity-combobox.test.ts` |
| P106-names | PASS | `seeds/demo/xii-scale.json`: made-up names, `@example.com` plus four fictional `@jahnelgroup.com` Hosts |
| P106-findings | PASS | 106's Scale pass findings; tickets 108–113 `needs-triage`; backlog lines |
| E1 showcase | PASS | guide and checklist (`2597428f`, `1af9afe9`, `cc330f93`); `/about` copy never describes the list, so no copy or still change |
| E2 CONTEXT | PASS | Competition status entry; email rule (`2597428f`, `1af9afe9`, `cc330f93`) |
| E3 testing.md | PASS | smoke and e2e cells (`2597428f`) |
| E4 skip grep | PASS | `git diff 65431510 -- e2e src scripts \| grep …` empty |
| E5 closeouts | PASS | this record, the epic and tickets 105, 106 `done` |
| E6 gate | PASS (local); CI on the PR pending | gate.log |
- **PR:** https://github.com/paul-macfarlane/jg-war-week/pull/131

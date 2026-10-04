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

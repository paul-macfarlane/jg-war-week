# Execution record: Epic R24, War Week at full size

Contract: [`spec.md`](./spec.md) as of `feat/r24-scale` `8c1d8db1`
(decisions 1–5, 7 acceptance criteria, 5 DoD items). Blocked by: none.
Branch: `feat/r24-scale`. No `/atlas-plan` ran; `/atlas-implement` derived
this plan from the spec. It does not amend the spec.

## [EXECUTION PLAN]

2026-10-04. Derived by the orchestrator; no product or architectural
decision added beyond the spec.

### Execution structure

**Two parallel lanes, sequential inside each**, in worker worktrees, then
an integration and docs step on `feat/r24-scale`.

| Lane | Worktree / branch | Database | Smoke / e2e ports |
|---|---|---|---|
| integration | `.claude/worktrees/r24-scale/war-weeker` · `feat/r24-scale` | `war_weeker_r24` | 3124 / 3224 |
| A | `.claude/worktrees/r24-scale/war-weeker-a` · `feat/r24-scale-a` | `war_weeker_r24a` | 3125 / 3225 |
| B | `.claude/worktrees/r24-scale/war-weeker-b` · `feat/r24-scale-b` | `war_weeker_r24b` | 3126 / 3226 |

Each worktree has a gitignored `.env.local` pointing at its own database
(the smoke and e2e `--reset` every seeded War Week), and runs with
`SMOKE_PORT` / `E2E_PORT` set, so the lanes don't collide with each other
or with the R23 session's `war_weeker_r23*` databases.

| # | Deliverable | Spec | Lane | Depends on |
|---|---|---|---|---|
| D1 | Roster search, actions on top | Decision 1; AC Roster | A | — |
| D4 | Bottom-bar `tabLabel`, sans labels | Decision 4; AC Bottom bar | A | D1 (lane order only) |
| D5 | Finale top-10 countdown, "…and N more" | Decision 5; AC Finale | A | D4 (lane order only) |
| D2 | Bracket admin: no Preview, collapsed Seeds | Decision 2; AC Bracket admin | B | — |
| D3 | Bracket tree full width, Jump to your Match | Decision 3; AC Bracket tree | B | D2 (lane order only) |
| D6 | Docs sweep: `/about`, maintainers guide, regression checklist, `docs/agents/testing.md`, backlog and issue closures | DoD | integration | D1–D5 |

**Why two lanes and not five workers.** Each deliverable's proof needs a
production build and a Playwright run against its own reset database, so
every concurrent worker costs a worktree, a database and a build alongside
the R23 session's. Two lanes halve wall time without that cost.

**Why the bracket work shares lane B.** Predicted file collisions, re-checked
at closeout: `src/components/bracket-admin.tsx` and the admin Competition
page (D2, D3), `e2e/bracket-matches.spec.ts` (its "Preview" region, D2) and
`e2e/bracket-tree.spec.ts` (D3). Lane A's files
(`src/app/admin/roster/`, `src/lib/admin-sections.ts`,
`src/components/admin-bottom-bar.tsx`, the Finale Standings slide,
`src/lib/finale.ts`) don't overlap lane B's.

**Docs travel to D6.** `docs/regression-checklist.md`,
`docs/agents/testing.md`, `docs/maintainers-guide.md` and `/about` are
shared by every deliverable, so workers leave them alone and D6 updates
them once from the integrated diff.

### Resolved execution decisions (within the spec)

- **Workers run focused checks only**: `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm build`, then their own e2e spec plus any existing spec
  they changed. The orchestrator runs the full `pnpm gate` once on the
  integrated branch.
- **New e2e specs** are `e2e/regression-r24-<name>.spec.ts`. They load the
  scale demo the way `e2e/regression-r19-scale.spec.ts` does (`pnpm
  seed:demo:scale` in `beforeAll`, `localSeedFiles()` back in `afterAll`),
  and screenshot into `test-results/e2e/regression-r24-<name>-…/` at 1440
  and 390.
- **Finale cut** lives in a pure helper beside `src/lib/finale.ts`, with a
  vitest. Rows ranked ≤ 10 (all ties at 10th) are shown. The "more" count is
  the scorers left out.
- **Jump to your Match** uses the existing "your next Match" logic where
  one exists, rather than a second way to find the viewer's Match.

### Verification map

Run surface: **local + deployed**. Deployed is not exercised by this epic,
which has no schema change and no deploy step. Evidence root
`test-results/` is committed and cleared once on the integrated branch
before the final gate.

| Criterion | Command / action | Real dependencies | Earliest checkpoint | Invalidated by |
|---|---|---|---|---|
| AC Roster | `pnpm e2e e2e/regression-r24-roster.spec.ts` | local Postgres, prod build, stub session | after D1 | roster page or components |
| AC Bracket admin | `pnpm e2e e2e/regression-r24-bracket-admin.spec.ts` | same | after D2 | bracket admin components |
| AC Bracket tree | `pnpm e2e e2e/regression-r24-bracket-tree.spec.ts` | same | after D3 | bracket tree, Competition page layout |
| AC Bottom bar | `pnpm e2e e2e/regression-r24-bottom-bar.spec.ts`; `pnpm test src/lib/admin-sections.test.ts` | same | after D4 | admin sections, bottom bar, fonts |
| AC Finale | `pnpm e2e e2e/regression-r24-finale.spec.ts`; `pnpm test src/lib/finale` | same | after D5 | Finale slide, finale helpers, Standings |
| AC existing assertions updated | `pnpm gate` (smoke + full e2e) | same | integration | any source change |
| AC gate | `pnpm gate` on `feat/r24-scale` | same | integration | any change |
| DoD evidence committed | `git ls-files test-results/e2e/regression-r24-*` | — | closeout | evidence rerun |
| DoD `/about` and maintainers guide | read the D6 diff against the spec's changed surfaces | — | after D6 | D6 docs |
| DoD regression checklist | the D6 diff covers Roster, Bracket admin, Bracket tree, bottom bar and Finale lines | — | after D6 | D6 docs |
| DoD issues and backlog closed | 109–113 `done`, backlog under Done | — | closeout | — |
| DoD one PR | `gh pr view` on `feat/r24-scale` into `staging` | GitHub | closeout | — |

Human gates: none. There is no deploy or reseed, and no access change.

## [PROGRESS]

- 2026-10-04: worktrees, databases and the execution plan are ready; lanes
  A and B dispatched.
- 2026-10-04: D1 `480cabda`, D4 `71db6a76` and D5 `70cc24ca` were accepted
  on lane A. D5 got an orchestrator fix, `8dd68d7d` on lane A: the "more"
  count now counts only left-out rows with points, because a Team on 0
  points is listed but didn't score.
- 2026-10-04: D2 `b6753fd0`/`832242c9` and D3 `7d22e9f6` were accepted on
  lane B.
- 2026-10-04: lane B was merged (`7bf3876f`), then lane A (`d81f98d3`). D6
  docs landed as `d7b72e0c`.
- 2026-10-04: the 17 s finding. The countdown is capped at 8 s
  (`FINALE_MAX_MS`). The issue's "17 s for 17 rows" came from the r19 scale
  spec playing the countdown twice (1440 and 390) and waiting for Replay
  each time, not from one countdown.
- 2026-10-04: the predicted lane B file overlap was real. D2 and D3 both
  touched the bracket e2e specs and `regression-r19-scale.spec.ts` (D3
  had to open D2's collapsible). Lane A's and lane B's files didn't
  overlap except in `regression-r19-scale.spec.ts`, which merged
  cleanly.

## [SCOPE CHANGE]

Both changes were approved by Paul in chat on 2026-10-04.

1. **"News" short label.** `CONTEXT.md` bans "News". Paul kept it as the
   phone bar's short label for Announcements, and `CONTEXT.md` now notes
   the exception. The accessible name, page, nav and route stay
   Announcements.
2. **Bracket admin height.** The AC asked for "at least half as tall". The
   page went from about 12,000 to 7,662 px at 1440, which is 64%, and the
   rest is the 64-Entrant tree, which the spec doesn't change. Paul
   accepted it. The AC was amended to record the heights, and the e2e
   bounds the page below 70% of before.

Correction, not a scope change: a 64-Entrant Bracket has 6 Rounds, not 7.
The spec's Summary was fixed. The AC's "at least five Rounds" is unchanged.

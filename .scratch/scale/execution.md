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

## [AI CODE REVIEW]

2026-10-04. One formal review of `8c1d8db1..d81f98d3` (src, e2e, scripts).
Two fresh reviewers each read the full diff on one axis. The orchestrator
judged every candidate. No finding was blocking. The fixes landed in
`4ecf76ad`, with the review's verdicts below.

**Axis 1: technical implementation and spec conformity.** Decisions 1–5
and every AC conform, with the approved deviations noted.

| # | Finding | Paths | Disposition |
|---|---|---|---|
| F1 | "News" tab's accessible name "Announcements" doesn't contain its visible text (WCAG 2.5.3) | `admin-bottom-bar.tsx` | resolved: visible short label plus sr-only "(full label)", so names read "News (Announcements)" and "Points (Discretionary points)" |
| F2 | "Five Rounds" counted headings in the viewport, not Round columns in the region | `regression-r24-bracket-tree.spec.ts` | resolved: counts Round groups whose right edge is within the Rounds region, with `scrollLeft` 0 |
| F3 | Bottom-bar e2e didn't prove the font | `regression-r24-bottom-bar.spec.ts` | resolved: tabs' font matches Inter in XI and XII; XI's header is JetBrains Mono |
| F4 | Bracket admin height only logged | `regression-r24-bracket-admin.spec.ts` | resolved: asserts below 70% of before (amended AC) |
| F5 | "More" line might fall below the projector's fold | `standings-slide.tsx`, finale spec | resolved: `toBeInViewport()` at 1440×900 and 390×844; it fits with no layout change |
| F6 | "Scored" means total > 0 | `finale.ts` | resolved: documented in the helper |
| F7 | Squads fold with the Entrants | `bracket-builder.tsx` | resolved: intended (locked together); comment added |
| F8 | Collapsible remounts when a lock arrives mid-session | `bracket-builder.tsx` | accepted: the controls are disabled once locked and no data is lost |
| F9 | Jump announces nothing | `bracket-view.tsx`, `bracket-tree.tsx` | resolved: focus moves to the Match (`tabIndex=-1`), highlight kept |
| F10 | Re-slice vs `top.shown` | `standings-slide.tsx` | resolved: passes the computed rows |
| F11 | Roster count announces on each keystroke | `teams-editor.tsx` | accepted: polite status, acceptable |

Probes that came back clean: null emails in the roster filter;
highlight clearing on the Jump click; the breakout (centred `main`, no
sidebar, no page scroll at md–lg); `currentMatchFor` with byes, Squads,
the 3rd place match, multi-Entrant advancing and Closed-early Brackets;
`slice`/`filter` equivalence (ranks never decrease); the frozen Finale
state (the slide remounts each visit); no `if (count > 0)` guards; every
seed restored.

**Axis 2: coding standards.** It conforms on shadcn controls, button
variants, no cursor classes, ADR 0001, helpers with vitests beside them,
banned terms (News allowlisted) and restored seeded data. All eleven
non-blocking items were resolved:
- a dead `DISABLED` test constant
- over-long comment lines
- an escaped `…`
- the `nameMatches` reuse in `roster-filter.ts`
- the roster input's `h-11 sm:h-9 sm:max-w-xs` idiom
- `data-testid` replaced by `data-slot`
- the untested "page is shorter" title (now asserted)
- duplicated e2e helpers, moved into the new `e2e/scale-demo.ts`
- an unused `page` param and a `Locator` type
- `querySelector` with `CSS.escape`
- the `currentMatchFor` JSDoc, an un-exported constant and the missing afterAll comment

## [CLOSEOUT]

2026-10-04. Repository delivery `war-weeker`. Branch `feat/r24-scale` was
compared against `734f28e7` (`origin/staging`), with the spec at
`8c1d8db1`. Two lane branches were merged in (`feat/r24-scale-a`,
`feat/r24-scale-b`; local only, not pushed).

| Deliverable | Commit(s) | Worker / model |
|---|---|---|
| D1 Roster | `480cabda` | atlas-worker / sonnet |
| D4 Bottom bar | `71db6a76` | atlas-worker / sonnet |
| D5 Finale | `70cc24ca`, orchestrator fix `8dd68d7d` | atlas-worker / sonnet; orchestrator |
| D2 Bracket admin | `b6753fd0`, `832242c9` | atlas-worker / sonnet |
| D3 Bracket tree | `7d22e9f6` | atlas-worker / sonnet |
| D6 Docs | `d7b72e0c`, checklist overview line in `0c38a8d6` | atlas-worker / sonnet; orchestrator |
| Review fixes | `4ecf76ad` | atlas-worker / sonnet |

**Verified run command:** `SMOKE_PORT=3124 E2E_PORT=3224 pnpm gate`, run
from `feat/r24-scale` at `cc9d3442` against local Postgres
`war_weeker_r24`. It exited 0:
- typecheck: pass
- lint: 0 errors
- vitest: 212 files, 3975 tests passed
- build: pass
- smoke: every check `ok`
- e2e: 187 passed (11.1 m), 0 failed, 0 flaky

The evidence root `test-results/` was cleared first and holds only this
gate's output, committed in `0c38a8d6`. That commit's only other change is
a docs line, which doesn't affect any check.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC Roster | PASS | `regression-r24-roster` in the gate; `test-results/e2e/regression-r24-roster-*/` |
| AC Bracket admin | PASS (amended AC) | `regression-r24-bracket-admin`; about 12,000 → 7,662 px at 1440, asserted < 70%; `test-results/e2e/regression-r24-bracket-adm-*/` |
| AC Bracket tree | PASS | `regression-r24-bracket-tree`; `test-results/e2e/regression-r24-bracket-tre-*/` |
| AC Bottom bar | PASS | `regression-r24-bottom-bar` plus the `admin-sections` vitest; `test-results/e2e/regression-r24-bottom-bar-*/` |
| AC Finale | PASS | `regression-r24-finale` plus the `finaleTopRows` vitests (tie at 10th, fewer than 10); `test-results/e2e/regression-r24-finale-*/` |
| AC existing assertions updated | PASS | bracket-matches, r5, r19-scale and admin-shell were updated, not removed; full e2e and smoke green |
| AC `pnpm gate` | PASS | gate exit 0 (above) |
| DoD evidence committed | PASS | `0c38a8d6` |
| DoD `/about` and maintainers guide | PASS | `d7b72e0c`: maintainers guide and organizer guide updated. `/about` copy is still true, and no still shows a changed surface (`scripts/about-media.ts` shoots 1280×720 desktop pages: schedule, points, the home Standings and the Finale Title) |
| DoD regression checklist | PASS | `d7b72e0c`, `0c38a8d6`: Roster, Bracket admin, Bracket tree, bottom bar and Finale lines |
| DoD issues and backlog | PASS | 109–113 `done`, backlog moved under Done (this commit) |
| DoD one PR | PASS | PR link below |

**Deviations (approved):**
- the "News" label with a `CONTEXT.md` exception
- the Bracket admin height AC amended
- 6 Rounds, not 7
- Add Participant / Import sit at the top of the Roster section, which is below the Teams editor in a teams War Week

**Isolation re-check:** lane B's predicted overlap was real: bracket e2e
specs, and `regression-r19-scale.spec.ts`, which D3 had to change for
D2's collapsible. The prediction that lanes A and B wouldn't overlap held,
except for `regression-r19-scale.spec.ts` (different hunks; it merged
cleanly).

**Run surface:** local. This epic has no schema change and no deploy step;
staging picks it up on merge.

**Seen during fixes, not reproduced in the gate:**
- one vitest failure that passed on rerun
- one strict-mode flake in `regression-r22-hosts` (two `[data-finale-slide="title"]`)
Both passed in the full gate.

# Execution: Cuts and admin consistency (Epic R26)

Contract: [`spec.md`](./spec.md) (stable; not rewritten here). Branch
`feat/r26-cuts-and-consistency` off `staging` at `e12e3b8c`, in the integration
worktree `.claude/worktrees/r26-cuts-and-consistency/war-weeker/integration`.

## [EXECUTION PLAN]

Run surface: **local** (deploy is the human's merge; no deployed criterion).

### Structure: two waves of four

| ID | Decisions | Deliverable | Wave | Depends on | Model |
|---|---|---|---|---|---|
| D1 | 1 | MCP and `llms.txt` removed, ADR 0013, docs and smoke | 1 | — | sonnet |
| D2 | 2, 3 | Create next War Week copies nothing, lives in Lifecycle, server rule | 1 | — | sonnet |
| D3 | 4 | Announcements create/edit in one dialog, old routes gone, rule documented | 1 | — | sonnet |
| D4 | 5, 6 | Entrants autosave (H2H, Bracket, League), Head-to-head "A vs B" | 1 | — | opus |
| D5 | 7 | Participation checkbox bug, regression test first | 2 | — | sonnet |
| D6 | 8, 9 | Bracket lock icons and tooltips, small Brackets centered | 2 | D4 | sonnet |
| D7 | 10 | `?group=` on the Participant Competitions list | 2 | — | sonnet |
| D8 | 11 | `/about` "What it does" one per row, three-phone demo removed | 2 | D1 | sonnet |

Isolation: each worker gets its own worktree under
`.claude/worktrees/r26-cuts-and-consistency/war-weeker/<dN>/` on branch
`feat/r26-cuts-and-consistency-<dN>`, its own database `war_weeker_r26<dN>`
and its own `SMOKE_PORT`/`E2E_PORT`, so builds, smoke and e2e run side by side.
No `.env.local` in any worktree: the CI env (`DATABASE_URL`, `DATABASE_DRIVER=pg`)
is passed on the command line.

Predicted collisions that set the edges: D6 after D4 (both may touch
`src/components/bracket-builder.tsx`); D8 after D1 (both touch
`scripts/about-media.ts` and `src/app/about/page.tsx`). Shared docs
(`docs/regression-checklist.md`, `docs/maintainers-guide.md`, `CONTEXT.md`) are
edited in place per page by each worker and merged by the orchestrator. The
`docs/agents/testing.md` smoke/e2e rows are one line each, so only the
orchestrator edits them (D1 makes only its MCP edits there). Re-checked at
closeout.

### Verification map

Evidence root `test-results/` (cleared once before the final run, then
committed). Screenshots under `test-results/e2e/<test>/`. Captured command
output under `test-results/r26/`.

| Criterion | Command / action | Surface | Real deps | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|---|---|
| AC1 | `pnpm smoke` (404 checks) + grep for `src/mcp`, `MCP_TOKEN`, MCP packages | local prod build | Postgres | both 404; greps empty | `test-results/r26/ac1-grep.txt`, `test-results/r26/smoke.txt` | after D1 | any change to routes, smoke, package.json |
| AC2 | `pnpm test src/mutations/war-week-lifecycle.test.ts src/lib/war-week-lifecycle.test.ts` | vitest | Postgres | new War Week `upcoming`, defaults, no Competitions/FAQ | `test-results/r26/vitest.txt` | after D2 | lifecycle code |
| AC3 | vitest on the rule + `e2e/regression-r26-create-next.spec.ts` | vitest + Chromium | Postgres | button only on latest-by-start `complete`; server refuses otherwise | vitest output; `test-results/e2e/regression-r26-create-next*` | after D2 | lifecycle code, settings page |
| AC4 | `e2e/regression-r26-announcements.spec.ts` (1440, 390) + smoke 404 | Chromium + smoke | Postgres | create/edit in dialog; `/new`, `/[id]` 404 | screenshots; smoke output | after D3 | announcements UI/routes |
| AC5 | `e2e/regression-r26-entrants.spec.ts` | Chromium | Postgres | no Save button, autosave status, locked change shows message and reverts | screenshots | after D4 | entrants picker, actions |
| AC6 | same spec, H2H section | Chromium | Postgres | two pickers, mutual exclusion, saves once both set | screenshots | after D4 | entrants picker |
| AC7 | participation regression test, shown failing on base then passing | vitest (RTL) | — | ticked stays ticked; refusal reverts with reason | `test-results/r26/ac7-red.txt`, `vitest.txt` | after D5 | participation-builder |
| AC8 | `e2e/regression-r26-bracket-locks.spec.ts` (1440, 390) | Chromium | Postgres | lock icons, no repeated message, tooltip on disabled control | screenshots | after D6 | bracket view |
| AC9 | `e2e/regression-r26-bracket-center.spec.ts` (1440, 390) | Chromium | Postgres | 4-Entrant centered, 64-Entrant left and scrolls | screenshots | after D6 | bracket tree layout |
| AC10 | `e2e/regression-r26-group-tab.spec.ts` | Chromium | Postgres | `?group=` set, Back returns to tab, no extra history | spec output | after D7 | competitions list |
| AC11 | `e2e/regression-r26-about.spec.ts` (1440, 390, light, dark) | Chromium | Postgres | no three-phone demo; one feature per row | screenshots | after D8 | about page, media |
| DoD1 | ADR file exists and supersedes MCP parts | file | — | `docs/adr/0013-*` | path | after D1 | — |
| DoD2 | grep `docs/agents/planning.md`, `testing.md` for MCP | file | — | no `/api/mcp`, no MCP row/commands | `ac1-grep.txt` | after D1 | docs edits |
| DoD3 | read CONTEXT, maintainers guide (create/edit rule), regression checklist (changed pages, both viewports), `/about` | file + review | — | updated | review | after wave 2 | docs edits |
| DoD4 | full `pnpm e2e` after clearing `test-results/` | Chromium | Postgres | screenshots committed | `test-results/e2e/` | integrated | any code change |
| DoD5 | `pnpm format:check && pnpm gate`; CI on the PR | local + GitHub CI | Postgres | all green | `test-results/r26/gate.txt`; PR checks | integrated / PR | any change |

Human gates: none planned beyond Docker running locally (done) and the human
reviewing and merging the PR.

## [PROGRESS]

- Wave 1 (D1–D4) and wave 2 (D5–D8) integrated, plus D8b. All merges were clean (git
  auto-merged the shared docs); D5, D7 and D8 were dispatched early from the
  wave-1 head (they had no D4 dependency), D6 after D4.
- Orchestrator fixes: D3, an opt-in `fullHeight` on `ResponsiveSheetDialog` /
  `SetupListRow` / `SetupAddButton` so the Announcement sheet is full height on a
  phone (the spec's wording) without changing every entity's sheet; D8b, a
  maintainers-guide note that a first-time still needs a second about-media run;
  the `docs/agents/testing.md` smoke and e2e rows for every R26 check.

## [SCOPE CHANGE]

- **D8b, phone-viewport `/about` stills** (approved by the product owner,
  2026-10-07): at 390 the desktop stills were unreadable; each "What it does"
  feature now has `<slug>-phone(-dark).png` captured by `scripts/about-media.ts`
  and shown below `md`.
- **AC9 at 390** (reading of Decision 9, recorded as a deviation): a 4-Entrant
  tree (~480px) is wider than a 390 phone's region (~358px), so by Decision 9's
  rule it starts at the left and scrolls there; it is centered at 1440 (admin and
  Participant page).

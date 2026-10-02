# 69: The Participation Format

**What to build:** A new Format, **`participation`**, for things where taking part earns points (Black Midnight, workouts, Spirit submissions, HQ attendance). The Host (or an Organizer) ticks who took part; optionally Participants **check in** themselves. Points land when the Host presses **Close** and are withdrawn by **Reopen**, like `games`.

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A17; grilling Q17, Q25; wiki survey in `../grilling-2026-10-01.md`

## Decisions

- **Individual scoring:** N points per Participant who took part (Counts Toward Team as today).
- **Team scoring**, the Host picks one:
  - **Ranked by headcount:** Teams ranked by how many of their Participants took part; Placement Points by place (ties share the higher place, the Bracket/Games tie rule).
  - **Per person:** N points to the Team per Participant who took part.
- **Self check-in:** a per-Competition switch, off by default; optional check-in close time. A Participant checks in or out until it closes (account linking only); the Host/Organizer can add or remove anyone until Close.
- The Competition page shows who took part (and the team counts in team scoring); Home's Recent results (ticket 56) shows a Close.
- Access: check-in is a new Participant write: extend ADR 0006 (or a new ADR) and `can`. Red-team (schema and access).
- CONTEXT.md: **Participation** Format, **Check in**.

## Acceptance criteria

- [ ] Unit tests for scoring: individual N each; team ranked by headcount with ties; team per person; Close/Reopen idempotence.
- [ ] e2e: a Host creates a team Participation Competition (ranked by headcount, 5/3/1), two Participants check in, the Host ticks a third, Close moves the Standings, Reopen withdraws.
- [ ] A seeded `participation` Competition in the demo; seeds load twice; smoke covers its page.
- [ ] `pnpm gate` passes.

## [CLOSEOUT]

2026-10-02, atlas-implement (Claude Opus 5.5). Deliverable D69 (worker: atlas-worker, opus; commit `2941865`), plus orchestrator integration and the review fixes in `2b06e18`. Verified on `feat/regression-r12-participation-awards` at `2b06e18` (code; the closeout commit adds only `.scratch/` and `test-results/`), local Postgres `war-weeker-postgres` :2345, `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`. Final gate: `pnpm format:check && pnpm gate` exit 0 (format clean; lint 0 errors, 7 existing `<img>` warnings; vitest 167 files / 3604 tests; build; smoke 243 ok; Playwright 86 passed) → `test-results/r12/gate.txt`. PR: _(added after it opens)_.

| AC | Verdict | Evidence |
|---|---|---|
| Unit tests for scoring: individual N each; team ranked by headcount with ties; team per person; Close/Reopen idempotence | PASS | `pnpm exec vitest run src/lib/participation src/mutations/participation src/actions/participation`: 56 passed → `test-results/r12/unit-participation.txt` |
| e2e: Host runs a team Participation Competition (ranked 5/3/1), two check in, a third ticked, Close moves the Standings, Reopen withdraws | PASS | `e2e/regression-r12-participation.spec.ts` passed in the gate (read as Red-team C1: an Organizer creates it and assigns the Host, who does the rest); screenshots at 1440×900 and 390×844 in `test-results/e2e/regression-r12-participati-3439d--Standings-Reopen-withdraws-chromium/` |
| A seeded `participation` Competition in the demo; seeds load twice; smoke covers its page | PASS | "Daily Workout Check-in" in `seeds/demo/xi.json` (Red-team B1: XI, not XII); smoke loads every seed twice and checks its page, a refused and an accepted check-in over HTTP, and `get_participation` with no `@` → `test-results/r12/gate.txt` |
| `pnpm gate` passes | PASS | `test-results/r12/gate.txt` |

ADR 0009 records Check in. Deviations: none beyond the plan's Red-team round 1 and the review's approved N-4 (a half-filled close time is dropped, as in the Games builder).

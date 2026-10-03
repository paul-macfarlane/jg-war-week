# Epic R14: Quick wins from the R8 checklist run

**What to build:** Five small fixes the R8 regression checklist run found: the admin refusal page wears the War Week (78), the Points Entry form comes first on a phone (79), Home drops the banner placeholder (80), the Organizer guide says where You actually shows (81), and Competition Group tabs wrap on a phone (82).

**Tickets:** `78`, `79`, `80`, `81`, `82` (files under `../issues/`)

**Branch:** `fix/regression-r14-quick-wins`

**Blocked by:** none

**Status:** in-progress

**Red-team:** not required (no Drizzle schema, auth or access change).

**Source:** R8 checklist run (ticket 53, 2026-10-02); triaged by Paul 2026-10-02.

## Order

All independent; one PR.

## Acceptance criteria

Each ticket's own, plus:

- [ ] `/about`, `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where a change is user-visible (team rules).
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-02 (Paul): triaged. 79: the form first, Bracket and Games links below it. 80: drop the placeholder. 81: fix the guide, no Team highlight. 82: wrap the tabs. Tickets `ready-for-agent`, batched into one PR.
- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r14`): claimed with tickets 78–82; `ready-for-agent` → `in-progress`. Execution record: [`R14-execution.md`](./R14-execution.md).

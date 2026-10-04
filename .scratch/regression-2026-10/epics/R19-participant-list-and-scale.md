# Epic R19: Participant list and scale

**What to build:** The Participant Competitions list shows status, round, Winner and a description preview (105); a 100-Participant demo seed and a scale pass (106).

**Tickets:** `105`, `106` (files under `../issues/`)

**Branch:** `feat/regression-r19-list-and-scale`

**Blocked by:** R18 merged into `staging` (done: PR #130, 2026-10-03; ticket 105's preview reads the rich-text description; R18 red-team pass 1, W7).

**Status:** done

**Red-team:** not required unless the scale pass needs a schema change.

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## Order

105 → 106 (the scale pass covers the new list).

## Acceptance criteria

Each ticket's own, plus:

- [x] `/about` (copy and media via `scripts/about-media.ts`), `docs/maintainers-guide.md` and `docs/regression-checklist.md` updated where user-visible (team rules).
- [x] `CONTEXT.md` updated per the grilling record's glossary list for what ships here.
- [x] Each ticket file records its closeout and is `done` in this branch.
- [x] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r19`): one work package, one branch, one PR. Status lists and preview (105), the 100-Participant scale demo and pass (106), docs, review fixes. Findings 108–113 filed `needs-triage`. Execution record and verdicts: [`R19-execution.md`](./R19-execution.md). `ai-review` → `done`.

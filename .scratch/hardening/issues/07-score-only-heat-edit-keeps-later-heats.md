# 07: A score-only Heat edit keeps later Heats

**What to build:** Re-recording a decided Heat with the **same finishing order** (only scores change) doesn't reset later Heats. Today any edit resets everything downstream, and the reported reset count includes Heats that have no result (accepted in `.scratch/brackets/execution.md`; engine at `src/lib/bracket/engine.ts`).

**Blocked by:** none

**Status:** done

## Acceptance criteria

- [x] Engine unit tests: the same order with new scores resets nothing downstream; a changed winner resets exactly the Heats the old winner reached; the reset count counts only Heats that had a result.
- [x] The confirm copy for a winner change shows the corrected count.
- [x] `pnpm gate` passes.

## Comments

**2026-09-26, Claude (atlas-implement, epic A) — [CLOSEOUT]** Delivered by D07 (worker: opus, `f7020dc`). The engine's `resetByResult(bracket, heatId, winnerId)` returns only the later Heats that had a result, and only when the winner changes. `recordHeatResult` and the Heat Result form's confirm both use it, and it replaces `resetDownstream`. `advance` leaves a later Heat alone when it already holds that winner. Review fix `86b1af6` changes the wording to "the later Heats that followed from it" (CONTEXT, organizer guide), since those Heats can reset by cascade.
- AC1 PASS: `src/lib/bracket/engine.test.ts` (a score-only edit keeps the later Heats; a winner change names exactly the decided later Heats; undecided later Heats are cleared but not counted), in `pnpm gate` on `86b1af6`
- AC2 PASS: the confirm names come from `resetByResult` for the chosen winner (`src/components/bracket-results.tsx`). Smoke's bracket loop asserts 0 resets on a score-only edit and the decided-only count on a winner change (`ok - bracket loop …` in `test-results/hardening-a-gate/gate.txt`)
- AC3 PASS: `test-results/hardening-a-gate/gate.txt`
- PR: https://github.com/paul-macfarlane/jg-war-week/pull/78

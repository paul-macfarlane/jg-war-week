# 07: A score-only Heat edit keeps later Heats

**What to build:** Re-recording a decided Heat with the **same finishing order** (only scores change) doesn't reset later Heats. Today any edit resets everything downstream, and the reported reset count includes Heats that have no result (accepted in `.scratch/brackets/execution.md`; engine at `src/lib/bracket/engine.ts`).

**Blocked by:** none

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Engine unit tests: the same order with new scores resets nothing downstream; a changed winner resets exactly the Heats the old winner reached; the reset count counts only Heats that had a result.
- [ ] The confirm copy for a winner change shows the corrected count.
- [ ] `pnpm gate` passes.

## Comments

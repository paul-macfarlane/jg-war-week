# 05: Refuse scoring changes on a finalized Bracket

**What to build:** While a Competition's Bracket is finalized, `updateCompetition` refuses changes to Placement Points or scoring ("Un-finalize the Bracket first"). Today it doesn't check `finalizedAt`, so the generated Points Entries go stale (`src/mutations/setup.ts:553-580`).

**Blocked by:** none

**Status:** in-progress

## Acceptance criteria

- [ ] A mutation test: with the Bracket finalized, editing Placement Points is refused, and nothing changes. With it un-finalized, the edit succeeds.
- [ ] Other Competition fields (name, description) still save while finalized.
- [ ] CONTEXT.md "Bracket rules" gains this sentence.
- [ ] `pnpm gate` passes.

## Comments

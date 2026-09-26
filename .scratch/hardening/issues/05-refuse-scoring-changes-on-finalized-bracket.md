# 05: Refuse scoring changes on a finalized Bracket

**What to build:** While a Competition's Bracket is finalized, `updateCompetition` refuses changes to Placement Points or scoring ("Un-finalize the Bracket first"). Today it doesn't check `finalizedAt`, so the generated Points Entries go stale (`src/mutations/setup.ts:553-580`).

**Blocked by:** none

**Status:** done

## Acceptance criteria

- [x] A mutation test: with the Bracket finalized, editing Placement Points is refused, and nothing changes. With it un-finalized, the edit succeeds.
- [x] Other Competition fields (name, description) still save while finalized.
- [x] CONTEXT.md "Bracket rules" gains this sentence.
- [x] `pnpm gate` passes.

## Comments

**2026-09-26, Claude (atlas-implement, epic A) — [CLOSEOUT]** Delivered by D05 (worker: sonnet, `f1bd839`). The pure guard is `competitionGuardError` in `src/lib/setup.ts`: while `finalizedAt` is set, a change to scoring or Placement Points is refused with "This Competition's Bracket is finalized. Un-finalize the Bracket first.", and `null` and `[]` count as equal. Review fix `86b1af6` adds a description save to the mutation test and the rule to the organizer and maintainer's guides.
- AC1 PASS and AC2 PASS: `src/mutations/setup.test.ts` "refuses Placement Points or scoring changes while the Bracket is finalized, but not other fields" (rename and description save while finalized; the refused edit leaves the row unchanged; succeeds once un-finalized), in `pnpm gate` on `86b1af6`
- AC3 PASS: CONTEXT.md "Bracket rules", last bullet
- AC4 PASS: `test-results/hardening-a-gate/gate.txt`
- PR: https://github.com/paul-macfarlane/jg-war-week/pull/78

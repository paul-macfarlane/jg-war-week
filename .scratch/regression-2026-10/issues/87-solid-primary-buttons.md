# 87: Solid buttons for primary actions

**What to build:** Action buttons look like buttons. Primary actions are solid (`default`), secondary `outline`, and `ghost` only for icon or tertiary actions. The visible offender is the Heat card's "Record result" / "Edit" (a `text-primary` span over a full-card ghost button, `src/components/bracket-results.tsx:264,305`); audit admin and Participant pages for others.

**Blocked by:** none

**Status:** in-progress

**Source:** Paul's regression feedback 2026-10-03 (Admin: ghost buttons); grilling Q12

## Decisions

- The rule goes in `docs/maintainers-guide.md` (UI section).
- The Heat card gets a visible solid "Record result" button; R17 (`100`) moves recording into the tree and keeps the rule.

## Acceptance criteria

- [ ] Audit list (each primary action and its variant) in the ticket's closeout.
- [ ] Screenshot of the admin Bracket with a solid Record result.
- [ ] `pnpm gate` passes.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r15`): claimed with Epic R15; `ready-for-agent` → `in-progress`. Execution record: [`R15-execution.md`](../epics/R15-execution.md).

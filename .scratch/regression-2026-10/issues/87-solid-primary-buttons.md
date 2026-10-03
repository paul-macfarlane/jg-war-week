# 87: Solid buttons for primary actions

**What to build:** Action buttons look like buttons. Primary actions are solid (`default`), secondary `outline`, and `ghost` only for icon or tertiary actions. The visible offender is the Heat card's "Record result" / "Edit" (a `text-primary` span over a full-card ghost button, `src/components/bracket-results.tsx:264,305`); audit admin and Participant pages for others.

**Blocked by:** none

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: ghost buttons); grilling Q12

## Decisions

- The rule goes in `docs/maintainers-guide.md` (UI section).
- The Heat card gets a visible solid "Record result" button; R17 (`100`) moves recording into the tree and keeps the rule.

## Acceptance criteria

- [x] Audit list (each primary action and its variant) in the ticket's closeout.
- [x] Screenshot of the admin Bracket with a solid Record result.
- [x] `pnpm gate` passes.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r15`): claimed with Epic R15; `ready-for-agent` → `in-progress`. Execution record: [`R15-execution.md`](../epics/R15-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r15`): done. The rule is in `docs/maintainers-guide.md`. The Heat card has a visible solid "Record result" (outline "Edit" once recorded) whose stretched `::after` keeps the whole card one tap target; e2e `e2e/regression-r15-solid-buttons.spec.ts` asserts `bg-primary` and that a click on the card body opens the result. Screenshot `test-results/e2e/regression-r15-solid-butto-*/admin-bracket-record-result.png`.

  Audit (action — file — old → new):
  - Heat card Record result — `bracket-results.tsx` — ghost overlay + text span → `default`.
  - Heat card Edit — `bracket-results.tsx` — ghost overlay + text span → `outline`.
  - Setup list "Add …" (Teams, Participants, Competitions, Days…) — `setup-row.tsx` — `outline` → `default`.
  - Already `default`: Bracket Generate, Run results, every form's Save/Import/Add submit (squad, profile, points entry, announcement, heat schedule, roster import), New Announcement, Enroll/Join, Check in, the selected Schedule day.
  - Correctly `outline` (secondary): Re-roll, Add Squad and All Teams beside Generate, Roster Import, Reopen/Unstart, Withdraw/Leave, Cancel, Clear, Hide/Show, Pin, Restore, Move, Edit, Delete, Replay, Time & place, Sign out, the error screen's link.
  - `ghost` only for icon or tertiary: dialog close, remove chip, remove player, Reset to derived.

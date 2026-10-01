# 40: The Award form doesn't name the Team Label in free-for-all

**What to build:** In a free-for-all War Week with no Award Team, the Award form's help and placeholder stop mentioning the Team Label.

**Blocked by:** none

**Status:** done

**Source:** Epic R5 follow-up (`../epics/R5-execution.md` [AI CODE REVIEW] R1), 2026-09-30

## Need

- **Organizer:** Ticket 32 hides the Award form's Team field in a free-for-all War Week (`src/components/award-form.tsx`, `showTeam`). The rest of the form still talks about Teams: the Recipients help reads "A {Team Label}, Participants, or both…" (`award-form.tsx:166`) and the Participants placeholder "Find by name or {Team Label}" (`:218`). On XII (free-for-all) that names a thing the Organizer can't pick.

## Decisions

- Use the same rule as the hidden field (`showTeam`): when the Team field is hidden, the help reads as Participants only and the placeholder "Find by name". When an existing Award already has a Team (the field stays), keep today's copy.
- Copy only; no change to what an Award can hold.

## Acceptance criteria

- [x] With the Team field hidden, the form's help and placeholder don't contain the Team Label; with it shown, they read as today.
- [x] `src/components/award-form.test.tsx` covers both cases.
- [x] `pnpm gate` passes.

## Comments
- 2026-09-30 (Paul): triaged `needs-triage` → `ready-for-agent`; delivered in Epic R6 (`../epics/R6-follow-ups-from-r5.md`).
- 2026-09-30: claimed, `ready-for-agent` → `in-progress`; branch `feat/regression-r6-follow-ups` from `staging` `d9b2a88`.
- 2026-09-30 [CLOSEOUT]: `df579c3`: with the Team field hidden, the Recipients help reads "Participants only." and the placeholder "Find by name"; shown, as before. `award-form.test.tsx` (red first: 1 failed). Evidence `src/components/award-form.test.tsx`; `pnpm format:check && pnpm gate` exit 0 at `d9be4c4` (`test-results/r6-gate/gate.txt`: 3121 unit, smoke 201 ok, e2e 53 passed). Small-change route (no separate AI code review, per Paul). `in-progress` → `done`.

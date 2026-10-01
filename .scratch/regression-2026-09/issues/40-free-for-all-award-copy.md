# 40: The Award form doesn't name the Team Label in free-for-all

**What to build:** In a free-for-all War Week with no Award Team, the Award form's help and placeholder stop mentioning the Team Label.

**Blocked by:** none

**Status:** in-progress

**Source:** Epic R5 follow-up (`../epics/R5-execution.md` [AI CODE REVIEW] R1), 2026-09-30

## Need

- **Organizer:** Ticket 32 hides the Award form's Team field in a free-for-all War Week (`src/components/award-form.tsx`, `showTeam`). The rest of the form still talks about Teams: the Recipients help reads "A {Team Label}, Participants, or both…" (`award-form.tsx:166`) and the Participants placeholder "Find by name or {Team Label}" (`:218`). On XII (free-for-all) that names a thing the Organizer can't pick.

## Decisions

- Use the same rule as the hidden field (`showTeam`): when the Team field is hidden, the help reads as Participants only and the placeholder "Find by name". When an existing Award already has a Team (the field stays), keep today's copy.
- Copy only; no change to what an Award can hold.

## Acceptance criteria

- [ ] With the Team field hidden, the form's help and placeholder don't contain the Team Label; with it shown, they read as today.
- [ ] `src/components/award-form.test.tsx` covers both cases.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-30 (Paul): triaged `needs-triage` → `ready-for-agent`; delivered in Epic R6 (`../epics/R6-follow-ups-from-r5.md`).
- 2026-09-30: claimed, `ready-for-agent` → `in-progress`; branch `feat/regression-r6-follow-ups` from `staging` `d9b2a88`.

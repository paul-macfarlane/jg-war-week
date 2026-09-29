# 23: Result choices use shadcn toggle-group

**What to build:** Replace the hand-rolled `aria-pressed` button groups with shadcn's `toggle-group`.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Epic R3 follow-up (`../epics/R3-execution.md` [CLOSEOUT]), 2026-09-29

## Need

- **Host, Participant:** The Game form's "Who won?" (`src/components/game-form.tsx`) and the Heat result form's choice (`src/components/heat-result-form.tsx`) are single-choice groups built from `Button` + `aria-pressed` inside `role="group"`. CLAUDE.md says not to hand-roll a control shadcn has. Accepted as a deviation in Epic R3's code review (S10) because R3 followed the existing Heat form.

## Acceptance criteria

- [ ] `pnpm dlx shadcn@latest add toggle-group`; both forms use it.
- [ ] Keyboard and screen-reader behaviour at least as good as today; e2e selectors updated.
- [ ] `pnpm gate` passes.

## Comments
- 2026-09-29 (Paul): triaged `ready-for-agent`; delivered in Epic R4 (`../epics/R4-follow-ups-from-r3.md`).

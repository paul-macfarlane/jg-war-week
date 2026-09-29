# Epic R2: Light and dark Appearance Themes

**What to build:** Ticket 12, then re-check ticket 13 (likely moot). Also 22 (a disabled Enroll button looks disabled, in both modes) and 26 (the /about Games still shows its title, when R2 regenerates the /about media).

**Tickets:** `12`, `22`, `26` (`13` checked at closeout) (files under `../issues/`)

**Branch:** `feat/regression-r2-light-dark`

**Blocked by:** R3 merged (both change the schema; run them one after the other); R4 merged (it replaces the form controls R2 themes)

**Status:** needs-triage

## Order and parallelism

1. Derivation and contrast tests first, then the switcher, then the Organizer overrides.
2. Plan red-teamed (schema change).

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] Ticket 13 closed as moot or rescoped, with a comment.
- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and e2e, and passes.
- [ ] `pnpm gate` passes locally.

## Comments
- 2026-09-29 (Paul): added tickets 22 and 26 from Epic R3's follow-ups; both are colour or media work R2 already does. R2 now waits on R4 too, so it themes the final form controls.

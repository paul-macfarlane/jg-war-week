# Epic R2: Light and dark Appearance Themes

**What to build:** Ticket 12, then re-check ticket 13 (likely moot).

**Tickets:** `12` (`13` checked at closeout) (files under `../issues/`)

**Branch:** `feat/regression-r2-light-dark`

**Blocked by:** R3 merged (both change the schema; run them one after the other)

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

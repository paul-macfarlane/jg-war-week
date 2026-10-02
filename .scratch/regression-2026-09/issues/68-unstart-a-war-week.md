# 68: Unstart a War Week

**What to build:** A lifecycle action **Unstart** (`live → upcoming`), Organizer-only, behind a confirm, allowed only while the War Week has no Points Entries, no Heat results and no Games. The Lifecycle box (Settings, after ticket 57) adds one line on what Live changes: "Live makes this the War Week everyone lands on. Nothing is hidden before then."

**Blocked by:** none

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A1; grilling Q7

## Decisions

- `lifecycleActionError` gains the Unstart rule with its refusal ("Points have been entered; Unstart isn't available."); re-checked in the action, under a lock like the other lifecycle actions.
- CONTEXT.md lifecycle rules: replace "There's no way back to `upcoming`" with the Unstart rule.

## Acceptance criteria

- [ ] Unit tests: Unstart allowed with nothing scored; refused with a Points Entry, a Heat result or a Game; refused for non-Organizers and for non-live editions.
- [ ] e2e: Start then Unstart a fresh edition; it shows Upcoming again.
- [ ] `pnpm gate` passes.

# 06: Clarify or remove Competition "Max points"

**What to build:** "Max points" on a Competition isn't clear to an Organizer. Today it only bounds the Placement Points rows (`src/components/placement-points-rows.tsx:59`) and Points Entry.

**Blocked by:** none

**Status:** needs-triage

**Source:** regression feedback item 11

## Notes

Per the scope rule, prefer removing it. If it stays, it needs help text saying exactly what it limits.

## Acceptance criteria

- [ ] Either the field is gone (schema contract step planned and red-teamed), or the form explains what it limits.
- [ ] `pnpm gate` passes.

## Comments

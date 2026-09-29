# 07: Record a Bracket result in a dialog on large screens

**What to build:** Recording a Bracket result in a bottom sheet is awkward on larger screens.

**Blocked by:** none

**Status:** needs-triage

**Source:** regression feedback item 13

## Notes

Use a centered dialog at `lg` and up and keep the sheet on phones (shadcn Drawer/Dialog responsive pattern).

## Acceptance criteria

- [ ] At desktop width, recording a result opens a dialog; at phone width, a sheet.
- [ ] The Bracket Playwright flow still passes.
- [ ] `pnpm gate` passes.

## Comments

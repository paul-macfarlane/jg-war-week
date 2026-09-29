# 01: Footer sits at the bottom on short pages

**What to build:** On pages whose content is shorter than the viewport, the site footer rides up under the content instead of sitting at the bottom of the screen.

**Blocked by:** none

**Status:** in-progress

**Source:** regression feedback item 6

## Notes

The edition layout wrapper has `min-h-dvh` (`src/app/[edition]/layout.tsx:53`) but the main content doesn't grow to push the footer down. Check /about, /history and /admin too.

## Acceptance criteria

- [ ] On a short page (e.g. an empty FAQ) at phone and desktop widths, the footer touches the bottom of the viewport.
- [ ] On a long page the footer still follows the content.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-28 (Paul, via `/atlas-implement` of Epic R1): `needs-triage → ready-for-agent`.
- 2026-09-28: `ready-for-agent → in-progress` — delivered inside Epic R1 on branch `feat/regression-r1-quick-wins` (`/atlas-implement`, work package `regression-r1`).

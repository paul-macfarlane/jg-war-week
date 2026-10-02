# 71: An Award Category through the years

**What to build:** On History, a view per Award Category listing every War Week's recipients newest first ("War Week MVP: XII …, XI …, …, IV MVP 1st Place …"), reachable from the Archive and from a Category on any Awards page.

**Blocked by:** 70

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** grilling Q26

## Acceptance criteria

- [ ] `/history/awards/<category>` (or the plan's route) lists recipients by War Week, newest first, with Profile names where linked (ticket 60) else roster names.
- [ ] Screenshots at both viewports; smoke covers the route.
- [ ] `pnpm gate` passes.

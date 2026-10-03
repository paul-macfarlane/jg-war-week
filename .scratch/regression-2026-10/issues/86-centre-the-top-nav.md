# 86: Centre the top nav

**What to build:** The desktop top nav's links sit in the true centre of the header, whatever the width of the War Week name and tagline on the left. Today `justify-between` (`src/components/primary-nav.tsx:151`) centres them between uneven siblings, so they drift right.

**Blocked by:** none

**Status:** in-progress

**Source:** Paul's regression feedback 2026-10-03 (Participant: nav uncentred); grilling Q12

## Decisions

- Three-column grid (`grid-cols-[1fr_auto_1fr]`, right column `justify-self-end`); a long tagline truncates rather than pushing the links.

## Acceptance criteria

- [ ] Screenshots at 1280 and 1024 wide with War Week XI and XII (different name/tagline widths): the links' centre is within a few pixels of the header's centre (asserted in e2e by bounding boxes).
- [ ] `pnpm gate` passes.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r15`): claimed with Epic R15; `ready-for-agent` → `in-progress`. Execution record: [`R15-execution.md`](../epics/R15-execution.md).

# Epic R7: Public pages

**What to build:** The public pages (About, Privacy, Terms) read as one current product: About sells War Week's single place for Jahnel Group, without hackathon leftovers, redundancy or over-promises, wears the current War Week's theme in its copy *and* its stills, and fits a phone; Privacy and Terms follow the current War Week's theme and point people to the Jahnel Group admins. A regression checklist lets an agent re-check all of this every year.

**Tickets:** `42`, `43`, `44`, `45` (files under `../issues/`)

**Branch:** `feat/regression-r7-public-pages`

**Blocked by:** none

**Status:** in-progress

**Red-team:** not required (no Drizzle schema, auth or access change; Privacy and Terms stay in `PUBLIC_PATHS`).

**Source:** Paul's public-pages review, 2026-10-01 (16 items), grilled the same day.

## Order

45 (checklist) and 44 (Privacy and Terms) are independent. 42 (About copy) settles the six feature cards; 43 (XII demo and stills) is blocked by 42 because it captures one still per card.

## Acceptance criteria

Each ticket's own, plus:

- [ ] Every Public Pages line in `docs/regression-checklist.md` passes at 1440×900 and 390×844 against a local build seeded with `pnpm seed:demo:xii`, with a screenshot per page per viewport under `test-results/r7-public-pages/`.
- [ ] Each ticket file records its closeout and is `done` in this branch.
- [ ] CI on the PR passes.
- [ ] `pnpm format:check && pnpm gate` passes.

## Comments

- 2026-10-01 (Paul): grilled and approved; tickets 42–45 `ready-for-agent`.

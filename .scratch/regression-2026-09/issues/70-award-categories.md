# 70: Award Categories that carry across War Weeks

**What to build:** A global list of **Award Categories** that Organizers manage under Awards → Categories (add, rename, archive; an archived Category stays on past Awards but can't be picked). An Award optionally picks a Category. Seed the list with War Week MVP, Billable Hours Champ, Black Midnight, Grow, Grind, Serve, Inspire, and tag past seed Awards whose names match (e.g. "MVP 1st Place", "Billing Hours Champ").

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A9; grilling Q18, Q26; wiki survey

## Decisions

- Categories are global (like the Organizer list), not per War Week; Organizer-only.
- The seed format gains an optional `category` key on Awards; the loader stays insert-if-absent.
- The participant Awards page groups by Category (uncategorized last).
- Tense (billable hours) stays out: ticket 76.
- CONTEXT.md: **Award Category**.

## Acceptance criteria

- [ ] Migration plus seed tagging; seeds load twice; unit tests for the name-matching used to tag seeds.
- [ ] e2e: an Organizer adds a Category, gives an Award in it; the Awards page groups it.
- [ ] `pnpm gate` passes.

## [SCOPE CHANGE]

- 2026-10-02 (Paul, answering the R12 plan's queued Q1): an archived Award Category can be **restored** ("restoring them seems valid and lightweight enough"). Adds the Organizer-only action `award-category.restore` and a Restore button on the Archived list. Q2 answered: seed tagging stays "War Week MVP" only ("MVP", "MVP 1st Place"); "MVP 2nd/3rd Place" stay untagged (an admin can configure more).

## [CLOSEOUT]

2026-10-02, atlas-implement (Claude Opus 5.5). Deliverable D70 (worker: atlas-worker, sonnet; commit `fda5b6e`, migrations regenerated at integration as 0025/0026), with the approved Restore scope change, plus the review fixes in `2b06e18`. Verified on `feat/regression-r12-participation-awards` at `2b06e18` (code; the closeout commit adds only `.scratch/` and `test-results/`), local Postgres `war-weeker-postgres` :2345, `DATABASE_URL=postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable DATABASE_DRIVER=pg`. Final gate: `pnpm format:check && pnpm gate` exit 0 (format clean; lint 0 errors, 7 existing `<img>` warnings; vitest 167 files / 3604 tests; build; smoke 243 ok; Playwright 86 passed) → `test-results/r12/gate.txt`. PR: _(added after it opens)_.

| AC | Verdict | Evidence |
|---|---|---|
| Migration plus seed tagging; seeds load twice; unit tests for the name-matching | PASS | `drizzle/0025_large_exodus.sql`, `drizzle/0026_seed-award-categories.sql` (the seven keyed Categories); `pnpm exec vitest run src/lib/award-categories … src/seed`: 455 passed → `test-results/r12/unit-award-categories.txt`; after the gate's two loads, 7 seeded keys and 7 tagged seed Awards (MVP 1st Place only for War Week MVP, as Paul confirmed) → `test-results/r12/award-tagging.txt`; smoke's tag check ok |
| e2e: an Organizer adds a Category, gives an Award in it; the Awards page groups it | PASS | `e2e/regression-r12-award-categories.spec.ts` (also rename refused on a duplicate, archive, restore) passed in the gate |
| `pnpm gate` passes | PASS | `test-results/r12/gate.txt` |

Deviations: Restore added (`[SCOPE CHANGE]` above).

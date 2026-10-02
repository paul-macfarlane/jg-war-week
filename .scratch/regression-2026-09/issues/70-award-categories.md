# 70: Award Categories that carry across War Weeks

**What to build:** A global list of **Award Categories** that Organizers manage under Awards → Categories (add, rename, archive; an archived Category stays on past Awards but can't be picked). An Award optionally picks a Category. Seed the list with War Week MVP, Billable Hours Champ, Black Midnight, Grow, Grind, Serve, Inspire, and tag past seed Awards whose names match (e.g. "MVP 1st Place", "Billing Hours Champ").

**Blocked by:** none

**Status:** in-progress

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

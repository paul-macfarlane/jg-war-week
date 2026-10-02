# 59: Settings save themselves

**What to build:** The War Week Settings form autosaves: each field saves after the Organizer stops typing (debounced; color pickers too), with a "Saving…" / "Saved" indicator near the heading and no Save button. A failed save shows its error at the field and keeps the typed value; nothing else is lost.

**Blocked by:** 57

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A13; grilling Q10

## Decisions

- Save per field (or per small group: the date range as one), through the existing `updateWarWeekSettings` action or a per-field variant; ADR 0003/0004 still apply (authorize first, zod).
- The sticky save bar (ticket 33) is removed from this form only.
- Leaving the page while a save is pending finishes it (or warns if it failed).

## Acceptance criteria

- [ ] e2e: change Story Theme, wait, reload: the change persisted; no Save button on the page.
- [ ] e2e: an invalid value (e.g. a bad Slack URL) shows its error at the field and isn't saved.
- [ ] `pnpm gate` passes.

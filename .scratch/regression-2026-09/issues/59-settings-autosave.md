# 59: Settings save themselves

**What to build:** The War Week Settings form autosaves: each field saves after the Organizer stops typing (debounced; color pickers too), with a "Saving…" / "Saved" indicator near the heading and no Save button. A failed save shows its error at the field and keeps the typed value; nothing else is lost.

**Blocked by:** 57

**Status:** done

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

## Comments

- 2026-10-02 [AI CODE REVIEW] (atlas-implement): Two fresh Opus reviewers read `0e19fa6..d7c4096`, one per axis. The orchestrator adjudicated each finding against the cited hunks; the full record is in `../epics/R9-execution.md` [AI CODE REVIEW]. One blocking finding: F2, settings autosave wrote the whole row and could revert a newer Winner. It was fixed in `aae6856`/`6360357` with partial saves merged over the locked row. Every non-blocking finding was fixed or approved as a deviation.
- 2026-10-02 [CLOSEOUT] (atlas-implement): Branch `feat/regression-r9-navigation`; worker D59 (Opus), commit `ef1b9bd`; review fixes `aae6856` (partial saves, leave guard) and `6360357` (old full-save action retired).
  - AC1 PASS: `e2e/regression-r9-settings.spec.ts` r9 59-1 changes Story Theme, waits for "Saved", reloads, and the value persisted; no Save button.
  - AC2 PASS: r9 59-2 shows a bad Slack URL's error at the field, keeps the typed value and doesn't save it.
  - AC3 PASS: gate at `6360357`.
  - Extra: r9 59-3 shows a Winner written after load survives an autosave (each save sends only its fields, merged over the locked row by `updateWarWeekSettingsFields`). r9 59-4 shows that leaving with a refused field asks first.

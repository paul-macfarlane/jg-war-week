# 79: Points Entries puts its form below Brackets and Games on a phone

**What to build:** On `/admin/points`, the Brackets and Games quick-link lists render above the page's own heading, "Add a Points Entry". With several Bracket and `games` Competitions, they push the form, the page's main job, off a phone's first screen.

**Blocked by:** none

**Status:** done

**Source:** regression checklist run, ticket 53 (free-for-all pass, `pnpm seed:demo:xii`, 2026-10-02)

## Need

- **Organizer / Host:** enter a result in one tap from the phone they carry around the office during War Week.

## Finding

- **Checklist line:** Admin, as an Organizer → "No admin page carries more than it needs." *(judgment)*
- **Viewport:** 390×844 (at 1440 the form stays on the first screen).
- **Role:** Organizer (`e2e-organizer@jahnelgroup.com`).
- **Screenshots:** `test-results/r8-quick-fixes/checklist/admin-points-ffa-390/page.png`, `.../admin-points-ffa-390/ledger.png`.
- **Sections and the need each serves:** Brackets (Organizer/Host: jump to a Bracket to record a Heat), Games (Organizer/Host: jump to a `games` Competition's setup), Add a Points Entry (Organizer/Host: enter a result, the page's job), Current standings (Organizer: see the entry land), Ledger (Organizer: correct or delete an entry).
- **Expected:** the "Add a Points Entry" heading and form open the page on a phone; the Bracket and Games links come after it (or live elsewhere).
- **Observed:** with 3 Brackets and 5 `games` Competitions (the XII demo's 2 plus those the Organizer run adds), the form's heading sits about 510 px down a 844 px screen; only the Competition field is visible, and Points and the submit button are below the fold.

## Acceptance criteria

- [x] At 390×844, `/admin/points` shows the "Add a Points Entry" heading and its Competition, Participant and Points fields on the first screen, however many Brackets and `games` Competitions the War Week has.

## Comments

- **2026-10-02, teams pass (`pnpm seed:demo`, XI live):** same defect. With 2 Brackets and 7 `games` Competitions (XI's 3 plus those the Organizer run adds), the "Add a Points Entry" heading sits about 660 px down the 844 px screen and only the Competition field label shows above the bottom nav. Screenshot: `test-results/r8-quick-fixes/checklist/admin-points-teams-390/page.png`.
- **2026-10-02, triage (Paul):** Decided: the "Add a Points Entry" heading and form open the page; the Bracket and Games quick links move below it. Batched into epic R14 (`../epics/R14-quick-wins.md`).
- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r14`): claimed; `ready-for-agent` → `in-progress`. Execution record: `../epics/R14-execution.md`.
- 2026-10-03 [CLOSEOUT] (atlas-implement): delivered in epic R14 on `fix/regression-r14-quick-wins`; the acceptance criterion is PASS with evidence under `test-results/r14/ac79-*/`. Review, verification and closeout are in `../epics/R14-execution.md`. `ai-review` → `done`.

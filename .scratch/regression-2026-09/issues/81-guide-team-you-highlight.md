# 81: The Organizer guide says a linked Participant's Team is highlighted as You

**What to build:** The Organizer guide (`/admin/guide`, "What a Participant email does", `src/components/organizer-guide.tsx`) says that when a signed-in email matches a roster Participant, "that Participant and their team are highlighted as "You" wherever they appear". In a teams War Week the Team is not highlighted anywhere in the Standings: not on Home's Team standings, not on the Leaderboard's Team standings, not in the Finale. Only the Participant's own rows carry the You tag, as `CONTEXT.md` ("You") describes. Make the guide say what the app does (or, if a Team highlight is wanted, decide that in triage and build it everywhere the guide claims).

**Blocked by:** none

**Status:** done

**Source:** regression checklist run, ticket 53 (teams pass, `pnpm seed:demo`, 2026-10-02)

## Need

- **Organizer:** trust the guide when telling Participants what linking their email does.

## Finding

- **Checklist line:** Admin, as an Organizer → "The Guide is true."
- **Viewports:** 1440×900 and 390×844.
- **Roles:** Organizer reading `/admin/guide`; linked Participant (`e2e-participant@jahnelgroup.com`, Anthony Conway, Team Red) checking the pages.
- **Screenshots:** `test-results/r8-quick-fixes/checklist/admin-guide-teams-1440/page.png`, `.../xi-teams-390/home-at.png`, `.../xi-leaderboard-teams-390/page.png`, `.../xi-finale-teams-390/done.png`.
- **Expected:** every sentence of the guide matches the app.
- **Observed:** the Red Team row has no You tag or ring on Home, the Leaderboard or the Finale; Anthony Conway's individual rows (Leaderboard, Teams, a `games` leaderboard) do. A `games` Competition's leaderboard does mark an enrolled Team with "Your Team", so the claim holds there and nowhere else.

## Acceptance criteria

- [x] The guide's "What a Participant email does" describes exactly where You (and "Your Team") show, and the teams pass of the checklist finds that true.

## Comments

- **2026-10-02, triage (Paul):** Decided: fix the guide to say exactly where You and "Your Team" show; no Team highlight is built. Batched into epic R14 (`../epics/R14-quick-wins.md`).
- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r14`): claimed; `ready-for-agent` → `in-progress`. Execution record: `../epics/R14-execution.md`.
- 2026-10-03 [CLOSEOUT] (atlas-implement): delivered in epic R14 on `fix/regression-r14-quick-wins`; the acceptance criterion is PASS with evidence under `test-results/r14/ac81-*/`. Review, verification and closeout are in `../epics/R14-execution.md`. `ai-review` → `done`.

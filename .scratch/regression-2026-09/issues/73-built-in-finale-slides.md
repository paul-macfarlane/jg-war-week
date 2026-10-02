# 73: Built-in Finale slides

**What to build:** The built-in slides, each themed with the War Week's Appearance Theme at projector scale:

- **Title:** War Week, edition and Story Theme.
- **By the numbers:** Competitions run, Games logged, Heats played, Points Entries, points awarded, Participants (only non-zero figures).
- **Awards:** each Award revealed one at a time (step within the slide), grouped by Award Category; the Organizer chooses "all on one slide" or "one slide per Category".
- **Champions:** each finalized Bracket's champion and each closed `games`/Participation Competition's winner.
- **Winner:** the main Standings' first place, read from the same `getStandings` rows (ties shown as ties).

**Blocked by:** 72, 70 (Categories)

**Status:** in-progress

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** grilling Q19, Q27

## Acceptance criteria

- [ ] Unit tests for the By the numbers figures and the Champions list on the demo seed.
- [ ] Screenshots of each slide at 1920×1080 and 390×844 on the XII demo.
- [ ] `pnpm gate` passes.

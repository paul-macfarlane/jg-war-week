# 48: Free-for-all hides Team Label, Leader Title and Teams

**What to build:** When a War Week's Mode is `free-for-all`, Settings hides Team Label and Leader Title, and the roster admin hides Teams (team column, team field, Leader flag, "Add Team"). Switching back to `teams` shows them again with their saved values.

**Blocked by:** none

**Status:** done

**Owner:** atlas-implement (Claude Opus 5.5), claimed 2026-10-02

**Source:** Paul's regression feedback 2026-10-01, A11; grilling Q13

## Decisions

- Free-for-all has no Teams. Saved Team Label, Leader Title and any existing Teams are kept, just hidden (no data deleted).
- Participant-facing pages already follow Mode; check the Teams/roster page heading and the More link label (`rosterHeading`) read sensibly with no Teams ("Participants").
- Competition setup in free-for-all: team scoring stays available only if the War Week has Teams; otherwise hide it. Record what you find in the closeout.

## Acceptance criteria

- [x] In a free-for-all War Week (XII demo), Settings shows no Team Label or Leader Title, and the roster has no Team controls; screenshots at both viewports.
- [x] Switching Mode to `teams` shows them with prior values (unit or e2e).
- [x] `pnpm gate` passes.

## Comments

- 2026-10-02 [CLOSEOUT] (atlas-implement): PR https://github.com/paul-macfarlane/jg-war-week/pull/113.

  Worker D48 (Sonnet), commit 05515bd, plus review fix b74876b.
  - AC1 PASS: XII free-for-all. Settings has no Team Label or Leader Title, and the roster has no Team controls: test-results/r8-quick-fixes/free-for-all-settings-1440/, -390/, test-results/r8-quick-fixes/free-for-all-roster-1440/, -390/.
  - AC2 PASS: `src/components/war-week-settings-form.test.tsx` renders both Modes with the same saved values. Switching Mode in the form shows the fields again with "Team"/"Captain": test-results/r8-quick-fixes/free-for-all-settings-switched-1440/. While hidden, the form posts the saved (`initial`) values, so saving never wipes them.
  - AC3 PASS: `pnpm format:check && pnpm gate` at `23c3d15` PASS (`test-results/r8-quick-fixes/gate.txt`).
  - Findings: the roster page already hid Teams, the team field, the Leader flag and Add Team in a free-for-all, so the only gap was the Leader title in row details (now gated). `rosterHeading` already reads "Participants". Competition setup already shows team scoring only in Teams mode; a free-for-all shows it only when a Competition already scores by Team, so the saved value still displays. Kept as is.

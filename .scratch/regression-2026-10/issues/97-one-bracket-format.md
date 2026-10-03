# 97: One Bracket Format

**What to build:** `single-elimination` and `heats` merge into one Format, **Bracket**, with two settings: **heat size** (2–8) and **how many advance** (1 to size − 1). "Head-to-head (single elimination)", size 2 with 1 advancing, is the default preset; anything else is Heats. One engine, tree, seeding and results path.

**Blocked by:** R16 merged into `staging`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: heats vs single elimination unclear); grilling Q16

## Decisions

- Size 2 / 1 advancing must behave exactly as single elimination does today (power-of-2 bracket, byes to top seeds, `winnerTo` links); keep that engine as the 2/1 path behind one Format if merging the engines is risky, but the Format, config, UI and copy are one.
- Migration: existing `single-elimination` → Bracket 2/1; `heats` → Bracket with its config.
- Self-report and Squads keep working.
- CONTEXT.md: **Bracket** with heat size and advancing; retire single elimination / Heats as Format names (a **Heat** is still one game in a Bracket).

## Acceptance criteria

- [ ] The existing Bracket and Heats engine tests pass through the one Format; a migration test maps both old Formats.
- [ ] The existing single-elimination and Heats e2e flows pass.
- [ ] `pnpm gate` passes.

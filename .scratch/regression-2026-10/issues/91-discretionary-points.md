# 91: Discretionary points

**What to build:** Points with no contest behind them. An Organizer gives **Discretionary points** to one Participant or one Team with a required **reason**; they belong to no Competition. Admin → Points becomes **Discretionary points**: the form plus a ledger of every Discretionary entry. Competitions are recorded on their own pages (`90`, `93`, R17), so the old Points form (every Competition, one target per submit, free-form points, 1st/2nd/3rd buttons) goes.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: the Points page is weird; ad hoc points); grilling Q2, Q28, Q29

## Decisions

- **Schema:** a Points Entry's Competition becomes optional; one with none must have a reason. (Red-team.)
- **Organizers only.** Hosts lose the Points page.
- **Teams War Week:** points to a Participant count toward their Team.
- **Admin landing:** `/admin` opens on **Competitions**; nav order Competitions · Discretionary points · Schedule · Roster · Announcements · Awards · FAQ · Finale · Settings · Organizers · Guide. Phone bar: Competitions, Discretionary points, Schedule, Announcements, More.
- Discretionary points show in Standings, the Participant/Team "where points came from" view (labelled "Discretionary: <reason>"), Recent results and MCP.
- Name in UI and docs: "Discretionary points" (Paul: the name used in past War Weeks).
- CONTEXT.md: **Discretionary points**; "Points Entry" stays the ledger row term.

## Acceptance criteria

- [ ] Unit tests: a Competition-less entry needs a reason; Standings include it; a Participant's counts toward their Team in teams mode.
- [ ] e2e: an Organizer gives 3 Discretionary points to a Team with a reason and the leaderboard moves; a Host gets the refusal page at `/admin/points`; `/admin` lands on Competitions.
- [ ] `pnpm gate` passes.

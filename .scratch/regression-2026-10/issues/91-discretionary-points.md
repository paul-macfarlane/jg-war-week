# 91: Discretionary points

**What to build:** Points with no contest behind them. An Organizer gives **Discretionary points** to one Participant or one Team with a required **reason**; they belong to no Competition. Admin → Points becomes **Discretionary points**: the form plus a ledger of every Discretionary entry, each of which can be edited or deleted. Competitions are recorded on their own pages (`90`, `93`, R17), so the old Points form (every Competition, one target per submit, free-form points, 1st/2nd/3rd buttons) goes.

**Blocked by:** none

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: the Points page is weird; ad hoc points); grilling Q2, Q28, Q29; red-team 2026-10-03 (B2, W3, W5, W9, M8)

## Decisions

- **Organizers only.** Hosts lose the Points page.
- **Teams War Week:** points to a Participant count toward their Team.
- **Edit and delete (W9):** an Organizer can change a Discretionary entry's target, points or reason, or delete it (`ConfirmDialog`, sonner toast). An edit keeps entered-by and entered-at and the ledger marks it edited, as Points Entries do today.
- **Route (M8):** the page moves to `/admin/discretionary-points`; `/admin/points` and `/admin/points/[id]` redirect there (`next.config` redirects, tested in `src/lib/admin-redirects.test.ts`) so old links work. The Host refusal is checked at the new route.
- **Admin landing:** `/admin` opens on **Competitions**; nav order Competitions · Discretionary points · Schedule · Roster · Announcements · Awards · FAQ · Finale · Settings · Organizers · Guide. Phone bar: Competitions, Discretionary points, Schedule, Announcements, More.
- Discretionary points show in Standings, the Participant/Team "where points came from" view (labelled "Discretionary: <reason>"), Recent results, the Finale's totals and MCP.
- Name in UI and docs: "Discretionary points" (Paul: the name used in past War Weeks).
- CONTEXT.md: **Discretionary points**; "Points Entry" stays the ledger row term; the Points Entry rules section is rewritten for Discretionary points and generated entries.

### Schema (B2)

- `points_entry.war_week_id` (FK to `war_week`, cascade, not null). The migration adds it nullable, backfills it from the entry's Competition, then sets not null.
- `points_entry.competition_id` becomes nullable. CHECK `points_entry_reason_without_competition`: `competition_id is not null or note is not null` (the reason is the `note`, required and non-blank for a Discretionary entry in the action).
- Seed uniqueness moves from `(competition_id, seed_key)` to `(war_week_id, seed_key)`, so a Competition-less seeded entry can't duplicate on a reload. Generated entries keep their current keys (`competition`-prefixed), which stay unique within the War Week.
- **Every Points Entry read scopes by `points_entry.war_week_id`**, not by an inner join through `competition`; a Competition join, where a read needs the Competition's name, is a left join. That covers `src/queries/standings.ts` (L59, L108), `recent-results.ts` (L107), `finale-slides.ts` (L77), `scored-counts.ts` (L20), `targets.ts` (L124), `points-entries.ts` (L119, L144) and any other `points_entry` read the implementer finds (`grep -rn "pointsEntry" src/queries src/mcp`).
- The target Team or Participant must be in the request's War Week (ADR 0003): refused in the write, since the Competition no longer enforces it.

### Permissions (W3)

- Actions `discretionary.create`, `discretionary.edit`, `discretionary.delete` in `WarWeekAction`, Organizers only, through `authorize` (`warWeek` target for create, `pointsEntry` for edit and delete; edit and delete also refuse a generated or Competition entry).
- The old `points-entry.*` actions and their rules go with the page.

### Seed loader and tests (W5, W7)

- The seed schema gains `discretionaryPoints` (`{ key, team | participant, points, reason, enteredByEmail, enteredAt }`); loads are idempotent on `(war_week_id, seed_key)`.
- **Delete** `e2e/points-entry.spec.ts` and the `/admin/points` flows in `e2e/regression-r5.spec.ts`; **rewrite** the `/admin/points` visits in `e2e/regression-r6.spec.ts`, `forms.spec.ts`, `regression-r9-account.spec.ts` and `regression-r15-cursor.spec.ts` against `/admin/discretionary-points` (or delete a case whose behaviour no longer exists, saying which in the closeout). Update `scripts/smoke/admin.ts`'s anonymous check to the new route and `scripts/about-media.ts`'s `/admin/points` stills. Delete the unit tests for the old points-entry form (`src/lib/points-entry.test.ts` cases for typed Competition entries) and replace them with Discretionary ones.

## Acceptance criteria

- [ ] Unit tests: a Competition-less entry needs a reason; Standings include it; a Participant's counts toward their Team in teams mode; editing keeps entered-by and marks it edited.
- [ ] `src/lib/access.test.ts`: `discretionary.*` allow an Organizer, refuse a Host (of any Competition), a Participant and anonymous.
- [ ] Action test (Postgres): each Discretionary server action as a Host returns the refusal and writes nothing; a target Team or Participant from another War Week is refused; editing or deleting a generated entry is refused.
- [ ] `src/db/migrations.test.ts`: in a scratch schema with Points Entries on two Competitions in two War Weeks, the migration applies, every entry's `war_week_id` is its Competition's War Week, and a row with neither Competition nor note is refused.
- [ ] Query tests (Postgres), one per surface, each with a Discretionary entry in the fixture: `getStandings`, the "where points came from" breakdown (shows "Discretionary: <reason>"), Recent results and the Finale totals include it; a Discretionary entry in another War Week is excluded from each.
- [ ] MCP test: the standings/points tool reports the entry and its reason, no emails.
- [ ] Loader test (Postgres): a fixture seed with a Discretionary entry loaded twice leaves exactly one.
- [ ] e2e: an Organizer gives 3 Discretionary points to a Team with a reason and the leaderboard moves, edits it to 4, deletes it and the leaderboard returns; a Host gets the refusal page at `/admin/discretionary-points`; `/admin/points` redirects there; `/admin` lands on Competitions.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass (the full gate runs once, in `96`). The e2e above is written here; first run in `96`.

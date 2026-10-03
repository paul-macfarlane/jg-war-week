# 91: Discretionary points

**What to build:** Points with no contest behind them. An Organizer gives **Discretionary points** to one Participant or one Team with a required **reason**; they belong to no Competition. Admin → Points becomes **Discretionary points**: the form plus a ledger of every Discretionary entry, each of which can be edited or deleted. Competitions are recorded on their own pages (`90`, `93`, R17), so the old Points form (every Competition, one target per submit, free-form points, 1st/2nd/3rd buttons) goes.

**Part of:** Epic R16's one work package (`../epics/R16-competition-model.md`): no gate, order or migration of its own. Schema changes go into `src/db/schema.ts`; the epic generates and hand-edits the one migration and converts the seeds.

**Status:** done

**Source:** Paul's regression feedback 2026-10-03 (Admin: the Points page is weird; ad hoc points); grilling Q2, Q28, Q29; red-team 2026-10-03 pass 1 (B2, W3, W5, W9, M8) and pass 2 (W1, M6)

## Decisions

- **Organizers only.** Hosts lose the Points page.
- **Teams War Week:** points to a Participant count toward their Team and also in that Participant's own total, the same as a Participant's entry on a Competition with counts toward team on.
- **Edit and delete (W9):** an Organizer can change a Discretionary entry's target, points or reason, or delete it (`ConfirmDialog`, sonner toast). An edit keeps entered-by and entered-at and the ledger marks it edited, as Points Entries do today.
- **Route (M8):** the page moves to `/admin/discretionary-points`; `/admin/points` and `/admin/points/[id]` redirect there (`next.config` redirects, tested in `src/lib/admin-redirects.test.ts`) so old links work. The Host refusal is checked at the new route.
- **Admin landing:** `/admin` opens on **Competitions**; nav order Competitions · Discretionary points · Schedule · Roster · Announcements · Awards · FAQ · Finale · Settings · Organizers · Guide. Phone bar: Competitions, Discretionary points, Schedule, Announcements, More.
- Discretionary points show in Standings, the Participant/Team "where points came from" view (labelled "Discretionary: <reason>"), Recent results, the Finale's totals and MCP.
- Name in UI and docs: "Discretionary points" (Paul: the name used in past War Weeks).
- CONTEXT.md: **Discretionary points**; "Points Entry" stays the ledger row term; the Points Entry rules section is rewritten for Discretionary points and generated entries.

### Schema (B2)

- `points_entry.war_week_id` (FK to `war_week`, cascade, not null); the epic's migration backfills it.
- `points_entry.competition_id` becomes nullable. CHECK `points_entry_reason_without_competition`: `competition_id is not null or note is not null` (the reason is the `note`, required and non-blank for a Discretionary entry in the action).
- Seed uniqueness moves from `(competition_id, seed_key)` to `(war_week_id, seed_key)`, so a Competition-less seeded entry can't duplicate on a reload. Generated entries have no `seed_key` today; a seeded finalized Placement's generated entries get `seed_key` = `<competition seed key>:<placement key>` so a reload finds them.
- **Every Points Entry read scopes by `points_entry.war_week_id`**, not by an inner join through `competition`; a Competition join, where a read needs the Competition's name, is a left join. That covers `src/queries/standings.ts` (L59, L108), `recent-results.ts` (L107), `finale-slides.ts` (L77), `scored-counts.ts` (L20), `targets.ts` (L124), `points-entries.ts` (L119, L144) and every other reader or writer: `grep -rn "pointsEntry\|points_entry" src scripts e2e` (including `src/mutations/setup.ts`, `src/queries/competitions.ts`, `src/queries/setup.ts`, and the raw-SQL writers `scripts/finale-stills.ts` L130–139 and `scripts/about-media.ts`, which typecheck can't see and must now set `war_week_id`). The closeout lists every hit and what changed.
- The target Team or Participant must be in the request's War Week (ADR 0003): refused in the write, since the Competition no longer enforces it.

### Permissions (W3)

- Actions `discretionary.create`, `discretionary.edit`, `discretionary.delete` in `WarWeekAction`, Organizers only, through `authorize` (`warWeek` target for create, `pointsEntry` for edit and delete; edit and delete also refuse a generated or Competition entry).
- The old `points-entry.*` actions and their rules go with the page.

### Seed loader and tests

- The seed schema gains `discretionaryPoints` (`{ key, team | participant, points, reason, enteredByEmail, enteredAt }`); loads are idempotent on `(war_week_id, seed_key)`.
- **Everything that depends on the Points page or the old `points-entry.*` actions** is deleted or rewritten here (pass 2, W1):
  - `scripts/smoke/harness.ts` L227: `callAction` posts every smoke action to `/admin/points`; point it at a route that still exists (e.g. `/admin`), since a redirect would break action POSTs.
  - `scripts/smoke/points-entries.ts`: delete the module (and its imports in `hosts.ts` and `index.ts`), replaced by Discretionary checks.
  - `scripts/smoke/hosts.ts` L364, L380 (Host nav without Points), `brackets.ts` L234, L801, `setup.ts` L448, `admin.ts` L15–17, L56, L81, L115, L172.
  - `e2e/db.ts` L164–203: the helpers inner-join `competition`; scope by `war_week_id` with a left join.
  - **Delete** `e2e/points-entry.spec.ts` and the `/admin/points` flows in `e2e/regression-r5.spec.ts`; **rewrite** the `/admin/points` visits in `e2e/regression-r6.spec.ts`, `forms.spec.ts`, `regression-r9-account.spec.ts` and `regression-r15-cursor.spec.ts` against `/admin/discretionary-points` (or delete a case whose behaviour no longer exists, saying which in the closeout).
  - `src/lib/admin-sections.test.ts` (nav order), `src/lib/points-entry.test.ts` (typed Competition entries; replaced by Discretionary cases), `scripts/about-media.ts`'s `/admin/points` stills, and `docs/agents/testing.md`'s e2e row "an Organizer's Points Entry updates `/xi/leaderboard`".
  - Re-run `grep -rn "admin/points\|points-entry\." src e2e scripts` and handle every hit; the closeout lists them.

## Acceptance criteria

- [ ] Unit tests: a Competition-less entry needs a reason; Standings include it; a Participant's counts toward their Team in teams mode; editing keeps entered-by and marks it edited.
- [ ] `src/lib/access.test.ts`: `discretionary.*` allow an Organizer, refuse a Host (of any Competition), a Participant and anonymous.
- [ ] Action test (Postgres): each Discretionary server action as a Host returns the refusal and writes nothing; a target Team or Participant from another War Week is refused on create and on edit; editing or deleting a generated entry is refused.
- [ ] Query tests (Postgres), one per surface, each with a Discretionary entry in the fixture: `getStandings`, the "where points came from" breakdown (shows "Discretionary: <reason>"), Recent results and the Finale totals include it; a Discretionary entry in another War Week is excluded from each.
- [ ] MCP test: the standings/points tool reports the entry and its reason, no emails.
- [ ] Loader test (Postgres): a fixture seed with a Discretionary entry loaded twice leaves exactly one.
- [ ] e2e: an Organizer gives 3 Discretionary points to a Team with a reason and the leaderboard moves, edits it to 4, deletes it and the leaderboard returns; a Host gets the refusal page at `/admin/discretionary-points`; `/admin/points` redirects there; `/admin` lands on Competitions.

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r16`): claimed with Epic R16; `ready-for-agent` → `in-progress`. Execution record: [`R16-execution.md`](../epics/R16-execution.md).
- 2026-10-03 [CLOSEOUT] (atlas-implement, `regression-r16`): done. Discretionary points at `/admin/discretionary-points` (give, ledger, edit, delete), Organizers only via `discretionary.create/edit/delete`; a Team target only in a teams War Week, enforced server-side. `points_entry.war_week_id`; every Points Entry read scopes by it (standings, breakdown "Discretionary: <reason>", Recent results, Finale counts, scored counts, targets). `/admin/points` and `/admin/points/:id` redirect; `/admin` lands on Competitions; nav order as decided. MCP `get_discretionary_points` (separate tool; recorded deviation from "the standings/points tool"). Seed `discretionaryPoints`; seed `pointsEntries` retired. Deleted: `e2e/points-entry.spec.ts`, `src/actions/points-entries.test.ts`, `src/mutations/points-entries.test.ts`, `src/components/points-entry-form.test.tsx`, `scripts/smoke/points-entries.ts`, the typed-entry races in `races.test.ts`, Recent results' manual-entry grouping tests. Rewritten: `/admin/points` visits in `regression-r5`, `-r6`, `forms`, `-r9-account`, `-r15-cursor` (its disabled-button case now uses `/admin/faq`), `regression-r9-home` (Recent results via Discretionary entries), `admin-sections`, `admin-shell`, `admin-redirects`, `access` tests; smoke `harness.ts` posts to `/admin/competitions`. `getPointsEntryFormOptions` is now `getTargetOptions` (`src/queries/target-options.ts`). Evidence and review: [`R16-execution.md`](../epics/R16-execution.md). PR: https://github.com/paul-macfarlane/jg-war-week/pull/126.

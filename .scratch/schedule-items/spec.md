---
title: Schedule items (Epic R25)
status: ready-for-agent
grilled: 2026-10-06 (see ../regression-2026-10/grilling-2026-10-06.md)
created: 2026-10-06
source: Paul's final regression feedback, items S7–S11 (../regression-2026-10/feedback-final.md)
---

# Schedule items

**Epic:** R25 · **Branch:** `feat/r25-schedule-items` · **Blocked by:**
R26 (`cuts-and-consistency`). Both touch `src/lib/access.ts`, `CONTEXT.md`,
the maintainer's guide, the regression checklist and `/about`, and R26
deletes `src/mcp/`. R25 branches from `staging` after R26 merges. Its
migration takes the next free number then (`0035` today) · **Red-team:**
required (Drizzle schema change; findings of 2026-10-06 resolved below) ·
**Status:** ready-for-agent

## Summary

The "Add schedule item" form fights the Organizer:

- **Host** is free text, though a Competition already has Hosts and
  everyone who hosts is on the roster.
- **Start time** is required, though some items (a day-long challenge, a
  drop-in) have no time.
- **Category and Competition** are independent: an item can link a
  Competition but sit in "Social", and the Competition select shows for
  every category.
- **Day, Start time and End time** don't line up in their row.

## Data and deployed environments

Nothing in staging or production is in real use (Paul, 2026-10-06: "this
is all new, there is nothing to migrate"). The migration drops and reshapes
freely, with **no row conversion**: the free-text `host` column is dropped,
not converted. It must still apply cleanly to a database holding today's
schema. After merge, staging and production are reset and reseeded as a
human step (Paul), as in R22.

The seeds hold 8 free-text Schedule item Hosts (`seeds/xi.json` and
`seeds/demo/xi.json`, including "Jet Breuer", who isn't on XI's roster, and
two on items linked to a Competition). They are **dropped**, not converted
(Paul, 2026-10-06). No seed carries a Schedule item Host after R25. To
seed one later, also seed that person as a roster Participant.

## Decisions

1. **Hosts are roster Participants.**
   - **Storage.** A new `schedule_item_host` table (`schedule_item_id`,
     `participant_id`, primary key on both), each row deleted with its
     Schedule item or Participant. `schedule_item.host` is dropped.
   - **Zero or more.** An item has any number of Hosts, chosen with the
     multi-select `ParticipantPicker` (as Competition Hosts are). A Host
     must be on the item's War Week roster; the mutation refuses anyone
     else.
   - **Display only.** A Schedule item Host gets **no** admin access. Only
     a Competition's Hosts hold the Host role (ADR 0012).
   - **With a Competition.** When the item links a Competition, the form
     hides its Host field, and the Schedule shows the Competition's Hosts
     instead. The server agrees: saving an item with a Competition
     **discards** any Hosts posted with it and deletes the item's existing
     `schedule_item_host` rows, in the same transaction. Linking a
     Competition later therefore clears the item's own Hosts, and unlinking
     it starts from none. Hosts are discarded rather than refused, because
     the field is hidden and the Organizer has no way to fix the post.
   - **Shown as** "Hosted by A, B" with avatars on the participant
     Schedule (`schedule-item.tsx`), names only, never an email.
2. **Start time is optional.**
   - An end time requires a start time ("Add a start time first."); an end
     time must still be after the start.
   - An item with no start time reads **"Any time"**, sorts **first** in
     its day (then by title), and **never** appears in Now/Next.
   - Every reader of `startTime` handles null: `compareItems`, `toSeconds`,
     `span`, `computeNowNext`, `formatEtTime` and `formatTimeRange` in
     `src/lib/schedule.ts`, and the `.slice` in
     `src/lib/setup-schedule-faq.ts`. R26 has deleted the MCP by then; R25
     adds nothing to it.
   - The unique key on (day, start time, title) becomes
     `NULLS NOT DISTINCT`, so two untimed items with the same title can't
     share a day. The refusal for that case reads: There's already a
     Schedule Item "{title}" with no start time on that Day.
3. **Category first, then Competition.**
   - The form puts Category before Competition. The Competition field
     shows **only** when Category is Competition, is optional there (a
     "Bracket draw" may link none), and changing Category away clears it.
   - The server agrees: an item with a Competition and any other category
     is refused. The seed schema refuses it too (`scheduleItemSeedSchema` is
     shared, so seed and setup can't drift).
   - Picking a Competition fills an empty title with the Competition's
     name; a typed title is never overwritten.
4. **Layout.** Day, Start time and End time line up on one baseline at
   every width (labels, helper text and control heights match).
5. **Seed.**
   - A Schedule item's optional `hosts` is a list of display names,
     checked against the War Week's roster exactly as Competition `hosts`
     are ("Host "X" is not on this War Week's roster").
   - The seed schema refuses `hosts` on an item that names a Competition:
     authored data should fail loudly, unlike a hidden form field.
   - The loader adds absent Host rows and never removes one, as
     `insertHosts` does for Competition Hosts, so a reload keeps
     Organizer-added Hosts.
   - Items may omit a start time.
   - Every seed's free-text `host` is removed (see "Data and deployed
     environments").

## Schema change (for the red-team)

- Drop `schedule_item.host`.
- `schedule_item.start_time` becomes nullable.
- The unique key on (`day_id`, `start_time`, `title`) becomes
  `NULLS NOT DISTINCT`.
- New `schedule_item_host` (`schedule_item_id` FK cascade,
  `participant_id` FK cascade, PK on both).
- No data conversion. Migration and seeds change together.

## Acceptance criteria

- [ ] An Organizer adds a Schedule item with two Hosts picked by name; the
      participant Schedule shows "Hosted by" both, with avatars (e2e,
      screenshots at 1440 and 390).
- [ ] Adding a Host from another War Week's roster is refused (vitest on
      the mutation).
- [ ] An item linked to a Competition shows that Competition's Hosts and the
      form has no Host field (e2e). Saving an item with a Competition and
      posted Hosts stores no `schedule_item_host` rows, and linking a
      Competition to an item that has Hosts deletes them (vitest on the
      mutation against seeded local Postgres).
- [ ] A Participant who hosts only a Schedule item gets no Host role: the
      actor loader (`getActor`, `src/auth/actor.ts`) returns no hosted
      Competitions for them (vitest against seeded local Postgres), and
      smoke shows an admin Competition page refusing them.
- [ ] No email reaches the HTML or RSC payload of `/admin/schedule` (as an
      Organizer) or `/xi/schedule` (as a Participant): the picker-leak
      check in `scripts/smoke/pickers.ts` covers both, with its marker
      roster entries.
- [ ] An item with no start time saves, reads "Any time", sorts first in
      its day and is never Now or Next (vitest on `src/lib/schedule.ts`;
      e2e on the Schedule page).
- [ ] An end time without a start time is refused with "Add a start time
      first." (vitest).
- [ ] Two untimed items with the same title on one day are refused with the
      untimed wording (vitest against seeded local Postgres).
- [ ] The migration applies over a database holding today's schema with
      `schedule_item` rows (some with a free-text `host`): every row
      survives with its `start_time`, and `host` is gone (a case in
      `src/db/migrations.test.ts`, as for 0031–0034).
- [ ] The Competition field shows only for the Competition category,
      changing category clears it, and picking a Competition fills an empty
      title (e2e). The server and the seed schema both refuse a Competition
      on another category (vitest).
- [ ] Day, Start time and End time line up at 1440 and 390: in e2e, their
      controls' top and bottom edges match within 1px, and screenshots are
      committed.
- [ ] A seed fixture loads with list `hosts` and an untimed item. An
      unknown Host name, or `hosts` on an item naming a Competition, fails
      the load (vitest on the seed schema). Loading it twice leaves the same
      `schedule_item_host` rows (vitest against seeded local Postgres), and
      smoke's reload count includes `schedule_item_host`.
- [ ] No seed file contains a Schedule item `host` or `hosts` (vitest on
      the seed files).
- [ ] Hosts show with avatars (each Host's avatar is rendered with an
      accessible name, asserted in the first e2e). Untimed items read "Any
      time" on `/admin/schedule` too (e2e).
- [ ] Every database-backed vitest suite above ran: its run reports those
      tests passed, not skipped (`SKIPPED` is never `PASS`).

## Out of scope

- Converting any existing free-text Host.
- Hosts on Days, Announcements or anything other than Schedule items.
- Changes to Competition Hosts.

## Definition of Done

- [ ] Red-team the spec before implementation (`/atlas-red-team`).
- [ ] R26 merged first; branch from the `staging` that contains it.
- [ ] Migration and seeds together; smoke on seeded local Postgres.
- [ ] `CONTEXT.md`: the Host entry's Schedule item line ("a Schedule
      item's Hosts are roster Participants shown as 'Hosted by'; they don't
      hold the Host role"), and Schedule item / Now/Next for untimed items.
- [ ] `docs/maintainers-guide.md`, `docs/regression-checklist.md` (Schedule
      lines at both viewports) and `/about` copy and media updated where
      affected.
- [ ] e2e screenshots at 1440 and 390 committed under `test-results/e2e/`.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.
- [ ] After merge (human, Paul): reset and reseed staging and production.
      - **Prerequisite:** the Vercel build of the merge has applied the
        migration.
      - **Action:** run the Seed workflow (`.github/workflows/seed.yml`) for each environment.
      - **Expected:** it succeeds.
      - **Check afterwards:** each `/xi/schedule` loads and shows no "Hosted
        by" line on any item.

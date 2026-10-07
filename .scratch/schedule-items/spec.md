---
title: Schedule items (Epic R25)
status: ai-review
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
**Status:** ai-review

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
(Paul, 2026-10-06). The seed format carries no Schedule item Host at all
after R25, matching `CONTEXT.md` ("Hosts aren't in seeds"). Seeding them
later is its own change, which would also seed those people as roster
Participants.

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
     the field is hidden and the Organizer has no way to fix the post. The
     seed loader follows the same rule: when it saves an item with a
     Competition, it deletes that item's `schedule_item_host` rows.
   - **Shown as** "Hosted by A, B" with avatars on the participant
     Schedule (`schedule-item.tsx`), names only, never an email.
2. **Start time is optional.**
   - An end time requires a start time ("Add a start time first."); an end
     time must still be after the start.
   - An item with no start time reads **"Any time"**, sorts **first** in
     its day (then by title), and **never** appears in Now/Next.
   - Every reader of `startTime` handles null, including:
     - `compareItems`, `toSeconds`, `span`, `computeNowNext`,
       `formatEtTime` and `formatTimeRange` in `src/lib/schedule.ts`;
     - in `src/lib/setup-schedule-faq.ts`: `scheduleItemInputFrom`'s
       `.slice`, the guard's `.slice`, `duplicateScheduleItemError`, and
       the start/end refine;
     - the seed duplicate key `${item.startTime} ${item.title}`
       (`src/seed/schema.ts`), which would otherwise read "undefined …"
       without a type error, and the row mapping in `src/seed/load.ts`;
     - `src/queries/schedule.ts`;
     - the smoke fixtures in `scripts/smoke/hosts.ts` and
       `scripts/smoke/setup.ts`, which still post `host: ""` and a
       `competitionId` with category `"social"`. Clean these up.
   - R26 has deleted the MCP by then; R25 adds nothing to it.
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
   **Amended 2026-10-07 (Paul):** on a phone (below `sm`) Day has its own
   row and Start time and End time share the next, aligned with each other;
   all three on one row at 390 left about 66px per time and clipped
   "10:30 AM".
5. **Seed.**
   - The seed format drops `host` and gains no `hosts`. Every seed's
     free-text `host` is removed (see "Data and deployed environments").
   - Items may omit a start time.
   - A reload never touches an unlinked item's Hosts, which an Organizer
     added.

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
      participant Schedule shows "Hosted by" both, with one avatar beside
      each name (e2e asserts the avatar elements are present; screenshots
      at 1440 and 390). The e2e deletes the item it created.
- [ ] Adding a Host from another War Week's roster is refused (vitest on
      the mutation).
- [ ] An item linked to a Competition shows that Competition's Hosts and the
      form has no Host field (e2e). No seeded Competition has Hosts, so the
      e2e adds them and removes them afterwards. Saving an item with a Competition and
      posted Hosts stores no `schedule_item_host` rows, and linking a
      Competition to an item that has Hosts deletes them (vitest on the
      mutation against seeded local Postgres). A reload that links a
      Competition to an item with Hosts deletes them (vitest on the loader
      against seeded local Postgres).
- [ ] A Participant who hosts only a Schedule item gets no Host role:
      `getHostedCompetitions` (`src/queries/organizers.ts`, the query
      `getActor` uses) returns nothing for them (vitest against seeded
      local Postgres, beside the existing `organizers.test.ts` cases).
      Smoke reuses the smoke Host flow in `scripts/smoke/hosts.ts`. After
      `assertFormerHostRefused` has removed the smoke Host's Competition,
      it gives them a `schedule_item_host` row (so it is their only Host
      row), and shows an admin Competition page refusing them.
      `deleteSmokeHosts` removes the row with the rest.
- [ ] No email reaches the HTML or RSC payload of `/admin/schedule` (as an
      Organizer) or `/xi/schedule` (as a Participant). The picker-leak
      check in `scripts/smoke/pickers.ts` covers both. Before fetching, it
      makes one marker roster entry a Host of an unlinked Schedule item,
      and the other a Host of a Competition that a Schedule item links. It
      asserts both marker names appear on `/xi/schedule`, so the check can
      fail, and it removes those rows afterwards.
- [ ] An item with no start time saves, reads "Any time", sorts first in
      its day and is never Now or Next (vitest on `src/lib/schedule.ts`;
      e2e on the Schedule page).
- [ ] An end time without a start time is refused with "Add a start time
      first." (vitest).
- [ ] Two untimed items with the same title on one day are refused with the
      untimed wording (vitest against seeded local Postgres). The database
      also refuses a raw insert of such a duplicate (in the 0035 migration
      test), so the constraint itself is proven, not only the code check.
- [ ] A reload keeps an untimed item: a loader vitest loads an untimed
      item, adds a `schedule_item_host` row, reloads, and finds the same
      item id with the same Host (seeded local Postgres).
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
      committed. (Amended 2026-10-07: at 390, Start time and End time match
      each other under Day, and a picked "10:30 AM" is not clipped.)
- [ ] A seed with an untimed item loads (vitest on the seed schema), and
      the seed schema refuses a Schedule item `host` or `hosts` key.
- [ ] Untimed items read "Any time" on `/admin/schedule` too (e2e).
- [ ] Every database-backed vitest suite above ran: its run reports those
      tests passed, not skipped (`SKIPPED` is never `PASS`). The captured
      vitest output is committed under `test-results/vitest/`.

## Out of scope

- Converting any existing free-text Host.
- Hosts on Days, Announcements or anything other than Schedule items.
- Changes to Competition Hosts.

## Definition of Done

- [x] Red-team the spec before implementation (`/atlas-red-team`): passed 2026-10-06 on the third pass.
- [ ] R26 merged first; branch from the `staging` that contains it.
- [ ] Migration and seeds together; smoke on seeded local Postgres.
- [ ] `CONTEXT.md`:
      - the Host entry's Schedule item line ("a Schedule item's Hosts are
        roster Participants shown as 'Hosted by'; they don't hold the Host
        role");
      - Schedule item and Now/Next for untimed items;
      - the Schedule Item natural key `(day_id, start_time, title)`, now
        nulls not distinct;
      - the seed entry "Hosts aren't in seeds", corrected: the seed format
        still accepts a Competition's `hosts` (roster names, insert only),
        and has no Schedule item Hosts.
- [ ] `docs/maintainers-guide.md`, `docs/regression-checklist.md` (Schedule
      lines at both viewports) and `/about` copy and media updated where
      affected.
- [ ] e2e screenshots at 1440 and 390 committed under `test-results/e2e/`.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.
- [ ] After merge (human, Paul): reset and reseed staging and production.
      - **Prerequisite:** the Vercel build of the merge has applied the
        migration.
      - **Action:** run the Seed workflow (`.github/workflows/seed.yml`)
        for each environment.
      - **Expected:** it succeeds.
      - **Check afterwards:** each `/xi/schedule` loads and shows no "Hosted
        by" line on any item.

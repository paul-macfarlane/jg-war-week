---
title: Schedule items (Epic R25)
status: ready-for-agent
grilled: 2026-10-06 (see ../regression-2026-10/grilling-2026-10-06.md)
created: 2026-10-06
source: Paul's final regression feedback, items S7–S11 (../regression-2026-10/feedback-final.md)
---

# Schedule items

**Epic:** R25 · **Branch:** `feat/r25-schedule-items` · **Blocked by:**
none (its migration is the next on `staging`, `0035`, renumbered if another
lands first) · **Red-team:** required (Drizzle schema change) · **Status:**
ready-for-agent

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
     hides its Host field and saves no Hosts, and the Schedule shows the
     Competition's Hosts instead.
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
     `src/lib/setup-schedule-faq.ts`. R26 deletes the MCP; if R25 lands
     first, `src/mcp/schedule.ts` (`toHourMinute`, `host`) is updated just
     enough to keep the gate passing.
   - The unique key on (day, start time, title) becomes
     `NULLS NOT DISTINCT`, so two untimed items with the same title can't
     share a day.
3. **Category first, then Competition.**
   - The form puts Category before Competition. The Competition field
     shows **only** when Category is Competition, is optional there (a
     "Bracket draw" may link none), and changing Category away clears it.
   - The server agrees: an item with a Competition and any other category
     is refused.
   - Picking a Competition fills an empty title with the Competition's
     name; a typed title is never overwritten.
4. **Layout.** Day, Start time and End time line up on one baseline at
   every width (labels, helper text and control heights match).
5. **Seed.** The demo seed's Schedule item `hosts` is a list of names,
   checked against the War Week's roster exactly as Competition `hosts`
   are ("Host "X" is not on this War Week's roster"). Items may omit a
   start time.

## Schema change (for the red-team)

- Drop `schedule_item.host`.
- `schedule_item.start_time` becomes nullable.
- The unique key on (`day_id`, `start_time`, `title`) becomes
  `NULLS NOT DISTINCT`.
- New `schedule_item_host` (`schedule_item_id` FK cascade,
  `participant_id` FK cascade, PK on both).
- No data conversion. Migration and demo seed change together.

## Acceptance criteria

- [ ] An Organizer adds a Schedule item with two Hosts picked by name; the
      participant Schedule shows "Hosted by" both, with avatars (e2e,
      screenshots at 1440 and 390).
- [ ] Adding a Host from another War Week's roster is refused (vitest on
      the mutation).
- [ ] An item linked to a Competition shows that Competition's Hosts and the
      form has no Host field (e2e).
- [ ] A Schedule item Host who is not a Competition Host gets no admin
      access (vitest on `access.ts`).
- [ ] An item with no start time saves, reads "Any time", sorts first in
      its day and is never Now or Next (vitest on `src/lib/schedule.ts`;
      e2e on the Schedule page).
- [ ] An end time without a start time is refused with "Add a start time
      first." (vitest).
- [ ] Two untimed items with the same title on one day are refused (vitest
      against seeded local Postgres).
- [ ] The Competition field shows only for the Competition category,
      changing category clears it, and picking a Competition fills an empty
      title (e2e). The server refuses a Competition on another category
      (vitest).
- [ ] Day, Start time and End time share a baseline at 1440 and 390
      (screenshots).
- [ ] The demo seed loads with list `hosts` and an untimed item, and an
      unknown Host name fails the load (vitest on the seed schema).

## Out of scope

- Converting any existing free-text Host.
- Hosts on Days, Announcements or anything other than Schedule items.
- Changes to Competition Hosts.

## Definition of Done

- [ ] Red-team the spec before implementation (`/atlas-red-team`).
- [ ] Migration and demo seed together; smoke on seeded local Postgres.
- [ ] `CONTEXT.md`: the Host entry's Schedule item line ("a Schedule
      item's Hosts are roster Participants shown as 'Hosted by'; they don't
      hold the Host role"), and Schedule item / Now/Next for untimed items.
- [ ] `docs/maintainers-guide.md`, `docs/regression-checklist.md` (Schedule
      lines at both viewports) and `/about` copy and media updated where
      affected.
- [ ] e2e screenshots at 1440 and 390 committed under `test-results/e2e/`.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.
- [ ] After merge (human, Paul): reset and reseed staging and production.

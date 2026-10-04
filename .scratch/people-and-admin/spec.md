---
title: People and admin (Epic R22)
status: ready-for-agent
grilled: 2026-10-04 (see ../regression-2026-10/grilling-2026-10-04.md)
created: 2026-10-04
source: Paul's regression feedback "10/3", items 5.2, 5.4, 7.1, 12.1, 15.1
---

# People and admin

**Epic:** R22 · **Branch:** `feat/r22-people-and-admin` · **Blocked by:**
R19 merged into `staging`. It is independent of R20 and can run alongside
it, but its migration lands one at a time with R21's: whichever merges
second renumbers its migration on the latest `staging` · **Red-team:**
required (Drizzle schema change and an access change) · **Status:**
ready-for-agent · **Absorbs:** backlog `regression-2026-10/issues/108`
(search by email on Host pickers)

## Summary

There are four problems around people and the admin area:

- **Hosts.** A Host is stored as an email, so an Organizer can't make
  someone a Host until that person has an email on the roster.
- **Host access.** Hosts can wander admin pages that aren't theirs.
- **Pickers.** Every participant picker looks a little different, and none
  shows a face.
- **Awards.** Awards hang off Categories when all Organizers want is to
  reuse last year's Award names.

On top of these, the `/about` screenshots still show War Week XI.

## Decisions

1. **A Host is a Participant.**
   - **Storage.** `competition_host` holds `participant_id`, a Participant
     on this Competition's War Week roster, instead of an email.
   - **Choosing a Host.** Any roster Participant can be chosen, with or
     without an email, and the "Add an email in Roster" disabling goes. A
     Participant with a non-@jahnelgroup.com email can be chosen too.
     They never get access, because sign-in still rejects them, and the
     picker says so.
   - **Who is a Host.** Host access is worked out at request time: the
     session email matches a roster Participant's email (case-insensitive,
     as Account linking does today, ADR 0007), and that Participant is a
     Host of the Competition. So a Host chosen before they have an email
     gets access once an Organizer adds their email in Roster and they sign
     in.
   - **Unchanged.** Google-only sign-in and the rejection of
     non-@jahnelgroup.com emails stay as they are.
   - **Migration.** Existing rows convert by matching the email to a
     Participant in that War Week. Unmatched rows are dropped and listed in
     the PR (XII is test data).
   - **Records.** Update ADR 0002 (or write a superseding ADR) for Hosts as
     Participants. MCP still never returns Host lists or emails.
2. **What Hosts can see in admin.**
   - A Host who isn't an Organizer sees **only the Competitions they host**
     (the Competitions list filtered to theirs, plus each one's admin page)
     and the **Host guide**.
   - Schedule, Announcements and Finale leave a Host's admin nav
     (`src/lib/admin-sections.ts`), and their routes and actions refuse a
     Host on the server (`src/app/admin/gate.ts`, `can` in
     `src/lib/access.ts`).
   - A Host opening another Competition's admin page gets the refusal page.
   - Organizers are unchanged.
3. **One `ParticipantPicker`.**
   - **What it is.** One component in `src/components/`, built on
     `EntityCombobox`. Each option shows **avatar · name · Team** (Team
     name, or color in a teams War Week; nothing in free-for-all). It
     searches by name **and email**, has no result cap, and works at 100+
     Participants.
   - **Where it replaces the current pickers.** Hosts (multi-select),
     Placement sheet, Entrants, Squads, match and game players, Award
     recipients and Discretionary points.
   - **Who took part.** The Participation list's filter stays a filter but
     shows the same avatar · name · Team rows.
   - **Organizers editor.** Stays a typed email, because Organizers needn't
     be on a roster.
   - **Email.** It may appear in the picker for Organizers and Hosts, who
     are JG staff on an authenticated admin page. It is never in MCP output
     or on public Participant pages.
   - **Backlog 108.** Closes with this.
4. **Consistency pass.** All Participant identities in admin and Competition
   pages use one display (`entrant-mark.tsx` or its successor): avatar, name
   and Team. The plan lists every place it changed. This is a pass over
   existing surfaces, not a redesign.
5. **Awards without Categories.**
   - **Data.** Drop `award_category` and `award.category_id`.
   - **Presets.** When an Organizer adds an Award, the name field offers
     **presets**: every distinct Award name (case-insensitive) already in the
     database across War Weeks, plus the seven former seeded Category names.
     Picking one copies its name and most recent description into the form,
     where both stay editable. Typing a new name is always allowed.
   - **Category admin.** The Category admin (add, rename, archive, restore)
     is removed.
6. **Award history by name.**
   - `/history/awards` lists Award names, each linking to a page showing
     that name across War Weeks, newest first. Grouping is by name,
     case-insensitive, with a stable slug.
   - The old `/history/awards/<categoryId>` links for the seven seeded
     Categories redirect (308) to the matching name page. Any other old id
     returns 404.
   - The Finale's Awards slides drop the per-Category layout and show one
     Award per step. The Finale still never reorders or recomputes
     Standings.
7. **`/about` screenshots in War Week XII.**
   - XII's theme is already in `seeds/demo/xii.json` (primary `#c2185b`,
     accent `#2f4fd8`, sans, free-for-all). The stills were last written
     with XI showing, most likely because `scripts/about-media.ts` uses the
     current War Week: when the DB holds the XI demo (`live`) next to the
     plain XII seed (`upcoming`), live XI wins.
   - Fix the script so it can't silently shoot the wrong War Week: it
     takes the edition to shoot (default the newest edition in `seeds/demo/`)
     and fails if that War Week isn't the one `/` resolves to, telling the
     runner to `pnpm seed:demo:<edition>` (and set any other live demo
     War Week back) first.
   - Regenerate every still (`pnpm build && pnpm seed:demo:xii`, then the
     script), last in this epic, so the stills also show the new pickers.

## Schema change (for the red-team)

- `competition_host`: change `email` to `participant_id`, an FK to
  `participant` with cascade delete. Keep a unique index on (competition,
  participant). Add a check, or a write-time rule, that the Participant
  belongs to the Competition's War Week.
- Drop `award_category`, and drop `award.category_id`.
- Migration and demo seeds change together. Seeds i–xii drop their Category
  tagging. Seeds load twice with no row-count change. Smoke's Award
  Category checks are replaced by preset and name-history checks.

## Acceptance criteria

- [ ] An Organizer makes a no-email roster Participant a Host. That person
      has no access. After the Organizer adds their email and they sign in
      (stub session), they see that Competition's admin page (e2e).
- [ ] A Host sees only the Competitions they host and the Host guide in the
      admin nav. Their requests to Schedule, Announcements, Finale, another
      Competition's admin page, and those pages' actions are refused on the
      server (e2e; smoke over HTTP for the actions).
- [ ] Sign-in still rejects non-@jahnelgroup.com emails (existing tests
      pass; one added for a Host with a non-JG email).
- [ ] Every listed picker is the `ParticipantPicker`. It shows avatar, name
      and Team, and finds a Participant by email at 100 Participants with
      no cap (vitest on the search; e2e on the scale seed, screenshots at
      1440 and 390).
- [ ] Adding an Award offers presets, including past names and the seven
      former Category names. Picking one fills the name and description,
      both editable. A new name works. No Category UI remains (e2e).
- [ ] `/history/awards` groups by name. A seeded Category's old URL
      redirects to its name page, and an unknown id returns 404 (smoke;
      e2e at two viewports).
- [ ] The Finale Awards slides show one Award per step, and the Finale
      Standings are untouched (e2e).
- [ ] `/about` stills show War Week XII's theme in light and dark, and
      `assertNoRealEmail` passes (`test-results/about-media/`).
- [ ] MCP has no Host lists and no `@` in any output (smoke).

## Out of scope

- People across War Weeks (backlog `regression-2026-09/issues/20`).
- Roster admin at 100 (backlog 109), beyond the picker.
- Organizers as Participants. The Organizers editor stays email-based.

## Definition of Done

- [ ] Red-team the plan before implementation (`/atlas-red-team`).
- [ ] Migration and demo seed together; smoke on seeded local Postgres.
- [ ] ADR for Hosts as Participants and for Host admin scope.
- [ ] `CONTEXT.md`: Host (a roster Participant), Award preset in place of
      Award Category, the history-by-name rule, and the Access rules for
      Hosts.
- [ ] `docs/maintainers-guide.md` (including the Host guide) and
      `docs/regression-checklist.md` updated for the Host role and Awards.
      `/about` copy and media updated.
- [ ] Backlog 108 closed with a pointer to this epic.
- [ ] e2e screenshots at 1440 and 390 committed under `test-results/e2e/`.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

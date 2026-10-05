---
title: People and admin (Epic R22)
status: done
grilled: 2026-10-04 (see ../regression-2026-10/grilling-2026-10-04.md)
created: 2026-10-04
revised: 2026-10-04 (red-team pass 1 resolved; see Comments)
source: Paul's regression feedback "10/3", items 5.2, 5.4, 7.1, 12.1, 15.1
---

# People and admin

**Epic:** R22 · **Branch:** `feat/r22-people-and-admin` · **Blocked by:**
none (R19 and R21 are merged; this epic's migration is the next one on
`staging`, `0033`, renumbered if another lands first) · **Red-team:**
required (Drizzle schema change and an access change); pass 1 resolved ·
**Status:** done · **Absorbs:** backlog
`regression-2026-10/issues/108` (closed as name-only search) and
`regression-2026-09/issues/83` (Show the Team in team events)

## Summary

There are five problems around people and the admin area:

- **Hosts.** A Host is stored as an email, so an Organizer can't make
  someone a Host until that person has an email on the roster.
- **Host access.** Hosts can wander admin pages that aren't theirs.
- **Pickers.** Every participant picker looks a little different, and none
  shows a face.
- **The Team in team events.** Many Competition and scoring surfaces don't
  say which Team a Participant plays for (backlog 83).
- **Awards.** Awards hang off Categories when all Organizers want is to
  reuse last year's Award names.

On top of these, the `/about` screenshots still show War Week XI, and the
per-Bracket Finale duplicates the War Week Finale.

## Data and deployed environments

XII is test data and nothing in staging or production is in real use. This
epic does not convert deployed data: the migration may drop and reshape
freely, and after merge staging and production are **reset and reseeded as
a human step** (Paul), as in R16 and R18. The migration must still apply
cleanly to a database holding today's schema, but no row conversion report
is needed.

## Decisions

1. **A Host is a Participant.**
   - **Storage.** `competition_host` holds `participant_id`, a Participant
     on this Competition's War Week roster, instead of an email.
   - **Choosing a Host.** Any roster Participant can be chosen, with or
     without an email, and the "Add an email in Roster" disabling goes. A
     Participant with a non-@jahnelgroup.com email can be chosen too (this
     supersedes R18's "only `@jahnelgroup.com` roster emails pickable").
     They never get access, because sign-in still rejects them, and the
     picker marks them "Can't sign in" without showing the email.
   - **Who is a Host.** Host access is worked out at request time: the
     session email matches a roster Participant's email (case-insensitive,
     as Account linking does today, ADR 0007), and that Participant is a
     Host of the Competition. So a Host chosen before they have an email
     gets access once an Organizer adds their email in Roster and they sign
     in. Changing a Participant's roster email moves their Host access to
     whoever owns the new email; the ADR says so.
   - **Same War Week.** The Participant must be on the Competition's War
     Week roster. As elsewhere in `src/mutations/` (Placements, Brackets,
     Participation), this is a write-time rule in the Host mutation, not a
     database constraint; a vitest proves a Participant from another War
     Week is refused.
   - **Unchanged.** Google-only sign-in and the rejection of
     non-@jahnelgroup.com emails stay as they are.
   - **Create next War Week no longer copies Hosts.** The new War Week has
     an empty roster, so there is no Participant to point at. Organizers add
     Hosts once the roster exists. Remove the Host copy from
     `src/mutations/war-week-lifecycle.ts` and its tests.
   - **Records.** A new ADR supersedes ADR 0002's Host storage and its "Create
     next War Week copies Hosts" line: Hosts are roster Participants, Host
     admin scope (Decision 2), the email-change consequence, and no Host
     copy-forward. MCP still never returns Host lists or emails.
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
   - Hosts lose nothing Finale-related they need: the Bracket Finale goes
     (Decision 8), and the War Week Finale at `/<edition>/finale` stays
     readable by any signed-in JG user.
3. **One `ParticipantPicker`.**
   - **What it is.** One component in `src/components/`, built on
     `EntityCombobox`. Each option shows **avatar · name · Team** per the
     Team display rule (Decision 4). It searches by **display name only**,
     has no result cap, and works at 100+ Participants.
   - **No email anywhere in a picker.** No picker's options, keywords or
     page payload carry a Participant's email, for any actor. This also
     removes the hidden email keyword ticket 106 added to the Organizer-only
     Discretionary points and Award pickers. Backlog 108 closes as
     "name-only".
   - **Where it replaces the current pickers.** Hosts (multi-select),
     Placement sheet, Entrants, Squads, match and game players (including
     the Participant-facing `result-form.tsx`), Award recipients and
     Discretionary points.
   - **Who took part.** The Participation list's filter stays a filter but
     shows the same avatar · name · Team rows and searches by name.
   - **Organizers editor.** Stays a typed email, because Organizers needn't
     be on a roster.
4. **The Team shows everywhere a Participant competes or scores (absorbs
   backlog 83).**
   - **One display.** `entrant-mark.tsx` (or its successor) renders a
     Participant everywhere below: avatar, name and, in a teams War Week,
     the Team.
   - **Team rule.** The **Team name** shows beside the name (as the
     individual leaderboard's Team tag does) wherever the row has room for
     it at the viewport. Where it doesn't (tree nodes, Finale steps,
     Now/Next tiles, and any row at 390 px that would wrap), the Team
     **color** shows instead: the initials Avatar's fill, and on a pictured
     Avatar a Team-colored ring. Never color alone where the name fits.
     Free-for-all War Weeks show no Team.
   - **Surfaces** (each checked at 1440 and 390 in a teams War Week):
     1. Standings: individual leaderboard on Home, `/leaderboard` and its
        points breakdown, the Finale's Standings.
     2. Brackets: the tree, Heat results, the Heat result form.
     3. Matches and Attempts: Head-to-head series view and results table,
        Best score results table, the log form's player pickers.
     4. Placement results table and Top finishers.
     5. Recent results on Home.
     6. Now/Next on Home.
     7. Award recipients on `/awards`, `/history/awards/<slug>` and the
        Finale's Awards steps.
     8. Admin: the Competition admin page's run area (Placement sheet,
        Entrants, Squads, Participation list), Discretionary points and
        Award recipients.
   - This is a pass over existing surfaces, not a redesign. The plan lists
     each component changed per surface.
5. **Awards without Categories.**
   - **Data.** Drop `award_category` and `award.category_id`.
   - **Presets.** When an Organizer adds an Award, the name field offers
     **presets**: every distinct Award name (case-insensitive) already in the
     database across War Weeks, plus the seven former seeded Category names
     (War Week MVP, Billable Hours Champ, Black Midnight, Grow, Grind, Serve,
     Inspire) as a constant in code. Picking one copies its name and most
     recent description into the form, where both stay editable. Typing a
     new name is always allowed.
   - **Category admin.** The Category admin (add, rename, archive, restore)
     is removed.
6. **Award history by name.**
   - `/history/awards` lists Award names, each linking to
     `/history/awards/<slug>`, a page showing that name across War Weeks,
     newest first. Grouping is by name, case-insensitive; the slug is the
     lowercased name with non-alphanumerics collapsed to `-`.
   - **No redirects.** Old `/history/awards/<categoryId>` URLs return 404
     like any unknown slug.
   - **Aligned names in the seeds.** So the same Award groups across years,
     these historical seed names are renamed (all other names stay as the
     wikis wrote them):

     | Seed name(s) | Becomes |
     |---|---|
     | Billing Hours Champ (iv, v) | Billable Hours Champ |
     | Settlers of Catan (iii, iv) | Settlers of Catan Champion |
     | Chess Tourney Champion (iii), Chess (iv), Chess Tournament Winners (vii) | Chess Tournament Champion |
     | Stairs Challenge Winners (ix) | Stairs Challenge Winner |
     | Mario Kart Winner (ix) | Mario Kart Champion |
     | Super Smash Bros (iv) | Super Smash Bros. Champion |
     | Battle of the Memes Winner (vii) | Battle of the Memes Champion |

   - **Finale Awards.** The Finale's Awards slides show one Award per step.
     The `finale_awards_layout` enum and column, the `/admin/finale` layout
     control and its action, the seed schema field and
     `e2e/regression-r13-built-in-slides.spec.ts`'s layout cases go. The
     Finale still never reorders or recomputes Standings.
7. **`/about` screenshots in War Week XII.**
   - XII's theme is already in `seeds/demo/xii.json` (primary `#c2185b`,
     accent `#2f4fd8`, sans, free-for-all). The stills were last written
     with XI showing, most likely because `scripts/about-media.ts` uses the
     current War Week: when the DB holds the XI demo (`live`) next to the
     plain XII seed (`upcoming`), live XI wins.
   - Fix the script so it can't silently shoot the wrong War Week: it takes
     the edition to shoot (default `xii`) and fails if that War Week isn't
     the one `/` resolves to, telling the runner to `pnpm seed:demo:xii`
     first.
   - Regenerate every still (`pnpm build && pnpm seed:demo:xii`, then the
     script), last in this epic, so the stills also show the new pickers.
8. **No Bracket Finale.**
   - Remove the per-Bracket Finale: the route
     `src/app/[edition]/finale/[competition]/`, `src/components/bracket-finale.tsx`,
     `src/lib/bracket/finale.ts` and its tests (and the parts of
     `third-place.test.ts` that only serve it), the "Bracket Finales"
     section of `/admin/finale`, and its cases in `e2e/bracket.spec.ts`.
   - The War Week Finale at `/<edition>/finale` is the only Finale.
   - `CONTEXT.md` (the Finale entry and the Bracket Finale lines),
     `docs/maintainers-guide.md` and `docs/regression-checklist.md` drop it.

## Schema change (for the red-team)

- `competition_host`: replace `email` (and its lowercase check and
  `(email, competition)` unique) with `participant_id`, an FK to
  `participant` with cascade delete. Unique on (participant, competition),
  participant first so it serves "what does this Participant host"; keep the
  competition index. Same-War-Week is a write-time rule (Decision 1).
- Drop `award_category` and `award.category_id`.
- Drop `war_week.finale_awards_layout` and the `finale_awards_layout` enum.
- Existing `competition_host` rows are deleted by the migration (data is
  reset after merge; see "Data and deployed environments").
- Migration and demo seeds change together. Seeds i–xii drop their Category
  tagging, apply the rename table (Decision 6), drop `finaleAwardsLayout`,
  and give Hosts by Participant (the seed format names a Host by its
  Participant's seed key or display name). Seeds load twice with no
  row-count change. Smoke's Award Category checks are replaced by preset and
  name-history checks.

## Acceptance criteria

- [ ] An Organizer makes a no-email roster Participant a Host. That person
      has no access. After the Organizer adds their email and they sign in
      (stub session), they see that Competition's admin page (e2e; the test
      restores the seeded roster email and Hosts afterwards).
- [ ] Adding a Host from another War Week's roster is refused (vitest on the
      mutation).
- [ ] Create next War Week copies no Hosts (vitest).
- [ ] A Host sees only the Competitions they host and the Host guide in the
      admin nav. Their requests to Schedule, Announcements, Finale, another
      Competition's admin page, and those pages' actions are refused on the
      server (e2e; smoke over HTTP for the actions).
- [ ] Sign-in still rejects non-@jahnelgroup.com emails (existing tests
      pass; one added for a Host with a non-JG email).
- [ ] Every listed picker is the `ParticipantPicker`. It shows avatar, name
      and Team, finds a Participant by display name at 100 Participants with
      no cap (vitest on the search; e2e on the scale seed, screenshots at
      1440 and 390).
- [ ] No email reaches any picker: the rendered HTML and RSC payload of the
      Participant Competition page, the Competition admin page (as a Host
      and as an Organizer), Discretionary points and Awards admin contain no
      seeded roster email (smoke over HTTP, searching for `@`-addresses from
      the seed).
- [ ] The Participation filter shows avatar · name · Team rows and filters
      by name (e2e).
- [ ] In a teams War Week, every surface in Decision 4 shows the Team per
      the Team rule, and a free-for-all War Week shows none (e2e screenshots
      of each surface at 1440 and 390; the regression checklist line "Teams
      show in team events" passes).
- [ ] Adding an Award offers presets, including past names and the seven
      former Category names. Picking one fills the name and description,
      both editable. A new name works. No Category UI remains (e2e).
- [ ] `/history/awards` groups by name: "Billable Hours Champ" shows iv, v
      and viii together. An old Category id URL and an unknown slug return
      404 (smoke; e2e at two viewports).
- [ ] The Finale Awards slides show one Award per step, there is no layout
      control on `/admin/finale`, and the Finale Standings are untouched
      (e2e).
- [ ] `/<edition>/finale/<competitionId>` returns 404 and `/admin/finale`
      has no Bracket Finales section (smoke; e2e).
- [ ] `/about` stills show War Week XII's theme in light and dark, and
      `assertNoRealEmail` passes (`test-results/about-media/`).
- [ ] MCP has no Host lists and no `@` in any output (smoke).

## Out of scope

- People across War Weeks (backlog `regression-2026-09/issues/20`).
- Roster admin at 100 (backlog 109), beyond the picker.
- Organizers as Participants. The Organizers editor stays email-based.
- Award Categories in any form; they can come back later if needed.

## Definition of Done

- [x] Red-team the spec before implementation (`/atlas-red-team`, pass 1
      resolved 2026-10-04).
- [ ] Migration and demo seed together; smoke on seeded local Postgres.
- [ ] ADR superseding ADR 0002's Host storage and copy-forward: Hosts as
      Participants, Host admin scope, email-change consequence.
- [ ] `CONTEXT.md`: Host (a roster Participant), Award preset in place of
      Award Category, the history-by-name rule, the Access rules for Hosts,
      no Bracket Finale, name-only picker search, and the Team rule with its
      surface list (replacing "Ticket 83 audits the surfaces").
- [ ] Blast radius updated for Hosts losing Schedule, Announcements and
      Finale: `scripts/smoke/hosts.ts`, `scripts/smoke/announcements.ts`,
      `e2e/regression-r5.spec.ts`, and the smoke and e2e lines in
      `docs/agents/testing.md`.
- [ ] `docs/maintainers-guide.md` (including the Host guide) and
      `docs/regression-checklist.md` updated for the Host role, Awards, the
      Team rule and the removed Bracket Finale. `/about` copy and media
      updated.
- [ ] Backlog 108 and 83 closed with a pointer to this epic.
- [ ] e2e screenshots at 1440 and 390 committed under `test-results/e2e/`.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.
- [ ] After merge (human, Paul): reset and reseed staging and production.

## Comments

- 2026-10-04 (red-team pass 1): BLOCKED, 3 blocking (Hosts not copied
  forward by Create next War Week with no decision; the Category redirect
  loses its id mapping when the table drops; email search on the
  Participant-facing player picker reaches public pages untested), 6
  warnings, 6 minor.
- 2026-10-04 (Paul, on pass 1): B1 Create next War Week needn't copy Hosts;
  B2 no redirect; B3 drop email display and email search, display name only;
  W1 no Categories, but align historical names; W2, W3 implementation detail,
  agent's discretion; W4 no Bracket-specific Finale, remove it; W5 reset the
  database, nothing is in real use; W6 fix all Team displays in this epic
  (absorb 83); minors at the agent's discretion. Applied: Host copy removed
  and recorded in the new ADR (B1); redirects dropped, old ids 404 (B2);
  name-only `ParticipantPicker`, no email in any picker for any actor, smoke
  over page payloads (B3); seed rename table and the Category names as a
  code constant for presets (W1); same-War-Week as a write-time rule with a
  vitest, matching `src/mutations/` (W2); `finale_awards_layout` dropped with
  its control, action, seed field and e2e cases (W3); Bracket Finale removed
  as Decision 8 (W4); no data conversion, human reset after merge (W5); the
  Team rule and a fixed surface list as Decision 4 with an AC, 83 absorbed
  (W6); migration number, `seed:demo:xii`, the Team name-or-color rule, a
  Participation filter AC, the Host blast radius and the email-change
  consequence (M1–M6).

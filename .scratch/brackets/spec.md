---
title: War Weeker — Brackets, War Week lifecycle, and hiding replaced by the Finale
status: done (delivered scope; the deferred tickets continue in .scratch/hardening/issues/16)
labels: [done]
created: 2026-09-24
source: Paul's first-use feedback and grilling session, 2026-09-24 (Q14–Q19, Q24–Q34, Q36); War Week lifecycle added 2026-09-25
order: 3 of 3 (after .scratch/admin-polish and .scratch/custom-inputs; built with shadcn per spec 2)
---

# Brackets, War Week lifecycle, and hiding replaced by the Finale

## Problem Statement

War Week is full of head-to-head and heat-based games: 1v1 chess, Captain Clash, drafted 2v2s, group games with several teams at once. Competiscore had bracket support. War Weeker only has Points Entries, so Organizers have to run brackets on paper or a whiteboard and then type the final points in by hand. Participants can't see who they play next or when.

Separately, hiding Standings turned out not to be useful. It adds a whole rule set (hidden pages, hidden MCP, hidden Competition entries) for little value. The Reveal animation itself is the best part of it and deserves to live on as a closing-ceremony screen.

Finally, the app can't move from one War Week to the next:
- Status is a free dropdown in `/admin/setup`, and nothing stops two War Weeks being `live` at once.
- A new edition can only be created by hand-writing a seed file and running the Seed workflow.
- Nothing in the app records a Winner or highlights, so a finished War Week can't be closed out properly.
- `/admin` always resolves to the current War Week. Once XII exists, XI can't be edited, so the "manual entry through the admin works for any edition" promise for past Brackets (Surfaces) can't be kept.

## Solution

1. **Remove hiding and turn the Reveal into the Finale** (ticket 1).
   - Standings are always visible.
   - The Reveal animation becomes an on-demand **Finale**: a full-screen, last-to-first countdown at `/<edition>/finale` for the closing ceremony.
   - It can also crown a finalized bracket's champion.
2. **Brackets.** A Competition gets a **Format**: `points` (today's behavior) or a bracket format.
   - **Formats:** single elimination, double elimination, round robin, multi-entrant heats, or group stage → knockout.
   - **Entrants:** Teams, Participants or ad-hoc **Squads**, with one-tap "all Teams" / pick-Participants shortcuts.
   - **Seeding:** random by default, by current Standings, or manual drag.
   - **Running it:** Organizers record Heat results, and Participants can self-report (opt-in per Competition) with confirmation.
   - **Points:** results become normal Points Entries, from final placings (default), per Heat won, or both. Standings stay computed only from Points Entries.
   - **Everywhere else:**
     - Heats show in Now/Next.
     - The bracket page refreshes live.
     - MCP gets `get_bracket`.
     - Seeds can hold brackets.
     - Slack can announce a champion.
     - The Archive shows past brackets.

3. **War Week lifecycle** (ticket 2).
   - Organizers **Start**, **End** and **Reopen** a War Week instead of picking a status, and at most one War Week is `live`.
   - **End War Week** records the Winner and highlights.
   - **Create next War Week** makes the next edition in the app, optionally copying Organizers, settings, the Appearance Theme and Competitions.
   - An admin **edition switcher** lets Organizers work on any edition, including the Archive.

Mobile first: the bracket view is designed from a phone prototype (ticket 3) before it's built.

## Vocabulary (add to CONTEXT.md)

"Tournament" and "Match" stay banned. New terms:

| Term | Meaning |
| --- | --- |
| **Finale** | The on-demand closing-ceremony screen that counts Standings in from last place to first. Replaces **Reveal**. |
| **Format** | How a Competition is run: `points`, `single-elimination`, `double-elimination`, `round-robin`, `heats`, `groups-knockout`. |
| **Bracket** | The Stages, Rounds and Heats of a non-`points` Competition. |
| **Stage** | One phase of a Bracket (a group stage, a knockout stage). Most Formats have one. |
| **Group** | A pool of Entrants within a round-robin Stage. Not a **Competition Group**. Name it "Pool" in code if the collision is confusing. |
| **Round** | One step of a Stage, holding Heats that can be played at the same time. |
| **Heat** | One game between two or more Entrants. Covers 1v1 and multi-entrant games. |
| **Entrant** | A Team, Participant or Squad entered in a Bracket. |
| **Squad** | An ad-hoc group of Participants entered as one Entrant, possibly across Teams. Belongs to one Competition. |
| **Seed Position** | An Entrant's starting rank in a Bracket. Say "seed position" or "seeding", never bare "seed", which means seed files here. |
| **Heat Result** | The finishing order of a Heat's Entrants, with an optional score for each. |
| **Self-report** | A Participant submitting a Heat Result for a Heat they're an Entrant in, pending confirmation. |

Remove **Reveal** and the "Reveal rules" section. Remove "Standings hidden" from the Competition display rules and the Access rules.

## User Stories

### Ticket 1: remove hiding, add the Finale
1. As a Participant, I always see Standings and every Competition's Points Entries; nothing is ever "hidden 🔒".
2. As an Organizer, I no longer see hide/reveal controls. `/admin/standings` becomes a **Finale** page with an "Open Finale" button and a "Finale: <Competition>" option for any finalized bracket.
3. As an Organizer at the closing ceremony, I open `/<edition>/finale` on the projector:
   - It shows a "Start" button.
   - Pressing it plays the countdown: rows appear from last to first, tied rows together, totals count up, every list finishes together, all in under 8 s. These are today's Reveal timing rules.
   - Keyboard `Space` / click starts it.
   - `prefers-reduced-motion` shows the final state.
   - "Replay" restarts it.
4. As an Organizer, I can run the Finale for a finalized bracket: its placings count in, and the champion gets a full-screen crown moment.
5. As a Claude user, MCP `get_leaderboard` always returns Standings.
6. As a visitor, the About page's reveal demo becomes a Finale demo, and its copy talks about the Finale, not hiding.

### Setting up a Bracket (Organizer)
7. As an Organizer creating a Competition, I pick a **Format**. `points` behaves exactly as today.
8. As an Organizer, I add Entrants quickly:
   - "All Teams".
   - "Pick Participants" (a searchable multi-select, filterable by Team).
   - "Add Squad" (name it, pick its Participants).
   - The Competition's `scoring` limits which kinds are allowed: team scoring takes Teams or Squads, individual takes Participants.
9. As an Organizer, I set Seed Positions: random (default, one-tap re-roll), by current Standings (Teams by Team Standings, Participants by individual Standings; not offered for Squads), or manual drag-to-reorder. Any method can be adjusted by drag afterwards.
10. As an Organizer, I configure the Format:
    - single/double elimination: optional third-place Heat; double elimination has a grand-final reset, on by default
    - round robin: number of Groups, and how many times each pair plays
    - heats: Entrants per Heat, how many advance from each, and number of Rounds, or "until one Heat left"
    - groups-knockout: Groups, how many advance from each Group, and the knockout options
11. As an Organizer, I press **Generate** to build the Bracket:
    - Byes appear automatically when the count isn't a power of two; top Seed Positions get them.
    - I can regenerate until the first Heat Result is recorded. After that, regenerating asks for confirmation and clears all results.
12. As an Organizer, I choose how the Bracket awards points: **placings** (default: final placings through the Competition's Placement Points), **per Heat won** (a points value per Heat win), or **both**.
13. As an Organizer, I can give any Heat an optional time (a Day + time, ET like Schedule Items) and location.

### Running a Bracket
14. As an Organizer, I record a Heat Result:
    - I tap Entrants in finishing order, with optional scores ("21–17", "1:32.4").
    - Knockout Heats need a clear order.
    - Round-robin and group Heats allow ties.
    - Winners advance automatically.
15. As an Organizer, I can mark a forfeit: the forfeiting Entrant loses, and the other(s) advance.
16. As an Organizer, I can edit a finished Heat. If later Heats depend on it, a confirmation lists those Heats, and they're reset to unplayed.
17. As an Organizer, I press **Finalize** when the Bracket is complete:
    - Points Entries are generated per the points setting.
    - The Bracket shows its champion.
    - An optional Slack post goes out ("Also post to Slack", like Announcements).
    - Un-finalizing deletes the generated Points Entries (after confirmation), and re-finalizing regenerates them.
18. As an Organizer, generated Points Entries appear in `/admin/points` marked "From bracket". They can't be edited there, and the bracket is where they change.

### Self-report (opt-in per Competition)
19. As a Participant who is an Entrant in a Heat, directly or through my Team or Squad, and whose sign-in links to my roster entry by email, I can submit that Heat's Result when self-report is on.
20. As another Entrant in that Heat (any linked Participant of another Entrant) or an Organizer, I can confirm or dispute a pending Result.
    - Only a confirmed Result advances anyone.
    - A dispute sends it back to pending with a note for Organizers.
21. As an Organizer, I can always overwrite or confirm any Result, and I see the pending and disputed Results in admin.

### Following a Bracket (Participant)
22. As a Participant on my phone, I see the Bracket in the layout chosen from the ticket 3 prototype:
    - Your Entrant highlighted (**You** rules).
    - Your next Heat pinned at the top: opponent, time, location.
23. As a Participant, round-robin and group Stages show a Group table (wins, ties, losses, score difference), with the Heats beneath.
24. As a Participant, the home page's Now/Next includes Heats with a time ("Up next · Heat 3 · Red vs Blue · Main room").
25. As a Participant, an open Bracket page refreshes about every 10 s and updates as Results land.
26. As a Claude user, MCP `get_bracket(competition)` returns the Bracket's Stages, Heats, Results and champion (read-only, no emails).
27. As a Participant browsing `/history`, a past edition's Bracket, entered by hand, displays the same way.

### Seeds
28. As a developer, a seed file can declare a Competition's Format, Entrants (including Squads), config and Heat Results. The XI demo seed ships one finished single-elimination Bracket and one in-progress round robin.

### War Week lifecycle (ticket 2)
29. As an Organizer, `/admin/setup` replaces the status dropdown with lifecycle actions, each behind a confirmation that says what changes (e.g. "XI moves to the Archive. XII becomes current."):
    - **Start War Week**: `upcoming` → `live`
    - **End War Week**: `live` → `complete`
    - **Reopen**: `complete` → `live`, for corrections made in the live view
30. As an Organizer, starting a War Week while another is `live` is refused ("End XI first"). There is never more than one `live` War Week.
31. As an Organizer ending a War Week, I confirm the **Winner** and can add highlights (short lines, like the seeded past editions). The Winner is prefilled from first place in Team Standings, or individual Standings in free-for-all, and I can edit it (a tie can be "Red & Blue"). Both show in `/history`. Ending lists, without blocking:
    - unfinalized Brackets
    - pending or disputed Heat Results

    This warning arrives with ticket 6.
32. As an Organizer, I press **Create next War Week** and enter:
    - edition (prefilled with the next Roman numeral)
    - edition number and year (prefilled with the next ones)
    - dates
    - Story Theme

    It starts `upcoming`. I choose what to copy from the War Week I'm on:
    - Organizers: on by default, and I'm always included
    - settings (mode, Team Label, Leader Title, Slack link, wiki link) and the Appearance Theme: on
    - Competitions with their Placement Points, scoring and Format config, but no Entrants, Bracket or Points Entries: off
    - FAQ: off

    Teams, roster, Days, Schedule, Points Entries, Awards and Announcements are never copied. Teams are re-drafted every year.
33. As an Organizer, an `upcoming` next War Week doesn't change what's current while this one is `live` (the MVP rule is unchanged). I can set XII up in advance, and `/` and `/admin` move to XII when XI ends.
34. As an Organizer, an **edition switcher** in the admin header lets me choose which War Week I'm administering. It defaults to the current one, and a banner shows when I'm on another ("Editing the Archive: War Week X"). It lists:
    - editions where I'm an Organizer
    - every `complete` edition, when I'm an Organizer of the current War Week, so that past Brackets (story 27) and old results can be entered or corrected
35. As an Organizer on a `complete` edition, I can edit its Winner and highlights in `/admin/setup`. Announcements there can't post to Slack.
36. As a maintainer, the maintainers guide describes the in-app flow. A seed file for a new edition becomes optional, and the "stop reloading a seed once Organizers edit in the app" warning stays.

## Implementation Decisions

### Ticket 1 (hiding removal)
- Migration drops `war_week.standings_hidden`, and the seed schema drops it. The loader must tolerate old seed files that still have it (strip and ignore) or all seeds get updated. Prefer updating all seeds.
- Delete the `hideStandings`/`revealStandings` actions, the hidden branches in the queries, pages, Competition pages and MCP, and `standings-visibility-controls.tsx`.
- `reveal-standings.tsx` is kept and renamed to the Finale player, keeping the timing rules as **Finale rules** in CONTEXT.md. The auto-refresh stays for live Standings. Only the hidden→revealed trigger goes.
- `/<edition>/finale` is readable by any signed-in JG user (anyone may watch). Only Organizers see the admin link.
- `docs/agents/planning.md`: replace the "Standings hidden/reveal change" policy row with "Finale change: red-team not required; the Finale must never reorder or recompute Standings". Paul approved editing this team-owned doc (Q34).
- The About demo (`about-reveal-demo.tsx`, `scripts/about-media.ts` stills, `src/lib/about.ts` copy) moves to Finale wording. `/about` stays static.
- Ticket 1 changes the schema, so it needs a red-team review, a seed + migration update, and a smoke test.

### Ticket 2 (War Week lifecycle)
- A pure module, `src/lib/war-week-lifecycle.ts`, holds `transitionError(from, to, { liveEdition })`, `nextEditionDefaults(warWeeks)` (Roman numeral, number, year) and `defaultWinner(standings)`, with unit tests for every from/to pair. Allowed transitions: `upcoming → live`, `live → complete`, `complete → live`. There's no way back to `upcoming`.
- `status` leaves `warWeekSettingsFields` (`src/lib/setup.ts`), so a settings save can never change it. The lifecycle actions are separate server actions. `winner` and `highlights` join the editable settings.
- A migration adds a partial unique index so the database also refuses a second `live` War Week: `CREATE UNIQUE INDEX war_week_one_live ON war_week ((true)) WHERE status = 'live'`. The seed loader reports a clear error when a seed would create a second one.
- `createWarWeek` inserts the row and the chosen copies in one transaction. The unique constraints on `edition`, `edition_number` and `year` become friendly field errors. Copied Competitions get new ids and are never linked to their source.
- **Admin scoping (access change, needs red-team review):**
  - `loadAdminPage` resolves the selected edition from an `admin_edition` cookie, set by the switcher. It falls back to the current War Week when the cookie is missing or no longer allowed.
  - Every admin action that calls `getCurrentWarWeek()` today (`src/actions/setup.ts`, `announcements.ts`, `awards.ts`, `setup-schedule-faq.ts`, and the points and bracket actions) must instead take the War Week id from the request and re-check access for *that* War Week on the server.
  - The rule lives in `src/lib/access.ts` as `canAdministerWarWeek(email, target, current)`: the email is in the target's `organizerEmails`, or the target is `complete` and the email is in the current War Week's `organizerEmails`.
- Public pages, `/<edition>` routes and MCP are unchanged: they already resolve by edition or use the current rule.
- Update `docs/maintainers-guide.md` ("Run a new War Week"), and add the lifecycle rules to CONTEXT.md next to the current War Week rule.

### Ticket 3 (prototype)
- A throwaway `/prototype/bracket` page (or a standalone HTML artifact) with fake data, for an 8-entrant single elimination, a 16-entrant double elimination, a 4×4 round robin and a 12-entrant 4-per-heat set, at 375px. It compares at least:
  - (a) Rounds as horizontally swiped columns with connector lines
  - (b) a vertical list of Heats grouped by Round, with "next Heat" chips
  - (c) (b) plus a zoomable full-bracket overview
- Paul picks. If he isn't available when it's ready, the implementer picks, favoring one-thumb use and no horizontal page overflow, and records the choice and reasoning in this spec under "Decisions" for Paul to overrule. Delete the prototype before ticket 5 merges.

### Schema (ticket 4)
- `competition.format` pgEnum (default `points`), `competition.bracket_config jsonb` (zod-validated per Format), `competition.bracket_points` enum `placings | per-heat | both`, `competition.points_per_heat_win numeric`, `competition.self_report boolean default false`, `competition.finalized_at timestamptz`.
- `squad(id, competition_id, name)` and `squad_participant(squad_id, participant_id)`. A Participant is in at most one Squad per Competition.
- `entrant(id, competition_id, team_id | participant_id | squad_id` (exactly one, check constraint), `seed_position int)`, unique per competition and target.
- `stage(id, competition_id, kind, position, config jsonb)`; `bracket_group(id, stage_id, name)`; `round(id, stage_id, bracket_group_id?, position, side: winners|losers|final)`.
- `heat(id, round_id, position, day_id?, start_time?, location?, status: pending|ready|reported|confirmed|disputed|forfeit)`, plus links to the Heats its winners and losers feed (`winner_to_heat_id`, `loser_to_heat_id`, slot numbers).
- `heat_entrant(heat_id, entrant_id, slot, place, score varchar(40), advanced boolean)`.
- `heat_report(heat_id, reported_by_email, result jsonb, confirmed_by_email?, disputed_note?, created_at)`. This is an audit trail, and it's never sent to the client with emails.
- `points_entry.competition_id` stays. Add `points_entry.generated_by_bracket boolean default false`, or a `source` enum. Generated rows are replaced wholesale on re-finalize.
- Setup-seed natural keys: Squad `(competition, name)`; Entrant `(competition, target name)`; Heats by `(stage position, round position, heat position)`. Bracket data is setup data (upserted, and deleted when absent) except Heat Results. Heat Results are Organizer-owned once the War Week is live: they're keyed like Points Entries (`key`) and never clobbered. The loader enforces Seed idempotence rules.
- Deleting a Competition cascades its Bracket. Deleting a Team or Participant that is an Entrant is refused with counts (existing refusal pattern).

### Engine
- A pure module, `src/lib/bracket/`, holds all bracket logic, with no DB. It's the most heavily tested part:
  - `generate(format, config, entrants) → stages/rounds/heats`
  - `applyResult(bracket, heatId, result) → bracket` (advancement and bye propagation)
  - `resetDownstream`
  - `groupTable` (win 1, tie ½, loss 0; tiebreak head-to-head, then score difference when scores are numeric, then Seed Position)
  - `finalPlacings`
  - `pointsFor(bracket, competition) → Points Entry drafts`
- Double elimination: standard winners/losers with a grand final. The optional reset Heat is played only if the losers-side Entrant wins the first grand final.
- Heats Format: sort each Heat by place, advance the top N into the next Round's Heats, snake-seeded. The last Round's order is the final placing.
- Groups-knockout: round-robin Groups, then the top N of each Group into single elimination, cross-seeded (A1 v B2, B1 v A2, …).
- Final placings for elimination: 1st, 2nd, then 3rd (from the third-place Heat, or tied 3rd), and later places tied by the Round they lost in. Placement Points apply to places 1–5. Tied places each get that place's points (existing "ties are equal entries" rule).

### Access
- Organizers (`requireOrganizer`) do all setup, generation, results, finalizing and overrides. There are no new roles (Q18).
- Self-report is the first non-Organizer write in the app. It needs a red-team review and its own check in `src/lib/access.ts` (e.g. `canReportHeat(sessionEmail, heat, roster)`):
  - self-report must be on
  - the session must be a JG email that account-links (email match, not the localStorage "Which one is you?" pick) to a Participant who is, or is on, one of the Heat's Entrants
  - the Heat must be `ready` or `disputed`
- Confirming requires a linked Participant on a *different* Entrant in the same Heat, or an Organizer.
- Google-only, `@jahnelgroup.com`-only sign-in is unchanged. MCP stays read-only.

### Surfaces
- `/<edition>/competitions/<id>` renders the Bracket for non-`points` Formats (layout from ticket 3).
- `/admin/setup/competitions/<id>/bracket` is the builder: Entrants, seeding, config, Generate.
- `/admin/brackets/<id>` runs results (phone-first).
- Now/Next: Heats with a Day and start time join the Schedule's now/next computation under the same ET rules (60 minutes when there's no end). A Heat is never duplicated by a Schedule Item that links the same Competition; both show.
- Live refresh reuses `auto-refresh.tsx`.
- MCP `get_bracket` lives in `src/mcp/`, registered in `tools.ts`, never returns emails, and gets tests like the other tools.
- Slack: a finalize post reuses the Announcement webhook path. A failure never blocks finalizing, and the Organizer is told.
- Archive: past editions render Brackets from their data. There's no extraction from old wikis in this spec; manual entry through the admin works for any edition.
- All UI uses shadcn components (spec 2 rule).

## Suggested ticket order (for /to-tickets)

1. Remove hiding; Reveal → Finale (schema, red-team).
2. War Week lifecycle: Start / End / Reopen with the one-live guard, Winner on End, Create next War Week with copy options, admin edition switcher (access change, red-team).
3. Bracket view prototype at 375px; the pick is recorded.
4. Bracket schema + seed schema + migration + engine skeleton (red-team).
5. Single elimination end to end: builder, seeding, Generate, results, byes, forfeits, reset of later Heats, participant view, XI demo bracket.
6. Finalize → Points Entries (placings / per-heat / both), "From bracket" in the admin ledger, Finale for a Bracket, Slack post, and End War Week's unfinalized-Bracket warning.
7. Round robin + Group tables + ties.
8. Double elimination (+ grand-final reset).
9. Multi-entrant heats.
10. Groups → knockout.
11. Squads.
12. Self-report + confirm/dispute (access change, red-team).
13. Heat times/locations + Now/Next.
14. MCP `get_bracket`, live refresh, Archive view (by-hand entry for past editions uses ticket 2's edition switcher).

Each ticket is a vertical slice that passes `pnpm gate` alone.

## Acceptance Criteria

- [ ] **Ticket 1:**
  - No `standings_hidden` column, action, UI or copy remains (grep `standingsHidden|hideStandings|revealStandings|hidden 🔒` is empty outside migrations).
  - MCP `get_leaderboard` always returns Standings (test).
  - `/xi/finale` plays the countdown on Start, and reduced motion shows the final state (screenshot plus a short video, since motion and timing matter).
  - The planning.md and CONTEXT.md updates are in the PR.
- [ ] **War Week lifecycle** (red-team + tests):
  - `transitionError` is unit-tested for every from/to pair, including a refused second `live`. The partial index also rejects one (DB test).
  - Create next War Week copies exactly what was chosen, never Teams, roster, Days, Schedule, Points Entries, Awards or Announcements. The creating Organizer is always an Organizer of the new War Week.
  - Smoke on a fresh DB: XI `live` → create XII → end XI with a Winner → start XII. `/` shows XII, `/history` shows XI with its Winner, and the switcher can still edit XI.
  - A signed-in non-Organizer can't change any edition, even with a forged War Week id. An Organizer of only a past edition can't change the current one.
  - The maintainers guide and CONTEXT.md updates are in the PR.
- [ ] **Engine:** unit tests for every Format:
  - generation for 2–17 Entrants, including byes
  - advancement, forfeits and reset of later Heats
  - the double-elimination reset
  - Group table ties and tiebreaks
  - Heats-format advancement
  - groups-knockout cross-seeding
  - final placings and tied places
  - `pointsFor` under placings, per-heat and both
- [ ] **Seeds:** the XI seed loads twice idempotently with its demo Brackets. An organizer-entered Heat Result survives a reload. Invalid bracket fixtures are rejected (seed schema tests).
- [ ] **Finalize:** generated Points Entries appear in Standings. Un-finalizing removes them. Re-finalizing produces the same entries. Hand-entered Points Entries on the same Competition are untouched.
- [ ] **Access** (red-team + tests):
  - A non-linked or non-Entrant session can't report.
  - A linked Entrant can report only their own Heat, only when self-report is on.
  - Only a different Entrant or an Organizer can confirm.
  - Non-JG emails are still refused.
  - MCP remains read-only and email-free.
- [ ] Now/Next shows timed Heats under the ET rules, with a unit test using `?at=`.
- [ ] `get_bracket` has tests like the other MCP tools, and smoke hits `/api/mcp`.
- [ ] Screenshots at 375px and 1280px of each Format's participant view, the builder and the results screen, in XI and one dark past edition; zero horizontal overflow at 375/768/1280.
- [ ] CONTEXT.md glossary updated with the vocabulary above, and the banned-term scan still passes.
- [ ] `pnpm gate` passes on every ticket's PR.

## Decisions

Recorded overnight 2026-09-25 by the orchestrator (Paul asleep); each is Paul's to overrule.

- **Red-team adjudication** (`/atlas-red-team`, 2 blocking, 6 warnings, 10 minors):
  - B1 (Squads have no Points Entry target) and B2 (the Slack champion post needs the unbuilt webhook): Squads and the Slack post are deferred, so neither blocks this delivery. B1 resolved by Paul (2026-09-25 morning): Squads generally stay inside one Team, so a Squad's points go to its Team in team scoring. Proposed for ticket 11: refuse a Squad whose Participants span Teams.
  - W1: `status`, `winner` and `highlights` are seed-initialized-only (set on insert, never overwritten on reload).
  - W2: manual drag seeding is deferred; seeding is random with a one-tap re-roll.
  - W3: the "banned-term scan" is the ticket 1 grep over `src scripts seeds docs CONTEXT.md README.md`.
  - W4: `requireOrganizer` applies `canAdministerWarWeek`; row-scoped actions derive the War Week from the row; create actions use the admin edition selection and re-check it.
  - W5: `points_entry.generated_by_bracket boolean`; `heat.status` is `pending | ready | played | forfeit`; single-stage schema (no stage/round tables) for single elimination.
  - W6: the Points Entry mutations refuse generated rows.
  - M1–M10 applied where the delivered slice touches them.
- **Phone bracket layout (ticket 3):** option (b), a vertical list of Heats grouped by Round with "Winner → Semifinal 1" chips, a pinned champion card and "Your next Heat". No horizontal page scroll, one-thumb friendly. The prototype ticket was skipped.
- **Reopen and Create next War Week** need an Organizer of the current War Week; Reopen is only for the most recently ended edition. Closes the review finding that a past-edition Organizer could take over the current War Week.
- **Delivered overnight:** ticket 1 (Finale), ticket 2 (lifecycle), and the single-elimination core loop (tickets 4–6 cut down). **Deferred:** double elimination, round robin, heats, groups-knockout, Squads, self-report, heat times and Now/Next, MCP `get_bracket`, the Archive bracket view, seeds with Brackets, the Slack champion post, the Finale for a Bracket, drag and by-Standings seeding, and per-heat / both points.

## Out of Scope

- Swiss and ladder / king-of-the-hill Formats (Swiss is a likely follow-up).
- New roles (Scorekeeper, Competition Runner). Organizers only, plus Self-report.
- Extracting historical brackets from `old-wikis/`.
- Live score streaming within a Heat.
- Clock-driven War Week transitions. Status stays a deliberate Organizer action (MVP rule).
- Deleting a War Week in the app, and copying Teams or the roster into the next edition.

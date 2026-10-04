---
title: Competition setup and logging (Epic R21)
status: in-progress
claimed: atlas-implement, Paul Macfarlane, 2026-10-04
grilled: 2026-10-04 (see ../regression-2026-10/grilling-2026-10-04.md)
created: 2026-10-04
source: Paul's regression feedback "10/3", items 2.1, 3.2, 3.4, 3.5, 5.1, 5.6, 5.7, 8.1, 8.3, 8.4, 8.5, 8.7, 10.1, 10.3, 10.5, 14.1
---

# Competition setup and logging

**Epic:** R21 · **Branch:** `feat/r21-competition-setup` · **Blocked by:**
R20 (`../competition-results/spec.md`) merged into `staging` ·
**Red-team:** required (Drizzle schema change) · **Status:**
in-progress · **Absorbs:** backlog `regression-2026-09/issues/25` (rename
`finalized_at` / `generated_by_bracket`)

## Summary

Setting up and logging a Competition still leans on extra machinery:
scheduled closing times nobody needs, three kinds of "who may write",
places and winners picked by hand when the Scores already say who won, and a
Head-to-head form that makes you pick "player A" and "player B". This epic
does four things:

- Every Format is closed on demand.
- One self-report setting replaces the rest.
- A score direction and unit decide places and winners from Scores.
- Bracket Group matches become flexible per round and per match.

Head-to-head becomes a fixed two-Entrant series, and Best score gets
Attempt limits and no Entrant list.

## The model after this work

| Format | Who records | Result | Points |
|---|---|---|---|
| **Placement** | Organizers, Hosts (no self-report) | One sheet; Places, or Scores plus a direction and unit, fill Places | Placement Points on **Close**; **Reopen** withdraws |
| **Bracket** | Organizers, Hosts; players in a Match when self-report is on | Head-to-head (2 per Match, 1 advances, optional 3rd place match) or Group (per-round defaults, per-Match overrides); a direction and unit order each Match | Placement Points for decided places (max 4) on **Close** |
| **Head-to-head** | Organizers, Hosts; either player when self-report is on | Exactly 2 Entrants, Best of 1/3/5/7; a direction and unit pick each Match's Winner | Placement Points by series result on **Close** |
| **Best score** | Organizers, Hosts for anyone; any War Week Participant as themselves when self-report is on | Attempts, optional max per person; a person's best Attempt; a Team's best member or sum of members | Placement Points by standing on **Close** |
| **Participation** | Organizers, Hosts; self check-in where on | Who took part | unchanged |

## Decisions

### Lifecycle and times

1. **Close / Reopen everywhere.** `finalized_at` becomes `closed_at`. Every
   Format closes and reopens the same way, writing or withdrawing generated
   Points Entries. Backlog 25 is folded in: rename `generated_by_bracket` to
   a Format-neutral name (for example `generated`). The Bracket's closing
   rules are unchanged apart from the name.
1a. **Internal names follow the domain words.** With the schema, rename
   tables, columns and code so nothing internal says Heat, Game, Finalize
   or Champion:
   - `heat` → `bracket_match`, `heat_entrant` → `bracket_match_entrant`.
   - `game` / `game_player` split in two, since this epic reshapes both
     users anyway: Head-to-head **Matches** (`series_match`,
     `series_match_entrant`: two Entrants, Scores, Winner) and Best score
     **Attempts** (`attempt`: one Participant or Team, one Score).
   - `game_config` → per-Format config names (for example
     `series_config`, `best_score_config`); `GAME_FORMATS`,
     `src/lib/games/`, `games-builder.tsx`, `games-view.tsx`,
     `game-form.tsx` and their actions, queries and tests renamed to match.
   - Column and FK names follow (`reported_by_*`, `logged_by_*`,
     `recorded_at` keep their meaning under the new tables).
   - The exact names are the plan's call within this rule; the red-team
     checks the migration preserves every row.
   - Spec A's temporary banned-term allowlist is deleted: after this epic
     the scan has no exceptions for Heat, Game or Finalize in code.
2. **Drop scheduled times.** `logging_closes_at`, `enroll_closes_at` and
   `check_in_closes_at` are dropped. So are their settings fields, help text
   and checks (`src/lib/games/log-rule.ts`, `enroll-rule.ts`, the
   Participation check-in rule) and their settings locks
   (`src/lib/competition-locks.ts`). Enrollment still closes when the
   Bracket is built, the limit is reached, or the Competition is Closed.
   Check-in closes when Closed.
3. **Settings locks** come only from play having started (a result, Match,
   Attempt or Bracket exists) or the Competition being Closed.

### Who may write

4. **One self-report setting:** "Participants can log their own results"
   (`self_report`), **off by default on every Format**, shown for Bracket,
   Head-to-head and Best score (and League in spec D). Placement never shows
   it, and ADR 0010 stands.
   - **Bracket:** a linked Participant in a Match (or on its Team or Squad)
     may record it (ADR 0005's rule).
   - **Head-to-head:** either player (or someone on their Team) may log a
     Match.
   - **Best score:** a linked Participant logs Attempts **as themselves**,
     with no participant picker. In team scoring, the Attempt counts for
     their Team.
   - Organizers and the Competition's Hosts always log for anyone.
   - **Who may edit or delete a result:** anyone who could have logged it
     (Paul, 2026-10-04). An Organizer or the Competition's Host always can;
     with self-report on, so can the Participant (or Team member) it is for,
     whoever logged it. For example, a Host logs a Participant's Attempt and
     that Participant edits it. This replaces ADR 0006's "only the logger"
     rule. When edits are allowed at all (an open Competition, nothing
     downstream) is the open question below.
   - Write one ADR recording the single setting. It supersedes the
     self-report parts of ADR 0005 and 0006 (and 0006's "only the logger" edit rule), and those two are marked
     superseded in part.
5. **"Open to everyone" goes.** `entrants_open` is dropped, and with it the
   Entrants select for Games.
   - Head-to-head Entrants are always set by an Organizer or Host.
   - Best score has **no Entrant list and no enrollment** (decision 12).
   - "Participants can enroll" (`self_enroll`, `entrant_limit`) remains for
     Bracket only (and League in spec D).

### Scoring

6. **Score direction and unit** live in one shared scoring config for
   Placement, Bracket and Head-to-head: none, higher or lower is better,
   plus an optional unit label of up to 20 characters. Best score already
   has `betterIs` and `unit`. Fold all of them into one shape, with the
   storage left to the plan (columns or jsonb).
   - Scores are numbers.
   - The unit shows in the Score column header ("Score (sec)") and in
     logging forms.
   - Direction "none" keeps manual places and winners.
7. **Places and Winners come from Scores.**
   - Placement already fills Places from Scores.
   - In a Bracket Match, once every Entrant has a Score, places in the
     Match (and so who advances) follow the direction.
   - In a Head-to-head Match, the higher or lower Score wins. Equal Scores
     are a Draw if draws are allowed. Otherwise the result is a tie the
     recorder must settle by picking the Winner.
   - A tie, or a deliberate correction, can always be overridden by hand,
     and the override is shown ("set by hand").
8. **Bracket Match Scores become numeric.** `heat_entrant.score` changes
   from varchar(40) to numeric. Existing values that don't parse become
   null, and the migration's output lists them for the PR. XII is test data.
9. **Remove the 5 · 3 · 1 quick fill** (`QUICK_FILL` in
   `src/lib/placement-rows.ts` and its button) and **"Add everyone"** on the
   Placement sheet.

### Bracket setup

10. **Head-to-head / Group toggle.** Bracket settings show a two-way toggle
    (shadcn `ToggleGroup` or `Tabs`).
    - **Head-to-head:** 2 per Match, 1 advances, and the 3rd place match
      option (at least 4 Entrants).
    - **Group:** shows entrants per Match and how many advance. Head-to-head
      shows neither.
11. **Flexible Group Matches.**
    - **Defaults and overrides.** Each round has defaults (entrants per
      Match, how many advance). When the Bracket is built, Matches fill from
      the defaults, and every Match can then override both its size and its
      advancing count. Advancing is always fewer than the Match's Entrants,
      except in a bye.
    - **Moving Entrants.** Organizers and Hosts can move an Entrant between
      Matches in the same round before that round has a result.
    - **Byes.** A Match with no more Entrants than advance is a bye. Its
      Entrants advance without a result, as today.
    - **Next round.** A round's advancers are the sum of its Matches'
      advancers. The next round's Matches fill from them using that round's
      defaults, and can again be edited.
    - **Locks.** Editing a round is locked once any Match in it has a
      result.
    - **Final and points.** The final is a single Match, and its order
      gives the decided places for Placement Points (max 4).
    - **Engine.** `src/lib/bracket/engine.ts` changes from one global heat
      size to per-round defaults with per-Match overrides. The tree view
      handles Matches of different sizes in one round.

### Head-to-head

12. **Exactly two Entrants** (Participants or Teams), set by an Organizer or
    Host. **Best of 1, 3, 5 or 7, required.** The "no Best of, log as many
    as you like" option goes. Best of 1 is a single Match.
    - **Logging a Match:** the form shows both Entrants as fixed rows, each
      with a Score field (unit shown), and the Winner is worked out
      (decision 7) or picked. There's no "player A / player B" picker.
    - **Series decided:** once one Entrant has the majority, logging is
      refused on the server, and the button is disabled with the reason.
    - **Draws:** with draws allowed, a drawn Match counts toward neither
      Entrant. When all Matches are played without a majority, the series
      is drawn and no more Matches can be logged. Both Entrants share the
      higher place and its full points (the existing tie rule).
13. **Best score.**
    - No Entrant list: anyone who logs an Attempt appears in the standings.
    - **Optional "Max attempts per person"** (blank means unlimited). It is
      enforced on the server for everyone, Organizers and Hosts included;
      mistakes are fixed by editing or deleting an Attempt.
    - The log form says how many Attempts you have left.
    - **No Best / Total setting** (Paul, 2026-10-04). The Score rule
      follows scoring instead:
      - **Individual:** a person's Score is their best Attempt.
      - **Team:** a team-only setting, **Team score**: **Best member** (the
        Team's single best Attempt by any member, today's best mode) or
        **Sum of members** (each member's best Attempt, added up, so every
        member's climb counts, as in a stairs Competition). Default: Best
        member.
      - The "count" setting goes from the settings form, the config schema,
        MCP and the seed format; Team score replaces it in the config. A
        team Competition stored with total becomes Sum of members; an
        individual one stored with total becomes best. The only one is the
        XI demo's Tuesday Stairs (team): its Team totals change where a
        member logged more than once, and the PR lists the before and
        after.
    - **One entry, updated in place.** When "Max attempts per person" is 1
      and you already have your Attempt, the log button reads "Update your
      score" and edits that Attempt instead of being refused. Organizers
      and Hosts logging for someone at the limit edit that person's
      Attempt the same way. Above 1, reaching the limit refuses as before.
    - **Participants edit their own Attempts** (decision 4's edit rule).
      When self-report is on, a Participant can edit or delete each of
      their own Attempts (every one, when more than one is allowed),
      whoever logged it, from their row's expanded list. Editing never
      counts against "Max attempts per person".

## Open question (grill at planning)

- **When may a result be edited?** Paul's direction (2026-10-04): edits are
  allowed "within reason": while the Competition is open and the edit has
  no cascading effect, and never once it is Closed. To settle before
  planning, per Format: a Bracket Match whose result already advanced
  someone into a played later Match; a Head-to-head Match once the series
  is decided; a Best score Attempt (no cascade); Placement rows (already
  locked by Close). This decides the lock rules in decision 3 and the
  edit rule in decision 4.

## Schema change (for the red-team)

- `competition`:
  - rename `finalized_at` to `closed_at`;
  - drop `logging_closes_at`, `enroll_closes_at`, `check_in_closes_at` and
    `entrants_open`;
  - add the shared scoring config (direction and unit) for Placement,
    Bracket and Head-to-head;
  - add `max_attempts` (Best score);
  - `bracket_config` gains a per-round defaults shape;
  - `game_config` loses the null Best of;
  - update the CHECK constraints to match.
- `points_entry.generated_by_bracket` is renamed.
- Table renames and the `game` split (decision 1a), each a data-preserving
  migration, with seeds and the seed loader updated.
- `heat`: per-Match `slot_count` and advancing count.
- `heat_entrant.score` becomes numeric.
- Migration and demo seed change together (`seeds/*.json`, scale seed and
  fixture). Seeds load twice with no row-count change. XII data is test
  data, so the conversion may reset it. Staging and prod reset as in R16.

## Acceptance criteria

- [ ] Every Format shows Close / Reopen and writes or withdraws Points
      Entries the same way. `closed_at` replaces `finalized_at` (vitest;
      smoke's Bracket loop updated).
- [ ] No "closes at" field exists on any Format's settings, and nothing
      refuses a write because of time. Enrollment closes on build, limit or
      Close (vitest on the rules; e2e).
- [ ] Self-report is off on a new Competition of every Format. When on:
      - a linked Participant logs a Best score Attempt as themselves, with
        no picker;
      - either Head-to-head player logs a Match;
      - a Bracket Match player records it.

      When off, each of these is refused on the server. Placement never
      offers it (e2e with stub sessions; smoke over HTTP).
- [ ] A Placement with "lower is better" and unit "sec" fills Places from
      Scores and shows "Score (sec)". A tie is settled by hand and marked
      (e2e).
- [ ] A Group Bracket Match and a Head-to-head Match each get places or a
      Winner from Scores and direction. Equal Scores need a manual pick, or
      record a Draw when allowed (vitest; e2e).
- [ ] Head-to-head Best of 3: after 2–0, logging a third Match is refused on
      the server and disabled in the UI with the reason. A drawn series
      that runs out is drawn, with shared points. The log form shows two
      fixed rows and no player picker (vitest; e2e).
- [ ] Best score with "Max attempts" 3: a fourth Attempt is refused for the
      Participant and for an Organizer, the form shows attempts left, and
      there's no Entrant list or enroll button (vitest; e2e).
- [ ] Best score has no Best / Total choice (settings form, config schema,
      MCP output, seed format). Individual: a person with three Attempts
      scores their best. Team: the Team score setting shows only for team
      scoring; Best member ranks by the Team's single best Attempt, Sum of
      members by the sum of each member's best, and Tuesday Stairs is Sum
      of members (vitest; e2e).
- [ ] Best score with "Max attempts" 1: after your Attempt, the button reads
      "Update your score" and saving edits it (no second Attempt is
      stored); an Organizer logging for that person edits it too
      (vitest; e2e).
- [ ] Best score with self-report on and "Max attempts" 3: a Participant
      with three Attempts (one logged by a Host) edits and deletes each from
      their expanded row; another Participant can't, and the server refuses
      them. With self-report off, the Participant can't edit their Attempts
      either (vitest; e2e).
- [ ] Head-to-head with self-report on: either player edits a Match a Host
      logged for them (vitest).
- [ ] Bracket settings show Head-to-head / Group. Only Group shows the size
      fields, and only Head-to-head shows the 3rd place match (e2e).
- [ ] Group Bracket of 11 with defaults of 4 per Match, 2 advancing:
      - one Match overridden to 3 Entrants and 1 advancing;
      - an Entrant moved between Matches;
      - a short Match treated as a bye;
      - the next round filled from the summed advancers;
      - run to Close with the right decided places and points.

      Editing a round with a result is refused (vitest on the engine; e2e).
- [ ] No 5 · 3 · 1 button and no "Add everyone" (e2e).
- [ ] Migration converts the seeds, non-numeric Match Scores are listed, and
      seeds load twice unchanged. Smoke's CHECK-constraint inserts are
      updated and pass (smoke).
- [ ] MCP reflects the new config (direction, unit, Best of, max attempts,
      flexible Matches) with no `@` (smoke).

## Out of scope

- League (spec D).
- Auto-close, or a "close it?" prompt, on the final Match (decided no).
- Time formats for Scores (Scores stay numbers).

## Definition of Done

- [ ] Red-team the plan before implementation (`/atlas-red-team`).
- [ ] Migration and demo seed together; smoke on seeded local Postgres.
- [ ] One ADR for the single self-report setting; ADR 0005 and 0006 marked
      superseded in part.
- [ ] `CONTEXT.md` updated: Close / Reopen, the removed terms (Logging
      closes, Enrollment closes, Check-in closes, Entrants open, Quick
      fill), score direction and unit on every scored Format, flexible
      Group Matches, and Head-to-head's two-Entrant rule.
- [ ] `/about`, `docs/maintainers-guide.md` and `docs/regression-checklist.md`
      updated (team rules).
- [ ] Backlog item 25 closed with a pointer to this epic.
- [ ] e2e screenshots at 1440 and 390 committed under `test-results/e2e/`.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

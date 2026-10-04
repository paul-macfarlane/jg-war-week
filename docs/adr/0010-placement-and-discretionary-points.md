# ADR 0010: Placement and Discretionary points writes

- Status: accepted (built in Epic R16, work package regression-r16)
- Date: 2026-10-03
- Extends: ADR 0002 (its three roles stand; this adds two families of writes)
- Replaces: the `points-entry.create`, `.edit` and `.delete` actions

## Context

Until Epic R16 a Competition run as `points` was scored by typing Points
Entries by hand, on a Points page that Organizers and the Competition's
Hosts shared. Every other Format turned a result into points on its own
(a Bracket's Finalize, a Game Competition's Close). Typing totals meant the
Standings could say a Team had 5 points with nothing recording why, and
"who came 1st" lived only in an Organizer's head.

R16 makes points come from results. Two new write families replace the
hand-typed Points Entry:

- a **Placement** Competition holds one result on one sheet (a Place and an
  optional Score per Team or Participant), and **Finalize** turns it into
  generated Points Entries through the Competition's Placement Points;
- **Discretionary points** are the points that belong to no Competition
  (the Subjective Points of War Week XI): a Team or Participant, a number
  of points and a required reason.

Both need server-side rules, and the second needed a scope the Points
Entry never had: a Discretionary entry has no Competition to inherit its
War Week from.

## Decision

### Placement writes

| Action | Who |
|---|---|
| `placement.edit` (add, change or remove a row; Add everyone; the Score direction) | Organizers, and the Host of that Competition |
| `placement.finalize` | Organizers, and the Host of that Competition |
| `placement.reopen` | Organizers, and the Host of that Competition |

**Participants never record Placements.** Unlike Check in (ADR 0009) or
Log a Game (ADR 0006), there is no Participant facet: a Placement is the
Host's record of a result, and a Participant sees it read-only on the
Competition page. A Host of another Competition, and a Host of the same
Competition in a different War Week, are refused.

Every action runs `authorize` (ADR 0003) with the Competition as the
target, then `can`. The mutation repeats the checks under the Competition's
row lock: rows can't change while the Competition is Finalized (Reopen
first), a Finalize with a Score but no Place is refused naming the rows,
and a Team Competition takes only Teams and an individual one only
Participants of the Competition's War Week (ADR 0003).

### Discretionary points

| Action | Who |
|---|---|
| `discretionary.create` (checked against the War Week target) | Organizers only |
| `discretionary.edit` (checked against the entry's target) | Organizers only |
| `discretionary.delete` (checked against the entry's target) | Organizers only |

**Hosts and Participants are refused.** A Host runs a Competition; a
Discretionary entry has none, so no Host has a claim on it. The Points
page's Host access goes with the Points page.

**Scope is `points_entry.war_week_id`.** The column is new, not null, and
set from the request's War Week on create (and from the Competition, for a
generated entry, in the same transaction). Every Points Entry read and write
scopes by it; none joins through `competition` for the War Week, because a
Discretionary entry's `competition_id` is null. The target Team or
Participant must belong to that War Week (ADR 0003), checked in the write
since no Competition enforces it. A database CHECK
(`points_entry_reason_without_competition`) requires a reason when there is
no Competition; the entry's `note` is the reason.

Edit and delete refuse an entry that has a Competition: a generated entry is
only ever created and removed by its Competition's Finalize, Close or
Reopen, and a Discretionary action must never reach one. The edit keeps who
entered the entry and when, and marks it edited.

### Retired actions

`points-entry.create`, `points-entry.edit` and `points-entry.delete` are
removed from `WarWeekAction`. A Points Entry is now either **generated** (by
a Competition's result: Placement Finalize, Bracket Finalize, Games or
Participation Close) or **Discretionary**; nobody hand-types one against a
Competition. `/admin/points` and `/admin/points/<id>` redirect to
`/admin/discretionary-points`.

## Considered options

- **Keep the Points page for Hosts, beside Placement.** Rejected. A Host
  could then hand-write points that no result explains, which is the
  problem the epic exists to remove.
- **Let a Participant record their own Placement** (as for self-report).
  Rejected. A Placement ranks everyone; one person's claim moves other
  people's points. A Host records it, an Organizer corrects it.
- **Let Hosts give Discretionary points on their own Competition.**
  Rejected. Discretionary points exist for what no Competition covers; a
  Host who wants points for a Competition's result records a Placement.
- **Scope Discretionary points through a required Competition.** Rejected.
  Subjective Points is not a contest, and inventing one to hang the entry
  on would put it in Recent results and Champions.

## Consequences

- `WarWeekAction` gains `placement.edit`, `.finalize`, `.reopen` and
  `discretionary.create`, `.edit`, `.delete`, and loses the three
  `points-entry.*` actions. `src/lib/access.test.ts` has a unit test for
  every role each refuses; each action also has a Postgres test calling the
  server action as that role.
- ADR 0002's role table and CONTEXT.md's Access rules list these writes.
- Any new raw-SQL writer of `points_entry` must set `war_week_id`; the
  type checker cannot see it.
- The deployed databases were reset, not converted, to reach this schema
  (`docs/maintainers-guide.md`, "How R16 reached staging and production").

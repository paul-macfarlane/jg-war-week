# ADR 0009: Participants check themselves in

- Status: accepted (built in Epic R12, work package regression-r12)
- Date: 2026-10-02
- Extends: ADR 0006 (its three Participant writes stand; this adds a fourth)

## Context

War Week has always scored taking part: Black Midnight, the daily
workouts, Spirit submissions, HQ attendance. Ticket 69 adds the
**Participation** Format for them: the Host (or an Organizer) ticks who
took part, and points land when the Host presses Close, like a `games`
Competition. For a workout or a check-in that happens all week, in many
places, the Host can't see everyone; the people who took part can say so
themselves.

## Decision

A Participant gets a fourth write, **Check in**, bounded the way ADR 0005
and ADR 0006 bound theirs: the Participant is found by **account linking
by email only**, and every check runs in `can` (the `checkIn` facet,
decided before the Organizer shortcut; a caller that forgets the facet is
refused) and again in the mutation under the Competition's row lock.

A signed-in Participant may check themselves in to, or out of, a
Competition when all of these hold:

1. it is run as `participation`, and it isn't closed;
2. its **Self check-in** switch is on (off by default), and its optional
   check-in close time hasn't passed;
3. their session email links to a Participant of its War Week;
4. in team scoring, that Participant is on a Team.

Checking in records them as having taken part, marked as their own
check-in. **Checking out removes only their own check-in**: a Participant
the Host or an Organizer ticked can't untick themselves ("The Host marked
you; ask them to remove it."). The Host or an Organizer ticks or unticks
anyone (`participation.mark`) until Close; a Host or Organizer checking
themselves in is a Participant like any other and uses Check in.

Nothing is scored until Close, and a closed Competition refuses every
mark and check-in, from everyone; Reopen withdraws its points (as for
`games`).

## Considered options

- **Host-only, as today.** Rejected: the reason for the ticket. The Host
  isn't at every workout.
- **Any Participant marks anyone.** Rejected: one person could tick a
  whole Team.
- **A Participant may also remove the Host's mark.** Rejected: the Host's
  tick is the Host's record; a Participant who disagrees asks the Host.

## Consequences

- `AccessTarget` gains the `checkIn` facet; `can` gains
  `participation.check-in` and `participation.check-out` (Participant
  writes) and `participation.settings`, `.mark`, `.close`, `.reopen` (the
  Host of the Competition, and every Organizer).
- Who marked someone (`participation.marked_by_email`) is kept for audit
  and never read back to a page, an action payload or MCP.
- A Participant whose check-in the Host removed can check in again while
  check-in is open; the Host turns Self check-in off or sets a close time
  to stop that.
- CONTEXT.md's Participant sentence and ADR 0002's role table list this
  write with those of ADR 0005 and ADR 0006.

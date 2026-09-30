# ADR 0006: Participants write their own play

- Status: accepted (built in Epic R3, work package regression-r3)
- Date: 2026-09-28
- Extends: ADR 0005 (Self-report stays as decided; it is no longer the only Participant write)

## Context

ADR 0005 gave a Participant exactly one write: Self-reporting a Heat they're
in. The regression feedback adds two things that only work if players write
for themselves:

- **`games` Competitions** (ping pong all week, a best-of-5 showdown). The
  Host won't be at every table, so the players log their own Games.
- **Self-enrollment** in fixed-list Competitions, so the Organizer and Host
  don't have to add every Entrant by hand.

## Decision

A Participant gets three more writes, each bounded the way ADR 0005 bounds
Self-report: the Participant is found by **account linking by email, never
the "Which one is you?" pick**, and every check runs in `can` and again in
the mutation.

1. **Log a Game** in a `games` Competition they are an Entrant in (or eligible
   for, when the Competition is open to everyone): as the Participant, or as
   a Participant on a Team Entrant. It counts at once.
2. **Edit or delete a Game they logged**, until the Competition closes. This
   differs from ADR 0005, where a Participant can never overwrite: a Game is
   one row of many, not a slot that advances a Bracket, so a fix by its
   logger harms no one else. Other players in the Game can't edit or delete
   it; they ask the Host.
3. **Enroll and withdraw** in a Competition whose "Participants can enroll"
   switch is on (off by default), until enrollment closes (Bracket built,
   Entrant limit reached, close time passed, closed by the Host, or, for a
   `games` Competition, its first Game logged). In team scoring, any
   Participant on a Team can enter or withdraw their Team; in a Squads
   Bracket, they join or leave a Squad the Host created. A Leader is still a
   label, never a permission.

The Host or an Organizer can edit or delete any Game and add or remove any
Entrant at any time before close. A closed `games` Competition refuses
writes from everyone; reopen, edit, close again (hardening decision 4).

## Considered options

- **Opponent confirmation of Games.** Rejected: friction kills casual
  logging, and the Host already fixes mistakes (ADR 0005's reasoning).
- **Any player in a Game can delete it.** Rejected: lets a loser erase a
  loss.
- **Only Leaders enter their Team.** Rejected: it turns a label into a
  permission.
- **Host-only entry.** Rejected: the reason for the feedback.

## Consequences

- `AccessTarget` gains facets for Game logging and enrollment; a caller that
  forgets them is refused, never granted.
- CONTEXT.md's Participant sentence and ADR 0002's role table list the
  writes from ADR 0005 and this ADR.
- The plan changes access, so it is red-teamed (`docs/agents/planning.md`).

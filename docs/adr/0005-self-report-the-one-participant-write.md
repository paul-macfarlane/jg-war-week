# ADR 0005: Self-report is the one Participant write

- Status: accepted (built in `.scratch/hardening/epics/G-squads-and-self-report.md`); superseded in part by ADR 0011 and ADR 0013
- Date: 2026-09-27
- Superseded in part by ADR 0011 (One self-report setting): its Bracket-only self-report switch and bound 4, "a second report is refused" (a player now edits a recorded result with self-report on). The account-linking and being-in-the-Match bounds stand.
- Superseded in part by ADR 0013 (Remove the MCP): the MCP clause of "never sent to the client or MCP" (there is no MCP).

## Context

ADR 0002 made Participants read-only: everyone signed in who isn't an
Organizer or a Competition's Host can read War Week and write nothing. But
about 25 past Competitions ran on the honor system: players told the Host
who won, and the Host typed it in. Waiting on the Host for every Heat slows
a Bracket down on the day, and a Host who trusts their players gains
nothing by being the only keyboard.

## Decision

A Participant gets exactly one write, `bracket.heat-report`: entering the
Heat Result of a Heat they're in. It is bounded four ways, all checked by
`can` (`src/lib/access.ts`, before the Organizer shortcut, so the Heat's
facts bind everyone) and again by the mutation under the Competition row
lock:

1. **Self-report is on** for the Competition. It is off by default; an
   Organizer or the Competition's Host turns it on or off in the Bracket
   builder.
2. **Account linking by email, never the pick.** The signed-in JG email
   must match a Participant's roster email in the Competition's War Week
   (ignoring case). The "Which one is you?" pick is a display preference
   anyone can set, so it never grants a write.
3. **Being in the Heat**: as the Participant Entrant, on the Team Entrant,
   or in the Squad Entrant.
4. **The Heat has no result yet.** A Participant can never overwrite; of
   two reports at once, the second is refused ("This Heat already has a
   result.").

A report counts at once and advances Entrants exactly as the Host's result
does (the same `writeHeatResult` core). Honor-system Competitions trust
their players; a Host who doesn't leaves self-report off, or turns it off
(results already reported stand). Only the Host or an Organizer changes a
result already entered; a Host save that changes a reported result clears
its reporter. The reporter's email is stored on the Heat for audit and
never sent to the client or MCP; the results screen shows their
Participant name ("Reported by Ashley Schuliger").

## Considered options

- **Host confirmation of each report** (each report held back until the
  Host accepts or rejects it). Rejected by Paul on 2026-09-27: "If a self report makes the
  host confirm, then there is no point in the self report."
- **Opponent confirmation and disputes** (the brackets spec's stories
  19–21). Rejected: more rules for the Host to referee, for a problem the
  Host already solves by overwriting.
- **A Scorekeeper role.** Rejected (Q18): a fourth role for one action;
  `can` stays the one rule with three roles.

## Consequences

- `AccessTarget` gains a `heatReport` facet the caller loads
  (`getHeatReportFacts`); a caller that forgets it is refused, never
  granted. The report action runs `authorizeHeatReport` in ADR 0003's
  order, and only then parses its input.
- CONTEXT.md's Participant sentence changes from "can't write anything" to
  "has one write: reporting the result of a Heat they're in when
  self-report is on (ADR 0005)".
- ADR 0002's role table reads "Read; one write, self-report (ADR 0005)"
  for a Participant.

## Later notes

- 2026-10-02: the "Which one is you?" pick was removed (regression
  ticket 52); account linking is the only way You is found.

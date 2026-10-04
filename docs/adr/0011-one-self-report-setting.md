# ADR 0011: One self-report setting

- Status: accepted (built in Epic R21, work package r21-competition-setup)
- Date: 2026-10-04
- Supersedes in part: ADR 0005 (its self-report switch and "a second report is refused") and ADR 0006 (its Log a Match / Log an Attempt rule and "only the logger" edit rule)
- Extends: ADR 0002 (its three roles stand), ADR 0010 (Placement stays Host-recorded)

## Context

Participant writes had grown three separate rules. ADR 0005 let a Participant
report a Bracket Match they were in, once, behind a Bracket-only switch.
ADR 0006 let a Participant log a Game in a Head-to-head or Best score
Competition and edit or delete only the one they logged, with no switch at
all (anyone eligible could log). A Host who logged a Participant's Attempt
could not let that Participant fix it. Regression feedback "10/3" asked for
one switch, off by default, with one edit rule.

## Decision

### One setting

`competition.self_report`, shown as **"Participants can log their own
results"**, is **off by default on every Format**. It is offered on Bracket,
Head-to-head and Best score, and **never on Placement**: ADR 0010 stands, a
Placement is the Host's record and a Participant never writes it.
Participation keeps its own Self check-in switch (ADR 0009). The setting
locks only while the Competition is Closed. As before, the Participant is
found by account linking by email, never by a pick, and `can` and the
mutation both check.

### Who may log

With self-report off, only Organizers and the Competition's Hosts log, for
anyone. With it on, in addition:

| Format | A Participant may log |
|---|---|
| Bracket | The result of a Match they are in (as the Participant, on its Team, or in its Squad) |
| Head-to-head | A Match, if they are one of the series' two Entrants or on that Entrant Team |
| Best score | An Attempt **as themselves** (no participant picker); in team scoring it counts for their Team |

### Who may edit or delete

**Anyone who could have logged it**, and only while the Competition is open.
Organizers and the Competition's Hosts always can. With self-report on, so
can the Participant (or Team member) the result is for, whoever logged it: a
Host logs a Participant's Attempt and that Participant may edit it. This
replaces ADR 0006's "only the logger". **Closed means nobody**, Organizers
and Hosts included: Reopen first. Nothing here cascades into Points, which
exist only after Close.

### Answers per Format (execution plan D1a to D1f)

- **D1a Best score Attempt:** edit or delete while open.
- **D1b Head-to-head Match, including once the series is decided:** edit or
  delete while open. The series recomputes; if the edit undecides it, logging
  reopens. A decided or drawn series refuses a new Match, for Organizers and
  Hosts too, until one is edited or deleted.
- **D1c Bracket Match:** only the latest result along a path is editable. A
  Match whose result a later Match already used offers no edit or clear
  action: the buttons are disabled with the visible text "A later Match
  already used this result. Change that Match first." (text, not a hover
  tooltip, so it shows on phones), and the server refuses a direct request as
  a backstop. A correction clears results back from the latest one. The old
  confirm-and-reset of later results is removed. In a Group Bracket a Match is
  editable while no Match its advancers went to has a result, and an edit that
  would change who advances is refused once the next round has a result.
- **D1d Bracket players editing a recorded result:** allowed with self-report
  on, for the Matches they played. This replaces ADR 0005's "a second report
  is refused".
- **D1e Placement rows:** unchanged, editable while open, locked by Close.
- **D1f Result edit after its round is complete, next Match unplayed:**
  allowed. The next round re-fills from the new advancers, and any moves or
  overrides made there are lost.

## Considered options

- **Keep one rule per Format.** Rejected: three switches (or none) for one
  idea, and Hosts could not tell what a Participant could do.
- **Only the logger edits.** Rejected: a Host-logged Attempt then could never
  be fixed by the person it belongs to.
- **Host confirmation of each report.** Still rejected (ADR 0005): no point in
  self-report if the Host must confirm.
- **Let a Participant edit after Close.** Rejected: points exist after Close;
  Reopen is the one correction path, for everyone.

## Consequences

- ADR 0005 and ADR 0006 keep their other decisions (0005: the account-linking
  and Match-membership bounds; 0006: enrollment, and Participants never
  writing Placements) and carry a "Superseded in part" status line.
- CONTEXT.md's Access rules and **Self-report** term read as above;
  `docs/regression-checklist.md` and the guide describe the one switch.
- `AccessTarget` keeps its report and log facets, now carrying the
  Competition's `selfReport`; a caller that forgets them is refused, never
  granted.

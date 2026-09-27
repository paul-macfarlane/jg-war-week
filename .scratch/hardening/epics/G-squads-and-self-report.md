# Epic G: Squads, self-report and the contract migrations

**What to build:** The rest of ticket `16` that changes who can be in a Bracket and who can write to it, plus the two waiting contract migrations. It's one work package, one branch and one PR into `staging`: **Squads** (T11), **self-report** as redefined (T12: a Participant reports, the Competition's Host confirms), dropping `war_week.organizer_emails` (ticket 18), and dropping `competition.bracket_points` (ticket 19).

**Tickets:** `16` (items 3 and 4 of its Order table, plus the End War Week warning for pending reports from story 31), `18`, `19`; files under `../issues/`

**Branch:** `feat/hardening-g-squads-and-self-report`

**Blocked by:** Epic F (its PR merged into `staging`, since both touch the bracket builder, results screen and participant view); Paul confirming the human preconditions on tickets 18 and 19 (Epics B and E on `main` long enough that no rollback goes past them), which moves both to `ready-for-agent`. If Paul wants Squads and self-report before that, tickets 18 and 19 leave this epic for their own `chore/` PR and nothing else changes.

**Status:** ready-for-agent (blocked as above)

**Red-team:** required. Squads, self-report and both drops change the Drizzle schema, and self-report is the first write by a plain Participant (`docs/agents/planning.md`).

## Named needs

- **Host:** about a dozen past Competitions were drafted pairs or small groups inside a Team (2v2s, Bouncy Ping Pong's teams of 2). Today a Host can enter only whole Teams or single Participants.
- **Host:** about 25 past Competitions ran on the honor system. The Host can't watch every game, so players report their own results and the Host checks them.
- **Participant:** reports their own Heat from their phone instead of finding the Host.
- **Maintainer:** two columns no code reads are still in the schema.

## Decisions (proposed 2026-09-27; Paul confirms or overrules before `/atlas-plan`)

These replace the brackets spec's stories 19–21 (confirm or dispute between opponents) and settle the open parts of stories 8 and 9 for Squads.

**Squads**

1. A **Squad** is a named group of Participants entered as one Entrant. It belongs to one Competition, and all its Participants are on the same Team: a Squad that spans Teams is refused (Paul, B1). A Participant is in at most one Squad per Competition.
2. Squads are allowed only in team-scoring Competitions. A Bracket's Entrants are all Teams, all Participants or all Squads, never mixed.
3. In the builder, "Add Squad" names it and picks its Participants from one Team. Deleting a Participant who is in a Squad is refused with counts, like deleting an Entrant.
4. A Squad's Placement Points go to its Team as normal "From bracket" Points Entries. Two Squads of one Team each earn their own entry.
5. Seeding by Standings (Epic F) isn't offered for Squads; random is.
6. **You** rules: a Participant in a Squad sees that Squad highlighted and gets its "Your next Heat".

**Self-report**

7. Self-report is off by default and switched on per Competition by an Organizer or that Competition's Host, in the bracket builder.
8. A signed-in JG user can report a Heat when self-report is on, the Heat has all its Entrants and no result, and their email links (account linking, never the "Which one is you?" pick) to a Participant who is the Entrant, on the Entrant's Team, or in the Entrant's Squad.
9. A report uses the same finishing-order and score form as the results screen. It's pending: it advances no one, and the Participant sees "Waiting for the Host to confirm".
10. A second report on a Heat with one pending is refused ("A result is already waiting for the Host.").
11. The Competition's Host or an Organizer **confirms** a report (it becomes the Heat Result and advances Entrants exactly as a Host-entered result does) or **rejects** it with an optional note (the report is discarded and the Heat can be reported again; the reporter sees the note on the Heat). A Host or Organizer can always enter or overwrite a result directly, which discards any pending report.
12. The results screen marks Heats with a pending report, and the admin bracket list shows how many are waiting.
13. End War Week also lists Brackets with pending reports, without blocking (story 31).
14. The reporter's email is stored for the audit trail and never sent to the client or MCP; screens show the reporter's Participant name.

## Order

1. Ticket 19 and ticket 18 (small, independent; the drops go first so the other migrations build on the final schema).
2. Squads.
3. Self-report.

## Acceptance criteria

Brackets spec stories 8 and 22 for Squads, and decisions 1–14 above, plus:

- [ ] Ticket 18's and ticket 19's acceptance criteria.
- [ ] Unit tests for the access rule for reporting (pure `can(actor, action, target)` in `src/lib/access.ts`): self-report off; a signed-in user not linked to any Participant; a linked Participant not on any of the Heat's Entrants; a linked Participant on each Entrant kind (the Participant, their Team, their Squad); a Heat that's decided, not yet filled, or already has a pending report. Confirming and rejecting: that Competition's Host and Organizers only, never the reporter as a Participant or a Host of another Competition. Non-JG emails are still refused.
- [ ] Unit tests for Squads: a Squad spanning Teams and a Participant in two Squads of one Competition are refused; a mixed-kind Entrant list is refused; Squad placings produce Team Points Entries.
- [ ] DB tests: confirming a report advances Entrants and resets later Heats exactly like a Host-entered result; rejecting leaves the Heat as it was; a direct Host result discards the pending report; un-finalizing and re-finalizing a Squad Bracket regenerate the same Points Entries.
- [ ] MCP stays read-only and email-free: `get_bracket` shows Squads by name and never shows a report or the reporter's email.
- [ ] The migrations apply to the seeded local database; every seed still loads twice; smoke passes on it.
- [ ] Playwright: a Host builds a Squad Bracket, turns on self-report and generates it; a Participant (stub JG session linked by email) reports their Heat and sees it waiting; the Host rejects one report and confirms the next, and the Squad advances. End War Week names the Bracket with a pending report.
- [ ] Screenshots at 375px and 1280px of the Squad builder, the Participant's report form and waiting state, and the Host's pending report on the results screen; zero horizontal overflow at 375/768/1280.
- [ ] Single elimination and Heats without Squads or self-report behave as before; the existing engine, mutation, smoke and Playwright bracket checks pass unchanged in what they assert.
- [ ] CONTEXT.md (Squad and Self-report in the glossary, the access rules, "Bracket rules"), `/about` copy and media, the Organizer guide and `docs/maintainers-guide.md` match every user-visible change.
- [ ] Ticket 16 records a `[PROGRESS]` comment for this slice; with this epic its remaining open items are only T8 double elimination (on request) and the Slack champion post (ticket 17), so its `Status:` moves to `done` with a closeout that says so. Tickets 18 and 19 and this epic record their closeouts and are set to `done` in this branch.
- [ ] `pnpm gate` passes locally and in CI.

## Out of scope

- Squads across Teams, Squads in individual scoring, and Squads in the seed schema.
- Confirmation by opponents; disputes between Participants.
- Round robin, drag seeding and the Archive bracket view: cut from ticket 16 (Paul, 2026-09-27).
- Double elimination: only on request. The Slack champion post: ticket 17.

## Comments

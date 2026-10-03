# 102: Hosts picked from the roster

**What to build:** An Organizer picks a Competition's Hosts by **name** from the War Week's roster, in a searchable multi-select; each option shows the name with the email in small type beneath (to tell apart similar names). Replaces typing emails (`JgEmailChips`, `src/components/competitions-editor.tsx:370`).

**Part of:** Epic R18 (one work package; see the epic for branch, migration, gate and test data).

**Blocked by:** `101` (order inside R18)

**Status:** in-progress

**Source:** Paul's regression feedback 2026-10-03 (Admin: hosts by email is weird); grilling Q7; red-team pass 1 W3, W4, M3

## Decisions

- Options: roster Participants (name per Profile, R10) whose email can sign in, i.e. ends `@jahnelgroup.com` (W4, Paul: anyone who can sign in can be a Host). A Participant with no email shows disabled with "Add an email in Roster"; one with another domain shows disabled with "Only @jahnelgroup.com emails can sign in". No raw email entry.
- Storage stays `competition_host.email`; the server still validates with `jgEmailListSchema`. An existing Host whose email isn't on the roster shows as their email with a warning, removable.
- Built on `EntityCombobox` (multi-select). Saved through 101's per-field autosave; still guarded by `competition.assign-hosts`.
- **Emails reach Organizers only** (W3): the roster options and Host emails are loaded only for an Organizer. A Host's page gets Host names (as 101), never roster or Host emails.

## Acceptance criteria

- [ ] e2e: an Organizer searches a name, picks two Hosts (one an XI Participant given `E2E_HOST_EMAIL` with `withParticipantEmail`), autosave; the Host signs in, opens the Competition page and records a result.
- [ ] Unit test: options exclude Participants without an email and mark non-`@jahnelgroup.com` ones disabled with their reason; two Participants both named "Sam Lee" with different emails render as two options, each showing its email.
- [ ] Postgres test: a Host is refused saving Hosts (as 101).

## Comments

- 2026-10-03 [CLAIM] (atlas-implement, work package `regression-r18`): claimed with Epic R18; `ready-for-agent` → `in-progress`. Execution record: [`R18-execution.md`](../epics/R18-execution.md).

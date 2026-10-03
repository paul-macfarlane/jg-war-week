# 102: Hosts picked from the roster

**What to build:** An Organizer picks a Competition's Hosts by **name** from the War Week's roster, in a searchable multi-select; each option shows the name with the email in small type beneath (to tell apart similar names). Replaces typing emails (`JgEmailChips`, `src/components/competitions-editor.tsx:370`).

**Blocked by:** `101`

**Status:** ready-for-agent

**Source:** Paul's regression feedback 2026-10-03 (Admin: hosts by email is weird); grilling Q7

## Decisions

- Options: roster Participants with an email (name per Profile, R10). Participants without an email show disabled with "Add an email in Roster". No raw emails.
- Storage stays `competition_host.email`; an existing Host whose email isn't on the roster shows as their email with a warning, removable.
- Built on `EntityCombobox` (multi-select).

## Acceptance criteria

- [ ] e2e: search a name, pick two Hosts, autosave; one Host signs in and runs the Competition.
- [ ] Unit test: options exclude Participants without an email; similar names are distinguishable by email.
- [ ] `pnpm gate` passes.

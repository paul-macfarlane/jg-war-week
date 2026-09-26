# Browser check: a Host's /admin (production build at HEAD 611f9b8)

Built-in browser against `pnpm start -p 3200`, local Postgres, a fresh seed. The session is a local test Host, `verify-host@jahnelgroup.com`, hosting XI's "Tuesday Stairs".

- `/admin/points`:
  - The sidebar shows Overview, Guide, Points Entries, Finale, Announcements and Setup. There are no Awards or Organizers links.
  - The ledger lists only the Host's Competition (2 entries, both "Tuesday Stairs").
- The Points Entry "Competition" combobox, opened, offers exactly one option: "Tuesday Stairs" (Team · Max 3 pts).
- `/admin/setup` lists only Competitions ("Competitions, scoring, Placement Points and Hosts.") and Schedule. War Week settings, Days, Teams & roster and FAQ are hidden.
- `/xi/faq`: the primary navigation shows the "Admin" link to the Host.

Not observed in a browser: the rendered error-boundary copy. Forcing the error needs the smoke run's temporary table rename, which wasn't run outside smoke. Ticket 04's criterion 3 rests on the smoke check (`hardening-b-smoke/`).

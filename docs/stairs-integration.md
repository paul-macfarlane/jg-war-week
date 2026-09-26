# Stairs App integration (not built)

Status: **stub**. Nothing here is implemented. HQ Attendance is scored with
Points Entries that Organizers enter by hand in `/admin/points`.

This note records what we know so the integration can be picked up later
without redoing the research.

## What the Stairs App has

- It logs self-reported stair climbs, keyed by the climber's
  `@jahnelgroup.com` email.
- Its API needs a Firebase ID token, so the JG War Week app can't call it with its own
  Google sign-in or a server credential today.

## Recommended route

Add an **API-key-protected date-range report endpoint** to the Stairs
backend (estimated **5–8 hours**): given a start and end date, it returns
climbs per email. The JG War Week app would then:

1. Call it with a server-side API key (a new env var; never exposed to the
   browser) for the War Week's dates.
2. Match each email to a Participant by their optional `email` (unique within
   a War Week; see `CONTEXT.md`).
3. Write the result as ordinary Points Entries in the HQ Attendance
   Competition, with `entered_by_email` naming the integration, so the
   Standings function, the ledger and the Finale treat them like any other
   entry.

## Blocker

No one is documented as owning the Stairs deploy, so there is nobody to
review, ship or run the new endpoint. Find an owner before building it.

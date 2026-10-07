# Final regression feedback (Host role and R22–R24), 2026-10-06

Paul's last regression pass before War Week XII, after R22–R24 merged into
`staging`. Recorded verbatim; grilled 2026-10-06 ([record](./grilling-2026-10-06.md)). Paul's framing: limit this
to big features and functional requirements, not the minutiae.

## Big things

- B1. The MCP feels like a waste right now; there is no real use case for it. Scrap it (`src/mcp/`, `src/app/api/mcp/`).

## Small things

- S1. Having to press "Save entrants" is inconsistent with the rest of the form, which autosaves.
- S2. Checking participation as an admin is glitchy: check it, it unchecks, then it's rejected.
- S3. The participation display has a strange grid layout on bigger screens; is it consistent with the rest of the app?
- S4. Participant Competition group tabs should be a query param, so Back returns to the tab you were on.
  - Less relevant now that Competitions are one list on one page, but many Competitions could get buried in that layout.
- S5. The "What it does" images on `/about` are too small to read; adjust the layout and use bigger images.
  - Same for "An Organizer gives Discretionary points and the home Standings reorder, on the spot." That three-phone image could go entirely.
- S6. "A later Match already used this result. Change that Match first." shown in every bracket in the admin view is more obnoxious than helpful.
- S7. Day, start time and end time are not vertically aligned on the "Add schedule item" form.
- S8. The Schedule item's free-text Host is redundant when a Competition is selected (it has Hosts). Even without a Competition, the Host should be a Participant, not free text.
- S9. Start time on a Schedule item should be optional, but required when an end time is set.
- S10. Selecting a Competition for a Schedule item should make its category Competition.
- S11. The Competition select on a Schedule item should only show when the type is Competition.
- S12. Smaller Brackets don't need to start at the far left; center Brackets narrower than the space.
- S13. Head-to-head needs a different participation selector, since it is always exactly two Participants.
- S14. Announcements have no create modal like the rest of admin.
- S15. "Create next War Week" sits oddly in the same settings form as the current War Week's settings.
- S16. Copying settings from one War Week to the next isn't needed; cut it.

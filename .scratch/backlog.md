# Open backlog

Every open item across `.scratch/`, in one place. Each ticket file stays the
source of truth for its own status and details; update this list when a
ticket opens or closes. Last reviewed 2026-10-04.

## Paul's manual steps

- [ ] **Regression pass**: Competition setup done 2026-10-03 (→ R15–R19, done); the **Host role** is still untested, best run after R22 changes Hosts. [`regression-2026-09/issues/18`](./regression-2026-09/issues/18-regression-pass.md) (`needs-triage`)

## Ready for an agent

Regression feedback "10/3", grilled 2026-10-04 ([grilling record](./regression-2026-10/grilling-2026-10-04.md)). One work package per spec; both change the schema and are red-teamed.

- [ ] **Epic R22, People and admin**: Hosts are roster Participants (no email needed, not copied to the next War Week), Hosts see only their Competitions and the guide, one name-only `ParticipantPicker` with avatars (closes 108), the Team shows in team events (absorbs 83), Award presets replace Categories, no Bracket Finale, `/about` stills in XII. Red-team pass 1 resolved; next up. [`people-and-admin/spec.md`](./people-and-admin/spec.md) (`ready-for-agent`)
- [ ] **Epic R23, League (round robin and Swiss)**: a new Format for chess-style tournaments, with draws, 1 / ½ / 0, tiebreaks and Swiss pairing. [`league/spec.md`](./league/spec.md) (`ready-for-agent`)

Done: Epics R9–R14 (`regression-2026-09`, PRs through #122); Epics R15–R19 (`regression-2026-10`, PRs #124–#131); Epic R20 (`competition-results`, PR #133); Epic R21 (`competition-setup`, PR #135, absorbed backlog 25). All merged into `staging`.

## Ready, waiting on someone else

- [ ] **Post new Announcements to Slack**: fully specified, ships dormant; switching it on needs IT to create an incoming webhook. Ranks first for "a twist of fun" if the webhook arrives by January 2027. [`war-weeker/issues/15`](./war-weeker/issues/15-slack-integration.md) (`ready-for-agent`)

## Needs a decision, info or grilling before a plan

- [ ] **Roster admin at 100 Participants**: one long list, no search, actions below the last row. [`regression-2026-10/issues/109`](./regression-2026-10/issues/109-roster-at-a-hundred.md) (`needs-triage`)
- [ ] **Bracket admin at 64 Entrants**: every Entrant listed three times before the tree. [`regression-2026-10/issues/110`](./regression-2026-10/issues/110-bracket-admin-at-sixty-four.md) (`needs-triage`)
- [ ] **Bracket tree at 64 Entrants**: narrow on desktop, 4,700 px tall, no jump to your Heat. [`regression-2026-10/issues/111`](./regression-2026-10/issues/111-bracket-tree-at-sixty-four.md) (`needs-triage`)
- [ ] **Admin bottom bar with a wide font**: "More" clipped at 390 in XI's monospace preset. [`regression-2026-10/issues/112`](./regression-2026-10/issues/112-admin-bottom-bar-wide-font.md) (`needs-triage`)
- [ ] **Finale Standings with many scorers**: rows below the screen never show; the countdown runs a second a row. [`regression-2026-10/issues/113`](./regression-2026-10/issues/113-finale-standings-at-scale.md) (`needs-triage`)
- [ ] **Move to Jahnel Group ownership**: GitHub, Vercel, Neon, the GCP OAuth project, the domain and any other secret or bill; who owns and pays for each, cutover order, whether Paul keeps admin. [`hardening/issues/20`](./hardening/issues/20-transfer-to-jahnel-group-ownership.md) (`needs-triage`)
- [ ] **Stairs integration**: wayfinder map charted; mirror Stairs climbs so Hosts can score a stair Competition without re-typing. Work the frontier tickets. [`stairs/map`](./stairs/map.md)
- [ ] **Beytopia integration**: read beyblade rip results instead of re-entering them; needs owner, access and an API or export. [`beytopia/issues/01`](./beytopia/issues/01-beytopia-integration.md) (`needs-info`)
- [ ] **"A twist of fun" for War Week XII**: grill a small set of engagement features; candidates are the Slack, portraits and AI-theme tickets. [`hardening/issues/17`](./hardening/issues/17-grill-a-twist-of-fun.md) (`needs-triage`)
- [ ] **Themed Participant portraits and bios**: photo source, image model and cost, storage, bios, moderation. [`war-weeker/issues/19`](./war-weeker/issues/19-themed-portraits-and-bios.md) (`needs-info`)
- [ ] **AI-generated Appearance Theme**: needs a named Organizer need, model/cost and contrast validation. [`regression-2026-09/issues/14`](./regression-2026-09/issues/14-ai-generated-appearance-theme.md) (`needs-triage`)
- [ ] **A person across War Weeks**: identity rule (email from XII, names before), what the history page shows, who sees it. [`regression-2026-09/issues/20`](./regression-2026-09/issues/20-people-across-war-weeks.md) (`needs-triage`)

- [ ] **View as another person**: an Organizer sees the app as a Participant or Host, read-only; dropped from R10 (Test sign-in covers testing). Revisit if Organizers need to debug a real person's view in production. [`regression-2026-09/issues/63`](./regression-2026-09/issues/63-view-as.md) (`needs-triage`)
- [ ] **Sign in with LTI and InfoLink emails**: waiting on the domains; auth change. [`regression-2026-09/issues/75`](./regression-2026-09/issues/75-sign-in-lti-and-infolink.md) (`needs-info`)
- [ ] **Billable hours from Tense**: owner, API access, visibility of hours. [`regression-2026-09/issues/76`](./regression-2026-09/issues/76-tense-billable-hours.md) (`needs-info`)
- [ ] **Your War Week, on your phone**: personal recap after R13. [`regression-2026-09/issues/77`](./regression-2026-09/issues/77-personal-war-week-wrapped.md) (`needs-triage`)

- [ ] **About page Finale sizzle video**: low priority; needs where Paul's journeys-app version lives. [`regression-2026-10/issues/107`](./regression-2026-10/issues/107-about-finale-video.md) (`needs-info`)

# Open backlog

Every open item across `.scratch/`, in one place. Each ticket file stays the
source of truth for its own status and details; update this list when a
ticket opens or closes. Last reviewed 2026-10-06.

## Paul's manual steps

- [x] **Final regression pass**: done 2026-10-06 (Host role included), grilled the same day into R25 and R26 below. [`regression-2026-09/issues/18`](./regression-2026-09/issues/18-regression-pass.md)

## Ready for an agent

Regression feedback "10/3", grilled 2026-10-04 ([grilling record](./regression-2026-10/grilling-2026-10-04.md)), the scale-pass findings 109–113 (R24, grilled 2026-10-04 in session), and the final regression pass (R25, R26, [grilling record](./regression-2026-10/grilling-2026-10-06.md)). One work package per spec; R22, R23 and R25 change the schema and are red-teamed; R24 and R26 do not.

- [x] **Epic R22, People and admin**: Hosts are roster Participants (no email needed, not copied to the next War Week), Hosts see only their Competitions and the guide, one name-only `ParticipantPicker` with avatars (closes 108), the Team shows in team events (absorbs 83), Award presets replace Categories, no Bracket Finale, `/about` stills in XII. Delivered: [PR #138](https://github.com/paul-macfarlane/jg-war-week/pull/138) into `staging`. [`people-and-admin/spec.md`](./people-and-admin/spec.md) (`done`)
- [x] **Epic R23, League (round robin and Swiss)**: a new Format for chess-style tournaments, with draws, 1 / ½ / 0, tiebreaks and Swiss pairing; Close now waits for a finished League or Head-to-head series. Delivered: [PR #139](https://github.com/paul-macfarlane/jg-war-week/pull/139) into `staging`. [`league/spec.md`](./league/spec.md) (`done`)
- [x] **Epic R24, War Week at full size**: Roster search and actions on top, a shorter Bracket admin page, a full-width Bracket tree with "Jump to your Match", short bottom-bar labels in the sans font, and a top-10 Finale Standings countdown. No schema change. Absorbs 109–113. Delivered: [PR #140](https://github.com/paul-macfarlane/jg-war-week/pull/140) into `staging` (see [`scale/execution.md`](./scale/execution.md)). [`scale/spec.md`](./scale/spec.md) (`done`)
- [ ] **Epic R25, Schedule items**: Hosts are roster Participants (several, display only), start time optional ("Any time"), the Competition field only in the Competition category, aligned Day / Start / End. Schema change, red-team required. [`schedule-items/spec.md`](./schedule-items/spec.md) (`ready-for-agent`)
- [x] **Epic R26, Cuts and admin consistency**: remove the MCP and `llms.txt`, Create next War Week copies nothing and moves to Lifecycle (latest War Week `complete` only), one create/edit rule (Announcements in a dialog), Entrants autosave, Head-to-head "A vs B", the participation checkbox bug, lock icons on Bracket Matches, centered small Brackets, `?group=` tabs, readable `/about` stills. No schema change. [`cuts-and-consistency/spec.md`](./cuts-and-consistency/spec.md) (`done`)

Done: Epics R9–R14 (`regression-2026-09`, PRs through #122); Epics R15–R19 (`regression-2026-10`, PRs #124–#131); Epic R20 (`competition-results`, PR #133); Epic R21 (`competition-setup`, PR #135, absorbed backlog 25). All merged into `staging`.

## Ready, waiting on someone else

- [ ] **Post new Announcements to Slack**: fully specified, ships dormant; switching it on needs IT to create an incoming webhook. Ranks first for "a twist of fun" if the webhook arrives by January 2027. [`war-weeker/issues/15`](./war-weeker/issues/15-slack-integration.md) (`in-progress`)

## Needs a decision, info or grilling before a plan

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

# Open backlog

Every open item across `.scratch/`, in one place. Each ticket file stays the
source of truth for its own status and details; update this list when a
ticket opens or closes. Last reviewed 2026-09-30 (Paul plans to work through
it the week of 2026-10-05).

## Paul's manual steps

- [ ] **Regression pass**: walk the app end to end, especially creating and running Competitions; record findings as new tickets. [`regression-2026-09/issues/18`](./regression-2026-09/issues/18-regression-pass.md) (`needs-triage`)

## Ready for an agent

- [ ] **Admin on a phone**: one-row admin header and bottom section bar, setup rows in a Sheet, lists that fit, Save in reach, 44px controls, touch-friendly pickers, seed warning trimmed, pinned card fitted, four Bracket bugs. Tickets 30-38, one `/atlas-implement` run. [`regression-2026-09/epics/R5`](./regression-2026-09/epics/R5-admin-on-a-phone.md) (`ready-for-agent`)

## Ready, waiting on someone else

- [ ] **Post new Announcements to Slack**: fully specified, ships dormant; switching it on needs IT to create an incoming webhook. Ranks first for "a twist of fun" if the webhook arrives by January 2027. [`war-weeker/issues/15`](./war-weeker/issues/15-slack-integration.md) (`ready-for-agent`)

## Needs a decision, info or grilling before a plan

- [ ] **Move to Jahnel Group ownership**: GitHub, Vercel, Neon, the GCP OAuth project, the domain and any other secret or bill; who owns and pays for each, cutover order, whether Paul keeps admin. [`hardening/issues/20`](./hardening/issues/20-transfer-to-jahnel-group-ownership.md) (`needs-triage`)
- [ ] **Stairs integration**: wayfinder map charted; mirror Stairs climbs so Hosts can score a stair Competition without re-typing. Work the frontier tickets. [`stairs/map`](./stairs/map.md)
- [ ] **Beytopia integration**: read beyblade rip results instead of re-entering them; needs owner, access and an API or export. [`beytopia/issues/01`](./beytopia/issues/01-beytopia-integration.md) (`needs-info`)
- [ ] **"A twist of fun" for War Week XII**: grill a small set of engagement features; candidates are the Slack, portraits and AI-theme tickets. [`hardening/issues/17`](./hardening/issues/17-grill-a-twist-of-fun.md) (`needs-triage`)
- [ ] **Themed Participant portraits and bios**: photo source, image model and cost, storage, bios, moderation. [`war-weeker/issues/19`](./war-weeker/issues/19-themed-portraits-and-bios.md) (`needs-info`)
- [ ] **AI-generated Appearance Theme**: needs a named Organizer need, model/cost and contrast validation. [`regression-2026-09/issues/14`](./regression-2026-09/issues/14-ai-generated-appearance-theme.md) (`needs-triage`)
- [ ] **A person across War Weeks**: identity rule (email from XII, names before), what the history page shows, who sees it. [`regression-2026-09/issues/20`](./regression-2026-09/issues/20-people-across-war-weeks.md) (`needs-triage`)

## Deferred on purpose

- [ ] **Rename `finalized_at` / `generated_by_bracket`**: internal naming; do it alongside the next red-teamed schema change. [`regression-2026-09/issues/25`](./regression-2026-09/issues/25-rename-finalized-generated-columns.md) (`needs-triage`)

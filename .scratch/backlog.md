# Open backlog

Every open item across `.scratch/`, in one place. Each ticket file stays the
source of truth for its own status and details; update this list when a
ticket opens or closes. Last reviewed 2026-09-30 (Paul plans to work through
it the week of 2026-10-05).

## Paul's manual steps

- [ ] **Regression pass**: walk the app end to end, especially creating and running Competitions; record findings as new tickets. [`regression-2026-09/issues/18`](./regression-2026-09/issues/18-regression-pass.md) (`needs-triage`)
- [ ] **Production baseline leftovers**: PWA install on a real phone; decide on past-year Slack links pointing at the workspace root; send `/privacy` and `/terms` for review or record that none is needed. [`hardening/issues/01`](./hardening/issues/01-production-baseline-checklist.md) (`ready-for-human`)
- [ ] **Actions on Node 24 / Ubuntu 26.04**: PR #98 merged; confirm Migrate passed on `staging` and the next Seed run passes, then set the ticket `done`. [`regression-2026-09/issues/28`](./regression-2026-09/issues/28-actions-node24-ubuntu-2604.md) (`in-progress`)
- [ ] **War Week XII seed**: after PR #100 merges, run the Seed workflow with `xii.json` (no `confirm_reset`) on staging, then production. `/` then opens XII's upcoming page. [`regression-2026-09/issues/29`](./regression-2026-09/issues/29-war-week-xii-tentative-seed.md) (lands with PR #100)

## Ready, waiting on someone else

- [ ] **Post new Announcements to Slack**: fully specified, ships dormant; switching it on needs IT to create an incoming webhook. Ranks first for "a twist of fun" if the webhook arrives by January 2027. [`war-weeker/issues/15`](./war-weeker/issues/15-slack-integration.md) (`ready-for-agent`)

## Needs a decision, info or grilling before a plan

- [ ] **Move to Jahnel Group ownership**: GitHub, Vercel, Neon, the GCP OAuth project, the domain and any other secret or bill; who owns and pays for each, cutover order, whether Paul keeps admin. [`hardening/issues/20`](./hardening/issues/20-transfer-to-jahnel-group-ownership.md) (`needs-triage`, lands with PR #100)
- [ ] **Stairs app integration**: needs the Stairs owner and access, then a named need, before any spec. Plan it with `/grill-with-docs` once those are known. [`regression-2026-09/issues/19`](./regression-2026-09/issues/19-stairs-integration.md) (`needs-info`)
- [ ] **"A twist of fun" for War Week XII**: grill a small set of engagement features; candidates are the Slack, portraits and AI-theme tickets. [`hardening/issues/17`](./hardening/issues/17-grill-a-twist-of-fun.md) (`needs-triage`)
- [ ] **Themed Participant portraits and bios**: photo source, image model and cost, storage, bios, moderation. [`war-weeker/issues/19`](./war-weeker/issues/19-themed-portraits-and-bios.md) (`needs-info`)
- [ ] **AI-generated Appearance Theme**: needs a named Organizer need, model/cost and contrast validation. [`regression-2026-09/issues/14`](./regression-2026-09/issues/14-ai-generated-appearance-theme.md) (`needs-triage`)
- [ ] **A person across War Weeks**: identity rule (email from XII, names before), what the history page shows, who sees it. [`regression-2026-09/issues/20`](./regression-2026-09/issues/20-people-across-war-weeks.md) (`needs-triage`)

## Deferred on purpose

- [ ] **Rename `finalized_at` / `generated_by_bracket`**: internal naming; do it alongside the next red-teamed schema change. [`regression-2026-09/issues/25`](./regression-2026-09/issues/25-rename-finalized-generated-columns.md) (`needs-triage`)

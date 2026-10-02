# Open backlog

Every open item across `.scratch/`, in one place. Each ticket file stays the
source of truth for its own status and details; update this list when a
ticket opens or closes. Last reviewed 2026-10-01 (Paul plans to work through
it the week of 2026-10-05).

## Paul's manual steps

- [ ] **Regression pass**: walk the app end to end, especially creating and running Competitions; record findings as new tickets. [`regression-2026-09/issues/18`](./regression-2026-09/issues/18-regression-pass.md) (`needs-triage`)

## Ready for an agent

October regression feedback, grilled 2026-10-01 ([`regression-2026-09/grilling-2026-10-01.md`](./regression-2026-09/grilling-2026-10-01.md)). Run in order; R10 onward change the schema and are red-teamed.

- [ ] **Epic R9, navigation**: Competitions in the main nav (54), avatar account menu (55), Home's Recent results (56), flat admin nav (57), one Edit/Delete pattern (58), Settings autosave (59). [`regression-2026-09/epics/R9`](./regression-2026-09/epics/R9-navigation.md) (`ready-for-agent`)
- [ ] **Epic R10, accounts and testing**: Profile name and picture URL (60), delete my account (61), staging Test sign-in (62). Delivered on `feat/regression-r10-accounts` (PR into `staging`); needs `TEST_SIGN_IN_SECRET` on staging and the staging checks. [`regression-2026-09/epics/R10`](./regression-2026-09/epics/R10-accounts-and-testing.md) (`done`)
- [ ] **Epic R11, content**: journeys editor parity, images by URL (64), videos only in the post (65), Day description (66), roster import (67), Unstart (68). After R10. [`regression-2026-09/epics/R11`](./regression-2026-09/epics/R11-content.md) (`done`)
- [ ] **Epic R12, Participation and Award Categories**: Participation Format (69), Award Categories (70), a Category through the years (71). After R11. [`regression-2026-09/epics/R12`](./regression-2026-09/epics/R12-competitions-and-awards.md) (`done`)
- [ ] **Epic R13, Finale slides**: slideshow framework (72), built-in slides (73), custom slides (74). After R12. [`regression-2026-09/epics/R13`](./regression-2026-09/epics/R13-finale-slides.md) (`ready-for-agent`)

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

- [ ] **View as another person**: an Organizer sees the app as a Participant or Host, read-only; dropped from R10 (Test sign-in covers testing). Revisit if Organizers need to debug a real person's view in production. [`regression-2026-09/issues/63`](./regression-2026-09/issues/63-view-as.md) (`needs-triage`)
- [ ] **Show the Team in team events**: in a teams War Week, every Competition and scoring surface shows a Participant's Team (name where there's room, else the Team color, which a Profile picture hides); audit and fix. [`regression-2026-09/issues/83`](./regression-2026-09/issues/83-show-the-team-in-team-events.md) (`needs-triage`)
- [ ] **Sign in with LTI and InfoLink emails**: waiting on the domains; auth change. [`regression-2026-09/issues/75`](./regression-2026-09/issues/75-sign-in-lti-and-infolink.md) (`needs-info`)
- [ ] **Billable hours from Tense**: owner, API access, visibility of hours. [`regression-2026-09/issues/76`](./regression-2026-09/issues/76-tense-billable-hours.md) (`needs-info`)
- [ ] **Your War Week, on your phone**: personal recap after R13. [`regression-2026-09/issues/77`](./regression-2026-09/issues/77-personal-war-week-wrapped.md) (`needs-triage`)
- [ ] **Admin refusal page wears the War Week**: the "Organizers and Hosts only" page renders outside the themed root (from the R8 checklist run). [`regression-2026-09/issues/78`](./regression-2026-09/issues/78-admin-refusal-wears-war-week.md) (`needs-triage`)
- [ ] **Points Entry form first on a phone**: the Brackets and Games lists push "Add a Points Entry" below the fold at 390. [`regression-2026-09/issues/79`](./regression-2026-09/issues/79-points-entry-form-first-on-phone.md) (`needs-triage`)
- [ ] **Home banner placeholder repeats the name**: the no-banner placeholder repeats the War Week name above the fold. [`regression-2026-09/issues/80`](./regression-2026-09/issues/80-home-banner-placeholder-repeats-name.md) (`needs-triage`)
- [ ] **Guide promises a Team You highlight**: Team standings rows are never highlighted as You. [`regression-2026-09/issues/81`](./regression-2026-09/issues/81-guide-team-you-highlight.md) (`needs-triage`)
- [ ] **Competition Group tabs cut off on a phone**: the third Group tab is off screen at 390. [`regression-2026-09/issues/82`](./regression-2026-09/issues/82-competition-group-tabs-cut-off-on-phone.md) (`needs-triage`)

## Deferred on purpose

- [ ] **Rename `finalized_at` / `generated_by_bracket`**: internal naming; do it alongside the next red-teamed schema change. [`regression-2026-09/issues/25`](./regression-2026-09/issues/25-rename-finalized-generated-columns.md) (`needs-triage`)

# Open backlog

Every open item across `.scratch/`, in one place. Each ticket file stays the
source of truth for its own status and details; update this list when a
ticket opens or closes. Last reviewed 2026-10-01 (Paul plans to work through
it the week of 2026-10-05).

## Paul's manual steps

- [ ] **Regression pass**: walk the app end to end, especially creating and running Competitions; record findings as new tickets. [`regression-2026-09/issues/18`](./regression-2026-09/issues/18-regression-pass.md) (`needs-triage`)

## Ready for an agent

October regression feedback, grilled 2026-10-01 ([`regression-2026-09/grilling-2026-10-01.md`](./regression-2026-09/grilling-2026-10-01.md)). Run in order; R10 onward change the schema and are red-teamed.

- [ ] **Epic R8, quick fixes**: "Announcements" everywhere (46), Posted by name (47), free-for-all hides Team settings (48), taken Day dates greyed out (49), date range picker waits for Done (50), sheets on phones only (51), remove "Which one is you?" (52), first run of the User Pages and Admin checklist (53). [`regression-2026-09/epics/R8`](./regression-2026-09/epics/R8-quick-fixes.md) (`ready-for-agent`)
- [ ] **Epic R9, navigation**: Competitions in the main nav (54), avatar account menu (55), Home's Recent results (56), flat admin nav (57), one Edit/Delete pattern (58), Settings autosave (59). After R8. [`regression-2026-09/epics/R9`](./regression-2026-09/epics/R9-navigation.md) (`ready-for-agent`)
- [ ] **Epic R10, accounts and testing**: Profile name and picture (60), delete my account (61), staging Test sign-in (62), View as (63). After R9; needs a Blob store and `TEST_SIGN_IN_SECRET` on staging. [`regression-2026-09/epics/R10`](./regression-2026-09/epics/R10-accounts-and-testing.md) (`ready-for-agent`)
- [ ] **Epic R11, content**: journeys editor parity with image upload (64), videos only in the post (65), Day description (66), roster import (67), Unstart (68). After R10. [`regression-2026-09/epics/R11`](./regression-2026-09/epics/R11-content.md) (`ready-for-agent`)
- [ ] **Epic R12, Participation and Award Categories**: Participation Format (69), Award Categories (70), a Category through the years (71). After R11. [`regression-2026-09/epics/R12`](./regression-2026-09/epics/R12-competitions-and-awards.md) (`ready-for-agent`)
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

- [ ] **Sign in with LTI and InfoLink emails**: waiting on the domains; auth change. [`regression-2026-09/issues/75`](./regression-2026-09/issues/75-sign-in-lti-and-infolink.md) (`needs-info`)
- [ ] **Billable hours from Tense**: owner, API access, visibility of hours. [`regression-2026-09/issues/76`](./regression-2026-09/issues/76-tense-billable-hours.md) (`needs-info`)
- [ ] **Your War Week, on your phone**: personal recap after R13. [`regression-2026-09/issues/77`](./regression-2026-09/issues/77-personal-war-week-wrapped.md) (`needs-triage`)

## Deferred on purpose

- [ ] **Rename `finalized_at` / `generated_by_bracket`**: internal naming; do it alongside the next red-teamed schema change. [`regression-2026-09/issues/25`](./regression-2026-09/issues/25-rename-finalized-generated-columns.md) (`needs-triage`)

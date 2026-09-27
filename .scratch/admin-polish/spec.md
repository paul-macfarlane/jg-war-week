---
title: War Weeker — Admin polish (round 3 feedback)
status: done
labels: [done]
created: 2026-09-24
source: Paul's first-use feedback and grilling session, 2026-09-24 (Q1–Q9, Q20)
order: 1 of 3 (then .scratch/custom-inputs, then .scratch/brackets)
---

# Admin polish

## Problem Statement

Paul used War Weeker end to end for the first time and found rough edges:

- The About page leads with a data loss he doesn't want highlighted. It says "Jahnel Group · since 2016" when JG is older than War Week, and it's written in the first person.
- It sends people to `/install`, which bounces them to sign-in, and it uses the internal term "Appearance Theme".
- The admin's "View public site" link and "on the public site" copy are wrong: every page needs a JG sign-in.
- Schedule Items have no "Other" category.
- Four admin inputs are free text where they should be structured:
  - Competition Group
  - Company Tag
  - Organizer emails
  - Placement Points
- There's no guide for a first-time Organizer.
- There's no privacy policy or terms of service, so the Google OAuth consent screen can't link to them.

## Solution

A set of small, independent fixes, each shippable alone before the 8 AM freeze:

1. About page copy fixes.
2. Admin wording that no longer says "public".
3. A new `other` Schedule Item category.
4. Structured inputs, built from shadcn components (repo rule from now on; see `.scratch/custom-inputs/spec.md`):
   - Competition Group and Company Tag suggestion comboboxes
   - Organizer email chips
   - Placement Points rows
5. An in-app Organizer guide at `/admin/guide`.
6. Public `/privacy` and `/terms` pages, linked from sign-in, the About page and the footer, and ready to paste into the Google OAuth consent screen along with `public/icons/icon-512.png` as the app logo.

## User Stories

### About page
1. As a visitor, I want the eyebrow to read "Jahnel Group War Week · since 2016", so that it doesn't imply JG started in 2016.
2. As a visitor, I want "Why it exists" to explain the real problems without dwelling on lost data:
   - The "The points are gone" card is replaced by one that briefly says Competiscore was an earlier attempt, too generalized for War Week (a generic league platform). No mention of data loss.
   - The "Why we built this" copy loses the data-loss sentence too.
3. As a visitor, I want plain words about installing: "Once you're signed in, **More → Install app** puts it on your home screen, and every War Week keeps its own colors and logo." No link to `/install`, and no "Appearance Theme".
4. As a visitor, I want the closing section titled "Why we built this", written as "we", with the byline "Jahnel Group" instead of a person.

### Admin wording
5. As an Organizer, I want the admin header link to say "Back to War Week <EDITION>" (e.g. "Back to War Week XI"), so that I'm not told the site is public.
6. As an Organizer, I want status copy to say "visible to Participants" / "hidden from Participants" instead of "on the public site" (`/admin`, `/admin/standings`, `/admin/points`).

### Schedule
7. As an Organizer, I want an **Other** category for Schedule Items that aren't a competition, education, social, meal or work item. It shows with neutral styling wherever categories appear.

### Structured inputs
8. As an Organizer creating a Competition, I want the Competition Group field to suggest groups already used in this War Week, pick one with a tap, or type a new one.
9. As an Organizer editing the roster, I want the Company Tag field to suggest tags used in any War Week (LTI, IL, …), pick one, or type a new one.
10. As an Organizer, I want Organizer emails shown as chips:
    - Enter, comma or pasting a list adds them.
    - × removes one.
    - Each is checked as an `@jahnelgroup.com` address when added, with an inline error.
    - My own chip can't be removed (existing rule; the × is disabled with a tooltip).
11. As an Organizer, I want Placement Points as numbered rows:
    - "1st / 2nd / 3rd …", with add and remove-last buttons, up to 5 rows.
    - A **5 · 3 · 1** quick-fill button.
    - Live errors when values increase, are negative, or 1st exceeds max points.

### Organizer guide
12. As a first-time Organizer, I want `/admin/guide`, linked from the admin nav, that walks me through running a War Week. Sections:
    - First-time setup order: War Week settings → Days → Teams & roster → Competitions → Schedule → FAQ
    - Adding Organizers (the Organizer emails list; anyone on it gets admin on their next sign-in; there are no other roles)
    - What a Participant email does (account linking for the "You" highlight; optional)
    - Discretionary points (make a "Spirit / Discretionary" Competition and add Points Entries with a note; going over max points only warns)
    - Placement Points
    - Hiding Standings and running the Reveal
    - Announcements and Slack
    - The seed warning (reloading a seed overwrites UI edits)

### Privacy policy and terms of service
13. As anyone, including someone who isn't signed in, I can read `/privacy`, which states in plain language what War Weeker stores and why:
    - from Google sign-in: name, email and profile image, plus the session
    - roster data Organizers enter: display name, Company Tag, optional email
    - who entered Points Entries and Announcements (their email)
    - nothing sold or shared, beyond the hosting and database providers and the optional Slack posts
    - how long data is kept (War Week history is kept indefinitely)
    - who to contact to ask for a correction or removal
14. As anyone, I can read `/terms`: an internal Jahnel Group tool, for JG employees only, provided as is, with acceptable use (no offensive content in Announcements or Squad names), and JG can change or remove content.
15. As a visitor, I see "Privacy" and "Terms" links on `/sign-in`, `/about` and the site footer.

## Implementation Decisions

- **shadcn from now on.** Add the base-nova (Base UI) components these inputs need with the shadcn CLI: `input`, `badge`, `combobox` (or `popover` + `command`), and anything they depend on. Don't hand-roll a control that shadcn has. Leave the existing native controls for spec 2 to convert.
- **About:** only `src/app/about/page.tsx` copy, `src/lib/about.ts` if it repeats the text, and `src/app/about/page.test.tsx`, which currently asserts "Why I built this" and "Competiscore". Update those assertions to the new copy. Competiscore may still be named once. `/about` stays static and never reads the database or session (access rule).
- **`other` category:** add `other` to the `schedule_item_category` pgEnum with a Drizzle migration, and to the seed zod schema and the Schedule Item form options. No seed needs it, but a test fixture should prove it validates. This changes the Drizzle schema, so planning policy requires a red-team review and a smoke test on seeded local Postgres. The change only adds an enum value; no data moves.
- **Suggestions:**
  - Group suggestions come from distinct non-null `competition.competition_group` in the current War Week.
  - Tag suggestions come from distinct non-null `participant.company_tag` across all War Weeks, sorted by name.
  - Both are loaded server-side on the setup page, never exposing emails.
  - Free text is still accepted, and the server validation is unchanged.
- **Chips and Placement rows** only change the client form. Each still submits the same shape the existing server actions validate, so the server-side rules stay the one source of truth: the email domain, "can't remove yourself", placement ordering, ≤5 places, and ≤ max points.
- **Guide:**
  - A static server page under the admin gate (`getAdminAccess`), plain JSX, with no database reads beyond the current War Week's edition and labels (e.g. the Team Label in examples).
  - Copy follows the CONTEXT.md vocabulary and avoids banned terms.
  - Add it to the `admin-shell.tsx` nav. Don't add it to `src/mcp/llms-txt.ts`, which lists no admin pages.
- **Privacy and terms:**
  - Static server pages at `/privacy` and `/terms`. Like `/about`, they never read the database or session. Add both to `PUBLIC_PATHS` in `src/lib/access.ts` as exact paths, not prefixes.
  - This changes access control, so planning policy requires a red-team review. It must only add those two exact paths: Google-only, `@jahnelgroup.com`-only sign-in and every other gate stay as they are.
  - Update `isPublicPath` tests (including that `/privacy/x` and `/termsx` stay private), and CONTEXT.md's Access rules list of public paths.
  - Build the copy from what the code actually stores. Check `src/db/schema.ts` (the better-auth `user`/`session`/`account` tables, `participant.email`, `entered_by_email`, `author_email`) and the Slack integration. Don't guess at data the app doesn't collect.
  - Contact: don't invent an email address. Say "contact the War Week Organizers or Jahnel Group" unless Paul supplies one.
  - Each page shows a "Last updated" date.
  - This copy isn't legal review. The PR must flag both pages for Paul or JG to read before the consent screen links them.
- **Vocabulary:** no new domain terms. Update CONTEXT.md's Schedule display rules to mention `other`.

## Acceptance Criteria

- [ ] `/about` shows the new copy:
  - "Jahnel Group War Week · since 2016"
  - no "The points are gone" and no data-loss sentence
  - the brief Competiscore-was-too-generalized mention
  - no `/install` link and no "Appearance Theme"
  - "Why we built this", with the byline "Jahnel Group"
  - `page.test.tsx` asserts these
- [ ] No page under `/admin` contains "public site". The header link reads "Back to War Week XI" on the XI demo seed. Unit or smoke assertion.
- [ ] Migration adds `other`. The seed schema accepts it (unit test), the Schedule Item form offers it, and an `other` item renders on `/xi/schedule` with neutral styling (screenshot).
- [ ] Competition Group and Company Tag comboboxes suggest existing values and accept new ones. Screenshot of each open at 375px.
- [ ] Organizer email chips: add by Enter, comma and paste; reject non-JG addresses inline; your own chip can't be removed; saving round-trips. Unit tests on the parse/validate helper, plus a screenshot.
- [ ] Placement Points rows: add/remove up to 5, 5·3·1 quick-fill, inline errors for increasing, negative and over-max values; saving round-trips to the same `placement_points` array. Unit tests on the row↔array helper, plus a screenshot.
- [ ] `/admin/guide` renders for an Organizer and shows "Organizers only" for a non-Organizer. It's linked in the admin nav and covers every section in story 12.
- [ ] `/privacy` and `/terms` load without a session (smoke, anonymous, 200 status) and read no DB or session (code review / red-team). `isPublicPath` tests cover exact-match only. Every other page still redirects anonymous visitors to sign-in (existing smoke).
- [ ] The privacy page lists only data the schema and Slack integration actually handle. The red-team checks this against `src/db/schema.ts`.
- [ ] "Privacy" and "Terms" links appear on `/sign-in`, `/about` and the footer (screenshot at 375px).
- [ ] **Human-gated, Paul:** prerequisite: PR merged and deployed to production. Action: in the Google Cloud OAuth consent screen, set the app logo to `public/icons/icon-512.png`, the home page to `https://war-weeker.vercel.app/about`, the privacy policy to `/privacy` and the terms to `/terms`. Expected: the Google sign-in screen shows the War Weeker logo and name. Check: sign in at production and see them. Keep the user type **Internal** (no Google branding review).
- [ ] Every changed admin page has zero horizontal overflow at 375, 768 and 1280px (the existing overflow sweep).
- [ ] Screenshots under `test-results/<test-name>/`, committed.
- [ ] `pnpm gate` passes.

## Out of Scope

- Converting the other native selects and date/time inputs (spec 2).
- Removing hidden Standings (spec 3, ticket 1). The guide documents hiding as it works today.
- Making `/install` public.
- A managed list of companies.
- Legal review of the privacy and terms copy (Paul or JG does it after the PR).
- Switching the OAuth client to External / Google branding verification.

# Execution record: Epic R10, Accounts and testing

Contract: [`R10-accounts-and-testing.md`](./R10-accounts-and-testing.md) and its tickets
[`60`](../issues/60-profile-name-and-picture.md), [`61`](../issues/61-delete-my-account.md),
[`62`](../issues/62-staging-test-sign-in.md). Ticket [`63`](../issues/63-view-as.md) (View as) was dropped from R10 on 2026-10-02 (see [SCOPE CHANGE]).
Planned by `/atlas-plan` on 2026-10-02 against `staging` at `812bb7c`, with R9 merged.
Red-team is **required** because the plan changes the Drizzle schema and auth. Branch: `feat/regression-r10-accounts`.

## [EXECUTION PLAN]

2026-10-02. Revised after red-team round 1 (see "Red-team" at the end).

### Run record

- Work package `regression-r10`; branch `feat/regression-r10-accounts` from `staging` at `812bb7c` (R9 merged, PR #114).
- Deliverables: **D62** (wave 1), **D60a** Profile core (wave 2), **D60b** surfaces and **D61** Delete (wave 3, parallel in worktrees under `.claude/worktrees/regression-r10/war-weeker/d<id>`), **DX** docs (wave 4, feature branch). Edges: D62 → D60a → {D60b, D61} → DX.
- Isolation: waves 1, 2 and 4 run one worker at a time on the feature branch in the main checkout (no concurrency, so no worktree). Wave 3 isolates its two workers in worktrees because they run concurrently; predicted shared file: the Profile page (`src/app/[edition]/profile/page.tsx`), resolved by D61 owning a separate section component and D60b not touching the page.
- Workers run format, typecheck, lint and unit. The orchestrator runs build, smoke and e2e on the integrated branch after each wave (one Postgres, port 3200).

### Intent

The tickets ship in the epic's order:
1. **62, Test sign-in.** It makes the rest testable by hand, and covers testing as a non-admin, a Host or a linked Participant.
2. **60, Profile.**
3. **61, Delete my account.**

They share three seams:
- **One session identity.** It knows whether a session is a Test sign-in, and its session id.
- **One actor.** `getActor` stays the only "who is asking", built on the session identity.
- **One name and picture resolver.** Every Participant, author or Host name goes through it.

### Resolved decisions

#### Session identity

**D1. Session identity.** `src/auth/server.ts` gains a cached `getSessionIdentity()` returning `{ email, sessionId, testSignIn } | null`. `getSessionEmail()` wraps it.

A session counts as anonymous when:
- its email isn't a JG email; or
- it is a Test sign-in session and Test sign-in is off for this request (D2).

Three places use the same identity:
- `src/app/sign-in/page.tsx` redirects on it, not on the raw better-auth session. This avoids a redirect loop when Test sign-in is turned off.
- `src/proxy.ts` applies the same Test sign-in rule. A disabled Test sign-in session gets the sign-in redirect, and no MCP access.
- The MCP route's session check goes through the same rule.

#### Test sign-in (62)

**D2. Gate.** The rule lives in the pure module `src/lib/test-sign-in.ts`.

`testSignInEnabled(env)` is true only when both hold:
- `TEST_SIGN_IN_SECRET` is at least 32 characters;
- `VERCEL_ENV !== "production"`.

`testSignInRefusal({ env, typedSecret, email })` checks, in order:
1. Test sign-in is enabled.
2. The typed secret matches. The compare is `crypto.timingSafeEqual` over SHA-256 digests.
3. The email parses with `jgEmailSchema`: format, the 254 limit, and the JG domain. `+` aliases are allowed.

It never keys on `NODE_ENV`. Smoke and e2e run `next start`.

**D3. Route and session.** `/sign-in/test` is a page with fields for email and secret. Its server action is `testSignIn` in `src/actions/test-sign-in.ts`. The page is already public through the `/sign-in` prefix. When Test sign-in is off, the page calls `notFound()` and the action refuses; both are checked on every request.

On success the action:
- Uses `(await auth.$context).internalAdapter` to find or create the `user` by lowercase email. `databaseHooks` still enforce the domain.
  - A new user gets `name` = the local part and **`emailVerified: true`** (D5).
  - An existing user is reused unchanged.
- Creates a session with `testSignIn: true`.
- Sets the cookie with `ctx.authCookies.sessionToken.name` and its attributes, including `maxAge`.
  - The name is `__Secure-…` on https and plain on localhost.
  - The value is `token.signature`, signed like `createSmokeSession`. Next's `cookies().set` encodes it, so the action must not encode it again.
- Redirects to a safe `callbackURL`, or `/`.

The implementer confirms the 1.7.x internal-adapter calls with context7.

**D4. Marking the session.** Add the column `session.test_sign_in boolean not null default false`. It is declared as better-auth `session.additionalFields.testSignIn` with `input: false`, and lands in Drizzle and the migration together.

Kept by Paul's decision (2026-10-02): the column and the banner (D6) stay because they are cheap to maintain. The column is written only by Test sign-in and read only by `getSessionIdentity`; the banner is stateless.

**D5. Linking a later Google sign-in.** better-auth refuses to link Google to an existing user whose `emailVerified` is false (`link-account.mjs:78`). Test sign-in therefore creates users with `emailVerified: true`.

The production better-auth config is unchanged, apart from S3's `disabledPaths`. This adds no takeover path: anyone with the secret can already sign in as that address, and the gate keeps the code inert in production. ADR 0008 records the choice.

**D5a. Lock better-auth's self-service user update.** Add `disabledPaths: ["/update-user"]` to `betterAuth`. Otherwise any signed-in user could set `user.image` (which D8 now shows app-wide) to any string.

The resolver also accepts `user.image` only when it starts with `https://lh3.googleusercontent.com/`.

**D6. Banners.** `src/components/session-banner.tsx` is a server component rendered in `src/app/layout.tsx` inside `<body>`, before `{children}`. That puts it on every page.
- It shows a neutral `role="status"` strip: "Test sign-in: <email>".
- It uses root tokens, not ThemeRoot.
- Every page is already `force-dynamic`. The implementer confirms in the `pnpm build` route table that no route changed rendering mode.

#### Profile (60)

**D7. Storage.** A new `profile` table:

| Column | Type | Notes |
|---|---|---|
| `email` | `varchar(254)` primary key | lowercase check, like `organizer` |
| `name` | `varchar(120)`, nullable | the roster-name limit |
| `image_url` | `varchar(2048)`, nullable | set by the person; `https://` only |
| `updated_at` | | |

It is not columns on `user` because:
- better-auth writes `user`;
- Profiles resolve by email even for Participants who never signed in;
- deleting an account deletes the Profile explicitly (D21).

The Google photo stays in `user.image`.

**Seed policy:** no seed change. Seeds carry no accounts or Profiles. Both seed runs (with `--reset`, then plain) prove idempotence with the migration applied. That meets "update the demo seed and migration together": there is nothing in the seed to update. ADR 0007 records it.

**D8. One resolver, two forms.**

The SQL form lives in `src/queries/profile-join.ts`:
- `withProfile(query, participantTable)` left-joins:
  - `profile` on `profile.email = lower(participant.email)`;
  - `user` on `user.email = lower(participant.email)`. better-auth stores lowercase emails, so this uses the unique index and matches at most one row.
- `participantNameSql = coalesce(profile.name, participant.display_name)`.
- `participantImageSql` = `profile.image_url`, else `user.image` when it starts with `https://lh3.googleusercontent.com/`, else null (initials).

The pure TS form lives in `src/lib/profile.ts`:
- `resolveProfile({ rosterName, profileName, profileImage, googleImage })` returns `{ name, image }`. It holds the same Google-URL rule.
- `profilesByEmail(emails)` returns a lowercase-keyed map. The email-keyed callers use it: announcement author, Host names, account menu.
- Unit tests cover:
  - Profile set;
  - Profile unset;
  - no linked Participant (falls back to the handle, the email's local part);
  - case-insensitive email;
  - a non-Google `user.image` is ignored;
  - a set Profile picture URL wins over the Google photo.

**D9. Surfaces: the full list.** Each item below changes to the resolved name, and to the picture where the "pic" note says so.

Queries and libs:
- `src/queries/roster.ts`: `getRoster` (pic), and `getYouCandidates` (name, which also feeds the participant account menu).
- `src/queries/standings.ts` `getStandings` (pic), through `src/lib/standings.ts` `computeStandings`. The individual tie-break gains `id` after `name` (`standings.ts:137`).
- `src/queries/brackets.ts`:
  - `getBracketEntrants` `participantName` (pic, individual entrants);
  - `squadParticipantNames`;
  - `getSquads` `participants[].displayName`;
  - `getHeatReporters`.
- `src/queries/schedule.ts` `getTimedHeats` labels.
- `src/queries/games.ts` `getGamesView` `name` (pic), into the leaderboard, players, `bestOfWinner` and `entrantOptions`.
- `src/queries/awards.ts` `getAwards` participants (pic) and `getAwardFormOptions`.
- `src/queries/recent-results.ts` `getRecentResults` `target.name` (pic).
- `src/queries/competitions.ts` `getCompetitionWithLedger` `participantName`.
- `src/queries/points-entries.ts` `getPointsEntryFormOptions` and `getAdminLedger`.
- `src/queries/archive.ts`, through `getAwards`.
- `src/queries/announcements.ts` `loadAuthorCandidates` and `src/lib/announcements.ts` `announcementAuthorName`: Profile name, then roster name, then handle.
- `src/queries/organizers.ts` `getWarWeekCompetitionHosts`: adds resolved Host names, shown on the `competitions-editor.tsx` row details as name, else email.
- `src/queries/setup.ts` `getSetupParticipants` adds `profileName` (D14).

Pages and components:
- `src/app/[edition]/layout.tsx`: the account menu name and image.
- `src/components/admin-shell.tsx`: the admin account menu name and image, through `profilesByEmail`.
- `src/app/[edition]/awards/page.tsx`.

MCP (`src/mcp/*`):
- `get_leaderboard`, `get_awards`, `get_history`, `get_bracket` and `get_games` inherit the resolved names.
- `get_announcements` `author` becomes the resolved name.
- No email and no image URL is added to any payload.

Left as is:
- the admin roster row name, which is Organizer-typed;
- refusal and error messages that quote names (`mutations/enrollment.ts`, `mutations/brackets.ts`, `mutations/games.ts`, `mutations/setup.ts`);
- `war_week.winner`, a snapshot;
- free-text `schedule_item.host`.

**D10. Avatar picture.** `Avatar` gains `image?: string | null`.
- With an image, it renders a plain `<img>` square, `object-cover`, `alt=""` (the name sits beside it), `loading="lazy"`, falling back to initials `onError`. The file carries an `eslint-disable-next-line @next/next/no-img-element` with its reason.
- Not `next/image`: Google serves the photo already sized (the URL takes a size suffix), and plain `<img>` needs no `remotePatterns` and no optimizer fetch through `proxy.ts`. The repo already uses plain `<img>` in several places.
- Render sites that pass `image`:
  - `roster.tsx` `RosterList`;
  - `standings.tsx` `IndividualStandingsList`;
  - `recent-results.tsx` `TargetName`;
  - `games-view.tsx`;
  - `entrant-mark.tsx` `EntrantMark`, for individual entrants (its callers `bracket-view`, `bracket-tree`, `bracket-results` and `heat-result-form` pass the field through the entrant);
  - `bracket-finale.tsx` `PlaceMark`;
  - `src/app/[edition]/awards/page.tsx`;
  - `account-menu.tsx`.
- Teams and Squads keep initials.

**D11. Profile page.** The page is `/[edition]/profile`, signed-in only, opened from a new **Profile** item in the account menu. The admin menu links to the current edition's page.

The page has:
- **Profile name field.** Empty means the roster name shows; the hint reads "Shown as <roster name> until you set one".
- **Picture URL field.** Empty means the Google photo (or initials when there is none); the hint reads "Leave empty to use your Google photo". A live preview shows the Avatar twice, side by side, on the light and the dark surface (each wrapped in a `ThemeRoot` with `scheme` pinned, as the Settings form's two previews already do), labelled Light and Dark, so a transparent or dark-on-dark picture is caught before it's saved. **Use Google photo** clears it. No upload (D12).
- **Delete my account** (D21).

The action lives in `src/actions/profile.ts`: `saveProfile` (name and picture URL in one form).
- Each goes through a new `authorizeSelf(action)` → `can(actor, action)` (D17).
- Writes are keyed on `actor.email`.
- They follow the `useActionState` + zod pattern (ADR 0004), with a sonner toast on success.
- On success they call `revalidatePath("/", "layout")`.

**D12. Picture is a URL (scope change, Paul 2026-10-02).** The picture is the URL the person sets on their Profile, else the Google photo URL better-auth already stores in `user.image`, else initials. No upload, no Vercel Blob, no image store, no new dependency.

Validation (zod, in `src/lib/profile.ts`, unit-tested): optional; trimmed; at most 2048 characters; must parse as a URL with protocol `https:` (so no `http:`, `data:` or `javascript:`) and a host. The app never fetches it. The `<img>` sets `referrerPolicy="no-referrer"`. Privacy says a picture URL is loaded from its own host by everyone who sees the Avatar, so that host sees their IP address; Terms' acceptable use covers what the picture shows. Uploads (with AI-edited portraits) move to Blob storage in a later ticket when that need arrives.

`.env.example` gains a blank `TEST_SIGN_IN_SECRET`, with a comment.

**D14. Organizer roster form.** When a Participant has a `profileName`, `ParticipantForm` shows it read-only with "Set by the person". The Organizer's typed name stays saved as the fallback. The unique-name rule is unchanged.

#### Self actions

D15, D16 and D18–D20 were View as decisions and are withdrawn with ticket 63. The numbers are kept so the red-team record still reads.

**D17. `can` for self actions.** A new `SelfAction` type covers `profile.save` and `account.delete`, with its own no-target `can` overload. It returns null for any signed-in JG actor, and `SIGN_IN_REFUSAL` otherwise. The writes are keyed on `actor.email`, so a person can only ever change their own Profile or account. A unit test in `access.test.ts` covers signed in, anonymous and non-JG.

#### Delete my account (61)

**D21. Delete.** `deleteMyAccount(confirmEmail)` sits behind `ConfirmDialog`, which gains an optional typed-confirmation input: "Type your email to confirm".

1. `authorizeSelf("account.delete")`. Then `confirmEmail` must match `actor.email`, ignoring case.
2. One transaction:
   - Call `removeOrganizer(email, email, tx)` when the email is listed. It keeps the `FOR UPDATE` lock and the last-Organizer refusal in one place. Export `LAST_ORGANIZER`, or refactor `removeOrganizer` to accept a `tx`.
   - Delete `profile`, then `user`. Sessions and accounts cascade.
3. Clear the session cookie (its `authCookies` name), then redirect to `/` with a toast.

`src/mutations/account.ts` holds the mutation.

Untouched by delete: `competition_host` rows and the email audit columns. Privacy says so. The picture URL goes with the `profile` row and the Google photo URL with the `user` row.

#### Records

**D22. ADRs.**
- `0007-profiles-resolve-by-email.md`: the override by email everywhere; one resolver; no copies; the seed note; the Google-URL rule; `/update-user` disabled.
- `0008-test-sign-in.md`: the three gates and the 32-character minimum; the session column; `emailVerified: true` (D5); a disabled Test sign-in session counts as anonymous everywhere (D1); why there is no impersonation (View as dropped: Test sign-in tests real behavior as that person).

**D23. CONTEXT.md.** Add or update:
- **Profile**
- **Profile name**
- **Avatar** (picture, else initials)
- **Account menu** (+ Profile)
- **Test sign-in**

### Deliverables and waves

Migrations are generated on the feature branch one wave at a time: wave 1 (session column), then wave 2 (`profile`).

| Wave | Deliverable | Owned scope | Model |
|---|---|---|---|
| 1 | **D62 Test sign-in** | `src/auth/server.ts` (identity, `additionalFields`, `disabledPaths`); `src/proxy.ts` and the MCP session rule; session column + migration; `src/lib/test-sign-in.ts` + test; `src/app/sign-in/test/page.tsx`; `src/actions/test-sign-in.ts`; sign-in redirect; `session-banner.tsx` (Test sign-in part); root layout; `.env.example`; `playwright.config.ts` and smoke `childEnv` (S2 values); e2e helper + `e2e/test-sign-in.spec.ts`; smoke 404 checks | Opus |
| 2 | **D60 Profile core** | `profile` schema + migration; `src/lib/profile.ts` + test; `src/queries/profile-join.ts`; `src/lib/access.ts` (`SelfAction`) + test; `src/actions/profile.ts` + `authorizeSelf`; `/[edition]/profile` page and form; account menu item; `Avatar` image prop | Opus |
| 3a | **D60 surfaces** | everything listed in D9, D10 and D14; MCP; `e2e/profile.spec.ts` | Sonnet |
| 3b | **D61 Delete** (parallel) | `src/mutations/account.ts` + integration test; `organizers.ts` tx/export change; `src/actions/account.ts`; the `ConfirmDialog` typed confirm; the delete section component on the Profile page; `e2e/delete-account.spec.ts` | Sonnet |
| 4 | **DX docs** | Privacy (stored data incl. the Google photo URL, what delete removes and keeps, Hosts kept); Terms; `/about` (+ `scripts/about-media.ts` if the stills show the account menu); `docs/maintainers-guide.md` (secret generated with `openssl rand -base64 32`, Preview vs Production, the rollout order); `docs/regression-checklist.md` (Accounts setup switches to Test sign-in; Profile and Delete my account lines); `CONTEXT.md`; ADRs; closeouts | Sonnet |

**Collisions:**
- Wave 2 owns `access.ts` and the account menu.
- 3b adds a section component that 3a never touches.

**Gates and the orchestrator:**
- Workers run format, typecheck, lint and unit.
- The orchestrator runs build, smoke, e2e and about-media on the integrated branch after each wave. They share Postgres and port 3200.

**Rollout (S9).** The migrations are additive. Vercel deploys on push, and `migrate.yml` runs separately. Until `session.test_sign_in` exists, `getSession` fails site-wide.

So, on staging and again on promotion to `main`:
- confirm the Migrate job succeeded before checking the deploy;
- if the deploy goes live first, re-run Migrate;
- rolling back on Vercel is safe, because the extra column and table are unused by old code.

The maintainers' guide records this.

### Fixtures and accounts

- Seeds reload with `--reset` in e2e global setup.
- **Smoke `childEnv`** sets `TEST_SIGN_IN_SECRET: ""` and `VERCEL_ENV: ""`.
- **The `playwright.config.ts` webServer env** sets:
  - `TEST_SIGN_IN_SECRET` to a 40-character non-secret test value recorded in the config;
  - `VERCEL_ENV: ""`.

  Explicit blanks win over `.env.local`.
- **Test sign-in e2e:** a new helper `withParticipantEmail(edition, participant, "e2e+linked@jahnelgroup.com")` sets a seeded Participant's email and restores it afterward.
- **Cleanup:** `deleteE2eUsers` also removes `user`, `organizer` and `profile` rows for an exact list of `e2e+…` emails. The list avoids the `_` and `%` wildcards in `LIKE`.
- **Profile e2e:** the stub user's `user.image` is set to a fixed `https://lh3.googleusercontent.com/…` test URL, then the Participant sets a Profile picture URL `https://images.example.test/me.png`; the e2e routes both hosts to local PNGs (`page.route`), so no network call leaves the machine. Asserts the Google photo first, then the set URL, then Use Google photo restores it. Asserts both the Light and the Dark preview render the set URL, with a screenshot of the preview while the page is in each Display.
- **Delete e2e:** a stub Participant with a Profile name.

### Verification map

- **Run surface:** local, meaning the production build plus local Postgres. Staging and production deploys are used only for the human-gated rows.
- **Evidence:** saved under `test-results/` (cleared at the start of the work package) and committed.
- **Gate:** every gate row runs `set -a; . ./.env.example; set +a; pnpm format:check && pnpm gate`.

| Criterion | Command / action | Expected | Evidence | Earliest | Invalidated by |
|---|---|---|---|---|---|
| 62-AC1 refusals | `pnpm test src/lib/test-sign-in.test.ts` | refused for each case: secret unset, short, or wrong; `VERCEL_ENV=production`; a non-JG email; a malformed email. A JG `+` alias is allowed | vitest | W1 | the gate module |
| 62-AC1 runtime gate | smoke: server with no secret → `/sign-in/test` 404 and action refused. A unit test of the page/action guard with the secret set and `VERCEL_ENV=production` → `notFound` and a refusal | as stated | smoke output; vitest | W1 | gate, smoke env |
| 62-AC2 e2e linked You + banner | `pnpm e2e e2e/test-sign-in.spec.ts` | the Participant is shown as You; the banner shows on `/xii` and `/history`; screenshots at 390 and 1440 | e2e; `r10-accounts/test-sign-in-*` | W1 | identity, banner |
| 62 disabled session | e2e or unit: identity with `testSignIn` while gated off → anonymous; `/sign-in` does not loop | no loop | vitest / e2e | W1 | D1 |
| 62-AC3a staging (human) | Prereq: Paul sets a ≥32-character `TEST_SIGN_IN_SECRET` on the environment the staging deploy uses. Action: Paul signs in as `paul+participant@jahnelgroup.com`. Post-check: Paul's screenshot committed under `test-results/r10-accounts/staging-test-sign-in.png`; the agent confirms `/sign-in/test` returns 200 on staging | signed in, banner shown | the screenshot, curl output and the SHA in the closeout | after the staging deploy | env, gate |
| 62-AC3b production 404 | after the `staging`→`main` promotion deploys: `curl -sI https://<prod>/sign-in/test` | 404, with the prod deploy SHA containing this code | curl + SHA | **BLOCKED until promotion** | env, gate |
| 60 self actions | `pnpm test src/lib/access.test.ts` | `profile.save` and `account.delete` allowed when signed in, refused when anonymous or non-JG | vitest | W2 | `access.ts` |
| 60-AC1 resolver | `pnpm test src/lib/profile.test.ts` | the resolver cases and the URL validation (https only, length, no `data:`/`javascript:`) pass | vitest | W2 | profile module |
| 60-AC2 e2e | `pnpm e2e e2e/profile.spec.ts` | the name and `<img>` show on `/xii/leaderboard`, `/xii/teams` and a `games` Competition page; the admin form shows "Set by the person" | e2e; `r10-accounts/profile-*` | W3a | resolver, surfaces |
| 60-AC3 (scope change: no upload) real Google photo on staging (human) | Prereq: the staging deploy with this code. Action: Paul signs in with Google on staging. Post-check: Paul's screenshot of the account menu and Standings committed under `test-results/r10-accounts/staging-google-photo.png` | the Google photo renders in the menu and on his Participant row | screenshot + SHA | after the staging deploy | resolver, Avatar |
| 60-AC4 seeds twice | `pnpm smoke` | both runs pass; the `profile` lowercase check holds | smoke | W2 | schema |
| 60 MCP | unit tests on the payload builders + smoke `get_leaderboard` and `get_announcements` | resolved names; no `@` | vitest; smoke | W3a | `mcp/*` |
| 60 `/update-user` disabled | smoke: POST `/api/auth/update-user` → 404 | 404 | smoke | W1 | auth config |
| 61-AC1 e2e | `pnpm e2e e2e/delete-account.spec.ts` | signed out at `/`; `/xii/teams` shows the roster name; the `user`, `session` and `profile` rows are gone | e2e; `r10-accounts/delete-*` | W3b | mutation, page |
| 61-AC1 rows gone (integration) | `pnpm test src/mutations/account.test.ts` | `organizer`, `profile`, `user`, `session`, `account` rows gone; Participant rows untouched | vitest | W3b | mutation |
| 61-AC1 Blob object gone | **N/A by scope change D12** (no stored objects) | — | scope-change record on ticket 61 | — | — |
| 61-AC2 last Organizer | integration test with one organizer row | "The last Organizer can't be removed."; nothing deleted | vitest | W3b | mutation |
| Gate (each ticket's AC) | full gate | exit 0 | `r10-accounts/gate.txt` | each wave; final | any |
| Epic docs | diff review; `pnpm tsx scripts/about-media.ts` if the stills change | present and accurate | diff | W4 | docs |
| Epic closeouts | read the ticket files | closeout + `done` | files | closeout | — |
| Epic CI | `gh pr checks` | green | PR | after the PR opens | any |

The PR can open with every local row `PASS`. Human-gated rows stay `BLOCKED` until Paul acts and the agent's post-check passes. They are never marked `PASS` on anyone's word alone.

### Human gates and questions

1. **Blob:** none needed (scope change D12).
2. **Test sign-in secret:** set `TEST_SIGN_IN_SECRET` (≥32 characters) on staging only, and confirm it is absent on Production. Needed before 62-AC3a.
3. **Answered (Paul, 2026-10-02):** PR previews use no Vercel environment; there are deployments only for `staging` and `main`. The secret goes on the staging deployment's environment only, never on `main`'s.

### Exclusions

- Portraits as a feature (ticket 19).
- Picture upload and Blob storage (later, with AI-edited portraits).
- Announcement image upload (R11 decides its own storage).
- Changing Organizer-typed names or `war_week.winner`.
- View as (ticket 63, back to the backlog).
- OAuth scope changes.

### Red-team

Round 1, 2026-10-02 (`atlas-red-team-reviewer`): **did not pass**, with 2 blocking findings and 11 should-fix findings.

| Finding | Resolution | Where |
|---|---|---|
| B1: self actions put in the read set | The self actions are writes, and the read set is hard-coded in the test. A delete-while-viewing e2e step is added | D17, Fixtures |
| B2: the production 404 check was vacuous | It is `BLOCKED` until promotion, records the SHA, and the runtime gate is unit-tested | D2, map |
| S1 | `SelfAction` added | D17 |
| S2 | Env values set explicitly | Fixtures |
| S3 | `/update-user` disabled; Google-URL rule | D5a |
| S4 | Plain `<img>`; moot for deletion after D12 | D10 |
| S5 | Inventory inlined | D9, D10 |
| S6 | The third anonymous case dropped | D1 |
| S7 | `/admin/organizers` email form | D20 |
| S8 | New e2e helper; exact-list cleanup | Fixtures |
| S9 | Rollout note | Waves |
| S10 | Secret of at least 32 characters | D2 |
| S11 | `emailVerified: true`; auth config unchanged | D5 |

Notes adopted: the proxy and MCP use the D1 rule; `jgEmailSchema`; the cookie name, attributes and encoding; the derived HMAC key; delete goes through `removeOrganizer` with a tx; typed confirm; the `user.email` join; `varchar(254)`; the Standings tie-break; the cross-reference fixes.

Not adopted: storing an id rather than the email in the `view_as` cookie. The email is signed, httpOnly and rechecked on every request.

Round 2, 2026-10-02: **PASS**. B1 and B2 confirmed resolved. Three minor should-fix findings were applied: 2a calls the real `can` with no stub, and a test covers `authorizeSelf` while viewing; the 62-AC3a post-check uses Paul's screenshot plus a curl; the D18 wording on `getGamesView` was corrected.

## [SCOPE CHANGE]

2026-10-02, Paul: "pictures should just be urls, we don't want or need blob storage at this time." Clarified the same day: "Users should be able to set the url for their image as well … just no need to upload yet." The Profile picture is a URL the person sets, else the Google photo URL (`user.image`), else initials; no upload and no Vercel Blob. Affects ticket 60 (the upload decision and AC3's "real upload to the Blob store"; the e2e "uploads a picture" becomes "shows the Google photo") and ticket 61 ("uploaded picture (Blob object deleted)" and its AC check). The epic's Blob human prerequisite is dropped. Uploads move to Blob storage in a later ticket, alongside AI-edited portraits.

2026-10-02, Paul: drop ticket 63 (View as) from R10. His need is testing as a non-admin and the entry flow, which Test sign-in (62) covers with real behavior as that person; View as was the riskiest access change for marginal benefit. Ticket 63 returns to `needs-triage` with the note "revisit if Organizers need to debug a real person's view in production". The red-team's B1 (self actions in the View as read set) is moot; the self actions remain plain signed-in writes keyed on the actor's own email.

## [PROGRESS]

- 2026-10-02: claimed the epic and tickets 60, 61 and 62 (`ready-for-agent` → `in-progress`; planning and plan-review happened in `/atlas-plan` the same day, recorded above). Proof root `test-results/` cleared.

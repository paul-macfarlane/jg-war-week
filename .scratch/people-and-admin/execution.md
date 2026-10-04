# Execution record: Epic R22, People and admin

Contract: [`spec.md`](./spec.md) as of `origin/staging` `c254a26e`
(decisions 1–8, the schema change, 15 acceptance criteria, 10 DoD items;
red-team pass 1 resolved). Blocked by: none. Branch:
`feat/r22-people-and-admin`. No `/atlas-plan` ran; `/atlas-implement`
derived this plan from the spec. It does not amend the spec.

## [EXECUTION PLAN]

2026-10-04. Derived by the orchestrator; no product or architectural
decision added beyond the spec.

### Execution structure

**Sequential**, one direct checkout, no worktrees. Parallelism is rejected
for two reasons:

- **Shared mutable state.** Every deliverable's proof runs `pnpm smoke`
  and `pnpm e2e`, which migrate and `--reset` the one local Postgres
  (`war-weeker-postgres`) and serve on port 3200. Two workers at once
  would wipe each other's data mid-run.
- **Predicted file collisions** (re-checked at closeout):
  `src/db/schema.ts`, `drizzle/0033_*.sql` and `drizzle/meta/*` (D1, D2);
  `seeds/*.json` and `src/seed/{schema,load}.ts` (D1, D2);
  `src/app/admin/finale/page.tsx` (D1, D2, D3); `src/components/award-form.tsx`
  (D2, D4); the Hosts picker in `src/components/competition-settings-form.tsx`
  and `src/lib/host-options.ts` (D1, D4); `src/components/entrant-mark.tsx`
  and the picker rows (D4, D5); `CONTEXT.md`, `docs/maintainers-guide.md`,
  `docs/regression-checklist.md`, `docs/agents/testing.md` (all).

| # | Deliverable | Spec | Depends on |
|---|---|---|---|
| D1 | Hosts are roster Participants; Host admin scope | Decisions 1, 2; schema `competition_host` | — |
| D2 | Awards without Categories; history by name; one Award per Finale step | Decisions 5, 6; schema `award_category`, `award.category_id`, `finale_awards_layout` | D1 (one migration) |
| D3 | No Bracket Finale | Decision 8 | D2 (`/admin/finale`) |
| D4 | One name-only `ParticipantPicker` | Decision 3 | D1, D2 (Hosts and Award pickers) |
| D5 | The Team shows everywhere a Participant competes or scores | Decision 4 | D4 (shared row display) |
| D6 | `/about` stills in XII, `/about` copy, backlog closures, docs sweep | Decision 7; DoD | D1–D5 (stills show the new pickers) |

### Resolved execution decisions (within the spec)

- **One migration.** The branch carries exactly one new migration,
  `drizzle/0033_*.sql`. D1 generates it; D2 deletes it with its snapshot
  and journal entry and regenerates from the final schema
  (`pnpm db:generate`), then hand-adds any data statements (deleting
  `competition_host` rows before the `participant_id` NOT NULL column) and
  re-applies them.
- **Seed Hosts.** The seed format names a Host by the Participant's seed
  key or display name (spec "Schema change"); the loader refuses a Host
  not on that War Week's roster.
- **Docs travel with their decision.** Each deliverable updates its own
  lines in `CONTEXT.md`, `docs/maintainers-guide.md`,
  `docs/regression-checklist.md` and `docs/agents/testing.md`. D6 does a
  final consistency sweep, `/about` copy and media, and closes backlog
  108 and 83.
- **D1's Hosts picker** drops email from its options and payload and
  stops disabling no-email Participants, marking a non-@jahnelgroup.com
  one "Can't sign in"; D4 then swaps it to `ParticipantPicker`.
- **Bracket Finale's MCP / smoke references** (`/xi/finale/<id>` in the
  Bracket loop) become 404 checks in D3.

### Verification map

Run surface: **local + deployed**; deployed is the human reset/reseed after
merge (DoD 10). Evidence root `test-results/` (committed, cleared at the
start of this work package). Every e2e spec screenshots into
`test-results/e2e/<test>/`.

| Criterion | Command / action | Real dependencies | Earliest checkpoint | Invalidated by |
|---|---|---|---|---|
| AC1 no-email Host gains access after email added | `pnpm e2e regression-r22-hosts` | local Postgres, prod build, stub session | after D1 | Host storage, access, sign-in, roster changes |
| AC2 other War Week's Participant refused | `pnpm test src/mutations/setup.test.ts` (Host mutation vitest) | test DB per existing vitest pattern | after D1 | Host mutation |
| AC3 Create next War Week copies no Hosts | `pnpm test src/mutations/war-week-lifecycle.test.ts` | as above | after D1 | lifecycle mutation |
| AC4 Host nav and server refusals | `pnpm e2e regression-r22-hosts regression-r5`; `pnpm smoke` (hosts, announcements) | local Postgres, HTTP | after D1 | access, gate, admin-sections, actions |
| AC5 non-JG sign-in rejected, incl. a Host | `pnpm test` (auth tests + the new one) | — | after D1 | auth |
| AC6 ParticipantPicker everywhere, avatar·name·Team, 100 no cap | `pnpm test` (search vitest); `pnpm e2e regression-r22-picker regression-r19-scale` screenshots 1440/390 | scale seed | after D4 | any picker |
| AC7 no email in picker payloads | `pnpm smoke` (page HTML+RSC scan for seeded emails) | HTTP, seeded roster | after D4 | pickers, queries |
| AC8 Participation filter rows | `pnpm e2e regression-r22-picker` | — | after D4 | participation list |
| AC9 Team rule on every surface | `pnpm e2e regression-r22-team` screenshots per surface at 1440/390, teams and FFA; checklist line "Teams show in team events" | teams seed | after D5 | any listed surface |
| AC10 Award presets, no Category UI | `pnpm e2e regression-r22-awards` | — | after D2 | award form, queries |
| AC11 history by name, 404s | `pnpm smoke` (award-history); `pnpm e2e regression-r22-awards` at two viewports | seeds i–xii | after D2 | seeds, history query, slug |
| AC12 Finale one Award per step, no layout control | `pnpm e2e regression-r13-built-in-slides` | — | after D2 | finale slides |
| AC13 Bracket Finale 404, no admin section | `pnpm smoke`; `pnpm e2e bracket` | — | after D3 | finale routes |
| AC14 `/about` stills in XII, `assertNoRealEmail` | `pnpm build && pnpm seed:demo:xii && tsx scripts/about-media.ts`; view `test-results/about-media/` | prod build | after D6 | any UI in the stills |
| AC15 MCP: no Host lists, no `@` | `pnpm smoke` (MCP checks) | HTTP MCP | after D1 | MCP |
| DoD2 migration + seeds; smoke on seeded local Postgres | `pnpm smoke` | local Postgres | after D2 | schema, seeds |
| DoD3 ADR | file review | — | after D1 | — |
| DoD4 CONTEXT.md | file review | — | after D5 | — |
| DoD5 Host blast radius | `pnpm smoke`, `pnpm e2e regression-r5` + testing.md review | — | after D1 | — |
| DoD6 guide, checklist, `/about` copy and media | file review + AC14 | — | after D6 | — |
| DoD7 backlog 108, 83 closed | file review | — | after D6 | — |
| DoD8 screenshots committed | `git ls-files test-results/e2e` | — | after D6 | — |
| DoD9 `pnpm format:check && pnpm gate`; CI | full gate at the integrated head; CI on the PR | everything | aggregate | any change |
| DoD10 reset and reseed staging and production | **human gate (Paul), after merge** | Vercel, Neon | after merge | — |

### Human gates

- **DoD10, announced for later.** Prerequisite: the PR merged into
  `staging` (and later `main`). Action: Paul resets and reseeds staging
  and production. Expected: both serve War Week XII with Hosts as
  Participants and no Award Categories. Post-check: outside this work
  package (after merge); recorded `BLOCKED` at closeout as a pending human
  step, never `PASS`.

## [PROGRESS]

- 2026-10-04 D1 accepted (`b3a9dfd4`, sonnet worker): Hosts are roster
  Participants (migration 0033), request-time Host access, Host admin scope,
  ADR 0012. Worker run: vitest 3988 passed; smoke 302 ok; e2e
  `regression-r22-hosts`, `regression-r18-hosts`, `regression-r5` 12 passed
  plus 43 other Host-touching specs. Note: smoke/e2e need `DATABASE_URL` set
  on the command line (local docker URL from `vitest.config.ts`). Unreachable
  Host branches in the Schedule and Announcements pages left for the D6
  sweep.
- 2026-10-04 D2 accepted (`233b3ebd`, sonnet worker): Awards without
  Categories, presets, `/history/awards/<slug>`, seeds renamed, one Award per
  Finale step; the branch's one migration regenerated as
  `0033_fluffy_vanisher.sql` (DROP TABLE moved after the FK column drop so it
  applies). Worker run: vitest 3937 passed; smoke 302 ok; e2e 9 + 23 passed.
  Worker deviations held for the aggregate review: the preset picker is a
  separate field above Name; grouping is by slug (names differing only in
  punctuation share a page); `get_awards` drops `category`. Committed e2e
  screenshots of specs a worker didn't run go stale; the aggregate gate
  regenerates and commits all of them.
- 2026-10-04 D3 accepted (`c110c53d`, sonnet worker): Bracket Finale
  removed; `/xi/finale/<id>` 404 and no "Bracket Finales" on `/admin/finale`
  in smoke and `e2e/bracket.spec.ts`. Worker run: vitest 3930 passed; smoke
  302 ok; e2e 14 passed.
- 2026-10-04 D4 accepted (`100ed303`, sonnet worker): `ParticipantPicker`
  for Hosts, Placement sheet, Entrants, Squads, Attempt players
  (`result-form.tsx`), Award recipients and Discretionary points;
  Participation filter rows; no email in any picker option or payload.
  Head-to-head and Bracket Match forms have no player combobox (fixed rows),
  so the Attempt picker is the only match/game player picker. Worker run:
  vitest 3938 passed; smoke 373 ok (71 payload email scans); e2e 102 + 19
  passed.
- 2026-10-04 D5 accepted (`ea0760f6`, sonnet worker): `ParticipantMark` /
  `TeamTag` in `src/components/participant-mark.tsx`, a Team ring on a
  pictured Avatar. Components per surface: Standings `standings.tsx` (Home,
  leaderboard, Finale Standings); Brackets `bracket-tree.tsx` via
  `EntrantMark` (color), `bracket-podium.tsx`, `top-finishers.tsx`,
  `match-result-form.tsx`; Matches and Attempts `logged-results-view.tsx`;
  Placement `placement-view.tsx`; Recent results `recent-results.tsx`;
  Now/Next no change (tiles are Schedule Items, no Participant); Awards
  `[edition]/awards/page.tsx`, `history/awards/[slug]/page.tsx`, Finale
  Awards via Avatar ring; Admin `placement-sheet.tsx`,
  `participation-view.tsx`, `discretionary-points-editor.tsx`,
  `awards-editor.tsx`, pickers from D4. Worker run: vitest 3951 passed;
  smoke 373 ok; full e2e 174 passed.
- 2026-10-04 D6 accepted (`00b8868b`, sonnet worker): `about-media.ts
  --edition` (default `xii`) fails unless `/` resolves to that edition;
  `/about` copy; every still regenerated in XII (viewed light and dark:
  magenta primary, "War Week XII"); `assertNoRealEmail` runs on every page
  and the run completed; backlog 108 and 83 `done`. Unreachable Host filters
  removed from the Schedule admin page.
- 2026-10-04 R1 review fixes accepted (`bfa3cd56`, `bb67c1dc`, sonnet
  worker): every blocking and non-blocking finding below fixed. Worker run:
  vitest 3954 passed; smoke 373 ok; e2e 120/121 then the one failing new
  assertion (an avatar-less row) removed, `regression-r22` 20 passed.

## [AI CODE REVIEW]

2026-10-04. Diff `c254a26e..bb67c1dc`. Two fresh frontier reviewers read
the whole diff, one per axis; the orchestrator adjudicated every
candidate.

### Axis 1: technical implementation and spec conformity

Met: Decisions 1–8, the schema change, ACs 1–4, 7, 8, 10–15. Checked by
the reviewer: migration 0033 order and FKs, request-time Host access with
the same-War-Week join, `ORGANIZER_ONLY` covering Schedule, Announcement
and Finale actions, no email in any picker query or server→client prop,
award slug 404s, no leftover `award_category` / `finaleAwardsLayout` /
Bracket Finale / `competition_host.email` in code, seeded data restored by
every new spec.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | blocking | `regression-r22-team` Now/Next test guarded by `if (count > 0)` (vacuous) | resolved: test removed; Now/Next tiles are Schedule Items with no Participant (surface 6 n/a) |
| 2 | blocking | e2e short of AC6/AC9: Squads picker, Participant-page log picker, Group Bracket Match results | resolved: added to `regression-r22-picker` / `-team`. Home's individual list exists only in a free-for-all War Week (Teams War Weeks show Team standings), covered by the XII test |
| 3 | blocking | AC5 test was a Host-lookup test, not sign-in | resolved: `rejectNonJahnelGroup` extracted from `src/auth/server.ts` and tested with a Host's non-JG roster email |
| 4 | non-blocking | `runsCompetition` duplicated the Host rule without the same-War-Week join | resolved: uses `getHostedCompetitions` |
| 5 | non-blocking | Participation view Team as plain text | resolved: `TeamTag` |

Deviations accepted by the orchestrator (for PR review):

- (a) Award presets are a "Preset" picker above the Name field, not the
  Name field itself; every AC10 behaviour holds (presets offered, picking
  fills name and description, both editable, a new name saves).
- (b) Award names group by slug (case and punctuation ignored), a superset
  of case-insensitive grouping and the only rule that can't put two
  groups on one URL; presets dedupe the same way; CONTEXT.md says so.
- (c) `get_awards` over MCP drops `category`.
- (d) Now/Next (Decision 4 surface 6) shows no Participant, so no change.
- (e) Multi-select picker chips show the name only (rows carry avatar ·
  name · Team).
- (f) Head-to-head and Bracket Match forms have fixed Entrant rows, so the
  Attempt picker is the only match/game player picker converted.
- (g) The Participation view shows the Team in individual scoring too.
- The Participant-facing "Log an Attempt" picker shows only to an
  Organizer or Host (a Participant logs as themselves), so its e2e runs as
  the Organizer on the public Competition page.

### Axis 2: coding standards

Clean: no `cursor-*` / `disabled:pointer-events-none`, no hand-rolled
controls, button variants, ADR 0001 layering in `src/lib`, banned terms.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | blocking | In-app Organizer guide said Hosts see Schedule, Announcements, Finale | resolved |
| 2 | blocking | CONTEXT.md: Host access "at sign-in time", Announcements by Hosts, Hosts on `/admin/finale` | resolved |
| 3 | blocking | Maintainers' guide: "Finale: <Competition>" per Bracket; Hosts see the slide list | resolved |
| 4 | non-blocking | Dead Host plumbing (`postedCompetitionId`, `authorEmail`, `requireCompetition`, `canEdit`, `mayChange`) and stale comments | resolved: removed |
| 5 | non-blocking | Misplaced JSDoc in `src/seed/load.ts`; unwrapped comments; stale `getProfilesByEmail` doc | resolved |
| 6 | non-blocking | `ParticipantMark`, `filterParticipantOptions` used only by tests | resolved: deleted; the picker's real `nameMatches` is what the vitest covers |
| 7 | non-blocking | Presets dedupe by lowercase, history by slug | resolved: both by slug |
| 8 | non-blocking | Hosts parser hand-validated | resolved: `z.array(z.uuid())` |
| 9 | non-blocking | ADR 0012 section order and a stray "Extends 0010"; ADR 0002 Status line | resolved |
| 10 | non-blocking | `deleteXiCompetition` sweeps orphan E2E Participants in every War Week; header comments | resolved: documented |
| 11 | non-blocking | Team as text in admin Awards; duplicated Award-name chips; leftover h1 classes | resolved: `TeamTag`, `AwardNameChips` |
| 12 | non-blocking | Award history slug filter done in the query, not `src/lib` | accepted: the slug rule itself lives in `src/lib/award-names.ts` |

Remaining risk: `pinRefusal` in `src/actions/announcements.ts` keeps a
Host path that is now unreachable and untested.

## [CLOSEOUT]

2026-10-04. Repository delivery `war-weeker`: branch
`feat/r22-people-and-admin` from `staging` `c254a26e`, one PR into
`staging`. Direct checkout, sequential.

**Isolation re-check.** The predicted collisions all materialized: every
pair of deliverables shared `CONTEXT.md`, `docs/agents/testing.md`,
`docs/maintainers-guide.md` and `docs/regression-checklist.md`; D1/D2
shared `drizzle/meta/*` and the schema; D1/D2/D3 `src/app/admin/finale/page.tsx`
and `organizer-guide.tsx`; D2/D4 the Awards admin; D4/D5 `avatar.tsx` and
`awards-editor.tsx`. The shared local Postgres and port 3200 were the
deciding reason in any case.

**Deliverables** (all sonnet workers; orchestrator, review and verification
on Opus 5.5):

| # | Commit | Deliverable |
|---|---|---|
| D1 | `b3a9dfd4` | Hosts are roster Participants; Host admin scope; ADR 0012 |
| D2 | `233b3ebd` | Awards without Categories; history by name; one Award per Finale step; migration 0033 |
| D3 | `c110c53d` | No Bracket Finale |
| D4 | `100ed303` | One name-only `ParticipantPicker` |
| D5 | `ea0760f6` | The Team on every surface |
| D6 | `00b8868b` | `/about` copy and XII stills; `--edition` guard; backlog 108, 83 closed |
| R1 | `bfa3cd56`, `bb67c1dc` | AI code review fixes |

**Verified run command** (integrated head `bb67c1dc`, local Postgres in
docker, `DATABASE_URL` set on the command line):
`pnpm format:check && pnpm gate` → exit 0: format clean; typecheck clean;
lint 0 errors (9 existing `<img>` warnings); vitest 211 files, 3954
tests passed; build ok; smoke 373 `ok`, none failing; e2e 176 passed
(8.3m). Screenshots from that run committed under `test-results/e2e/`
(20 `regression-r22-*` test directories, 87 files, plus refreshed tracked
ones); `/about` evidence under `test-results/about-media/`.

| Criterion | Verdict | Evidence |
|---|---|---|
| AC1 no-email Host gains access after email added | PASS | e2e `regression-r22-hosts`; `test-results/e2e/regression-r22-hosts-*` |
| AC2 other War Week's Participant refused | PASS | vitest `src/mutations/setup.test.ts` |
| AC3 Create next War Week copies no Hosts | PASS | vitest `src/mutations/war-week-lifecycle.test.ts` |
| AC4 Host nav, page and action refusals | PASS | e2e `regression-r22-hosts`, `regression-r5`; smoke `hosts.ts` (9 actions over HTTP) |
| AC5 non-JG sign-in rejected, incl. a Host | PASS | vitest `src/auth/reject-non-jahnel-group.test.ts`, `src/queries/organizers.test.ts` |
| AC6 every picker is `ParticipantPicker`, name search, 100, no cap | PASS | vitest `src/lib/participant-options.test.ts`; e2e `regression-r22-picker`, `regression-r19-scale` (1440, 390) |
| AC7 no email in picker HTML or RSC payload | PASS | smoke `pickers.ts` (71 page scans with marker emails) |
| AC8 Participation filter rows | PASS | e2e `regression-r22-picker` |
| AC9 Team on every surface; none in free-for-all | PASS | e2e `regression-r22-team` (10 tests, 1440 and 390); surface 6 n/a (deviation d) |
| AC10 Award presets, no Category UI | PASS | e2e `regression-r22-awards`; smoke `award-names.ts` |
| AC11 history by name; old id and unknown slug 404 | PASS | smoke `award-history.ts`; e2e `regression-r22-awards`, `regression-r12-award-history` |
| AC12 one Award per Finale step; no layout control | PASS | e2e `regression-r13-built-in-slides` |
| AC13 `/<edition>/finale/<id>` 404; no Bracket Finales section | PASS | smoke bracket loop; e2e `bracket.spec.ts` |
| AC14 `/about` stills in XII; `assertNoRealEmail` | PASS | `test-results/about-media/` (run at `00b8868b`; later changes touch only teams-mode admin rows, absent from the free-for-all XII stills); light and dark stills viewed |
| AC15 MCP: no Host lists, no `@` | PASS | smoke MCP checks |
| DoD1 red-team | PASS | spec Comments (pass 1) |
| DoD2 migration and seeds; smoke | PASS | `drizzle/0033_fluffy_vanisher.sql`; `src/db/migrations.test.ts`; smoke seed twice |
| DoD3 ADR | PASS | `docs/adr/0012-hosts-are-roster-participants.md`; ADR 0002 superseded in part |
| DoD4 CONTEXT.md | PASS | Host, Award preset, history rule, Host access rules, no Bracket Finale, name-only picker, Team rule with surfaces |
| DoD5 Host blast radius | PASS | `scripts/smoke/hosts.ts`, `announcements.ts`, `e2e/regression-r5.spec.ts`, testing.md lines |
| DoD6 guide, checklist, `/about` | PASS | `docs/maintainers-guide.md`, `docs/regression-checklist.md`, `src/lib/about.ts`, `public/about/` |
| DoD7 backlog 108 and 83 closed | PASS | issue files `done` with pointers |
| DoD8 screenshots committed | PASS | `git ls-files test-results/e2e` |
| DoD9 `pnpm format:check && pnpm gate`; CI | PASS locally; CI on the PR pending at writing | above |
| DoD10 reset and reseed staging and production | BLOCKED (human, after merge) | Paul |

**Deviations:** (a)–(g) in the AI Code Review above. No scope change.
Deployed smoke: not run (DoD10 resets the deployed data after merge).

**Human step after merge (DoD10):** Paul resets and reseeds staging, then
production after the `staging` → `main` PR. Expected: XII serves with
Hosts as Participants and no Award Categories.

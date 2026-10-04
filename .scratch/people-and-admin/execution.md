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

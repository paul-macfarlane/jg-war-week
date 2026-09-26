# 03: Roles and access consolidation (Organizer, Host, write target from the request)

**What to build:** The role model in ADR 0002 and the write-target rule in ADR 0003, behind one `can(actor, action, target)` rule. This is an access and schema change, so it needs a full spec (`/to-spec`) and `/atlas-red-team` before implementation (`docs/agents/planning.md`). The decisions below are settled. The spec turns them into stories and acceptance criteria.

**Blocked by:** 02

**Status:** done

**Spec:** `.scratch/roles-and-access/spec.md`

## Settled decisions

- **Organizer:** a global list in its own table, managed by Organizers in `/admin`. The last Organizer can't be removed; you can remove yourself if another remains. The migration fills it from the current War Week's `organizerEmails`; the column is dropped later by ticket 18 (expand/contract, decided in the spec). The seed schema and demo seeds change in the same PR.
- **Host:** a per-Competition list of JG emails, assigned by Organizers on the Competition's setup page. A Host doesn't have to be a Participant. "Create next War Week" copies Hosts along with Competitions when `copyCompetitions` is on.
- **A Host can**, on their Competitions: edit setup (including scoring and Placement Points), build, run, reopen and finalize the Bracket, add, edit and delete Points Entries, and manage Schedule Items linked to the Competition. A Host can also post Announcements and edit or delete their own. The rest is Organizer-only.
- **`/admin`** shows a Host only their Competitions and the pages they can use. The page gate becomes "Organizer, or Host of something in this War Week".
- **Every action** takes its War Week from the row or a posted `warWeekId` and checks it with `can`. The `admin_edition` cookie only chooses what `/admin` shows. Order: authenticate → load the target → `can` → parse input → mutation. Actions return results and never throw.
- **Removed:** the rule letting current Organizers edit `complete` editions (every Organizer can edit everything); the self-email settings guard; the `copyOrganizers` option; `canAdministerWarWeek`; the Organizer-only branches of the lifecycle rules. Lifecycle is Organizer-only.
- **Unchanged:** Google-only sign-in; non-`@jahnelgroup.com` emails refused; MCP never exposes emails or either role list.

## Bugs this fixes (from the 2026-09-26 audit)

- Correcting a past War Week fails with "You can't remove your own email…" (`src/lib/setup.ts:532`, `src/mutations/setup.ts:105`).
- Creates and the settings save write to whichever edition the cookie names at submit time (`src/auth/organizer.ts:46-78`; `src/actions/setup.ts:42-45`, `setup-schedule-faq.ts:26`, `awards.ts:40`, `announcements.ts:40`). Two tabs can overwrite another edition's settings.
- Setup input is parsed before the Organizer check (`src/actions/setup.ts`).
- The Admin nav link only shows for Organizers of the current War Week (`src/app/[edition]/war-week.ts:29`).
- The bracket admin pages omit `editions` from `AdminShell` (`src/app/admin/brackets/[id]/page.tsx`, `src/app/admin/setup/competitions/[id]/bracket/page.tsx`).

## Acceptance criteria (to be expanded by the spec)

- [ ] Action-layer tests cover `can` for Organizer, Host of this Competition, Host of another Competition, Participant and anonymous, for each action family.
- [ ] A test proves a create posted for edition A can't write to edition B, whatever the cookie says.
- [ ] CONTEXT.md "Access rules" and "War Week lifecycle rules" are rewritten to match, and the "Changing" note is removed.
- [ ] `/about`, the Organizer guide and `docs/maintainers-guide.md` describe Organizers and Hosts.
- [ ] `pnpm gate` passes; smoke checks that a Host is refused outside their Competition.

## Comments

- 2026-09-26: Spec written at `.scratch/roles-and-access/spec.md` (`/to-spec`). Decisions made there: seams are `can` unit tests, rolled-back mutation tests and smoke (no mocked-Next action tests); a fresh database gets its Organizers from an optional, insert-only `organizers` list in War Week seeds; ticket 10 stays in Epic B. Next: `/atlas-red-team` on the spec plus ticket 10.
- 2026-09-26 [RED-TEAM 1]: `ATLAS_RED_TEAM_BLOCKED`, with 1 blocking finding, 4 warnings and 7 minors. Resolution in the spec:
  - B1 (migration copy never exercised, false-green DoD line): added the migration copy test on pre-migration fixtures and removed the false DoD line.
  - W1 (hand-edited migration): the set is `db:generate` plus `generate --custom` for the copy; "who added it" is nullable.
  - W2 (deploy/rollback): expand/contract. The column stays until ticket 18. Added a human prerequisite before `staging` → `main`: confirm the current edition's list and take a Neon backup. Story 54 reworded.
  - W3 (last-Organizer race): `SELECT … FOR UPDATE` plus a two-connection mutation test.
  - W4 (parse after `can` unverifiable): a smoke check that malformed input from a Participant, or from a Host outside their Competition, gets the access refusal.
  - M1: the Organizer-list family takes no target.
  - M2: statuses flip after the re-review passes.
  - M3: reworded for `--reset`, which wipes Hosts.
  - M4: the chips control and guide lose the self-email guard.
  - M5: the Host unique key is ordered `(email, competition_id)`; lowercase checks on both tables.
  - M6: branch `feat/03-roles-and-access`.
  - M7: smoke churn listed.
  - Former-Host smoke line added (story 47).
- 2026-09-26 [RED-TEAM 2]: `ATLAS_RED_TEAM_PASSED`, 5 warnings and 10 minors. Resolved in the spec and ticket 10: W1 lifecycle item dropped; W2 each race names its lock, its sharing writers and a two-connection test, FAQ accepted as harmless; W3 copy test is a guarded vitest file with a scratch database and hand-applied pre-03 files; W4 code-first window accepted as a possible sub-minute outage with a post-check; W5 Hosts saved only by their own Organizer action. M1 statuses flipped; M2 custom-migration exception recorded in the maintainers guide; M3 malformed ids get not-found before `can`; M4 constraints defined; M5 `competition_host.competition_id` index; M6 AC reworded; M7 two-connection fixture pattern; M8 stale line fixed and epic supersedes per-ticket availability; M9 `schedule_item.host` disambiguated; M10 build-vs-buy line. Ready for `/atlas-implement` on Epic B.
- 2026-09-26 [EXECUTION PLAN]: claimed by Atlas (`/atlas-implement`, Epic B); branch `feat/03-roles-and-access`; plan and verification map in `.scratch/roles-and-access/execution.md`.

- 2026-09-26 [AI CODE REVIEW] Epic B aggregate review of `git diff 4a41296..611f9b8`. Two independent reviewers read the diff, one per axis; the orchestrator adjudicated each finding against the cited code.
  - **Technical implementation and spec conformity.** The core is clean: every War Week write runs `authorize` → `can` → parse → mutation; a posted Competition grants access only via a DB-loaded (Competition, War Week) pair; no action writes to the `admin_edition` cookie's edition; `src/` no longer reads `organizer_emails`; locks are taken inside transactions; `guarded` rethrows Next control flow.
    - BLOCKING, fixed: a Host could unpin an Organizer-pinned Announcement by leaving `pinned` out of `updateAnnouncement` (the parser defaulted it to `false`).
    - Fixed: `updatePointsEntry` moving an entry to another Competition didn't take that Competition's row lock.
    - Fixed: `scripts/about-media.ts` granted the demo user through `organizer_emails`.
    - Fixed: Host and Organizer emails had no format or length check (one shared JG email schema now).
    - Deviation: the Points Entry race test flips `generated_by_bracket` directly. Finalize never converts a hand-entered row, so the `WHERE` guard is defensive, and the test proves the guard, not a live race.
    - Deviation: the preview OAuth `redirect_uri` comes from `BETTER_AUTH_URL`. It's covered by ticket 08's human gate.
  - **Coding standards.** Banned-term scan clean. Removed helpers have no callers. Migrations: 0008 and 0010 generated, 0009 the one custom data step. DB test guards are in place. UI conventions are followed.
    - Fixed:
      - not-found messages per family;
      - refusal wording ("Organizers and Hosts only.");
      - dead code (a second sign-in check, an unused `actorEmail`, a test-only query) and a double War Week load in the lifecycle actions;
      - a duplicate Competition row-lock helper;
      - `canPin` defaulting to `false`;
      - `guarded` consistency;
      - the smoke constant;
      - stale docs: ADR 0001's step order, `docs/agents/planning.md`, three CONTEXT.md lines, the maintainers-guide command.
    - Deviations:
      - The global Organizer-list mutations take `actorEmail`, not a War Week `MutationContext`; ADR 0001 notes it.
      - The new Organizers and Hosts forms use the existing `useTransition` pattern; ticket 12 converts every form (ADR 0004).
      - `/admin` UI trimming derives visibility from the actor, while `can` enforces every write; folding page visibility into `can` is for ticket 11.
      - Ticket 04's per-family action tests mock `authorize` and the mutation to isolate the catch-all.
      - The old `scripts/*-evidence.ts` files still write `organizer_emails`; ticket 11 deletes them, before ticket 18 drops the column.
  - Remaining risk: the race tests depend on timing (a 100 ms stagger and a 300 ms hold). With the guards in place they assert only the invariant, so slow CI weakens them but shouldn't fail them.

- 2026-09-26 [CLOSEOUT] Epic B delivered on `feat/03-roles-and-access` (base `staging` `4a41296`). The final verified head is `26bc170`; the closeout commit adds only records and evidence.
  - **Deliverables (all Opus workers except D4 on Sonnet; orchestrator Opus):**
    - D1 (data layer): `23c63b0`.
    - D2 (access rule, actions, `/admin`): `1395b21`, `3467069`.
    - D3 (ticket 04): `31f7a6e`.
    - D4 (ticket 08): `51b109d`.
    - D5 (ticket 10): `2e82621`.
    - D6 (smoke checks and docs): `d4b7f33`, `611f9b8`.
    - Review fixes: `235dce2`, `26bc170`.
  - **Verified run command:** `pnpm db:migrate && pnpm gate` with the local Postgres from `docker compose` (`DATABASE_URL` as in `.env.example`, `DATABASE_DRIVER=pg`). Result: typecheck clean; lint 0 errors; vitest 78 files / 1362 tests; build ok; smoke 177 ok / 0 FAIL, exit 0 (`test-results/hardening-b-gate/gate.txt`).
  - **Evidence** (committed under `test-results/`):
    - `hardening-b-gate/gate.txt`
    - `hardening-b-focus/vitest-verbose.txt` (the named focused tests)
    - `hardening-b-docs/grep.txt`
    - `hardening-b-browser/host-admin.md` (a Host's `/admin` in a browser)
    - `hardening-b-d1…d5/`, `hardening-b-smoke/d6-report.md` (per-deliverable evidence)
  - **Isolation re-check:** wave 3 (D3, D4, D5) ran in parallel worktrees. The predicted disjoint ownership held: the cherry-picks applied with no conflicts, and D3 touched no smoke file, so serializing D6 after it was correct.
  - **PR:** see the epic's closeout for the URL.
  - **Ticket 03 verdicts** (all local, on `26bc170`):
    - AC1 `can` per family × actor: PASS (`src/lib/access.test.ts`, 393 cases).
    - AC2 a create for edition A can't write B: PASS (smoke "createFaqItem posting XI's warWeekId with admin_edition=x in the cookie writes to XI and leaves X unchanged").
    - AC3 CONTEXT.md rewritten and the "Changing" note removed: PASS (`hardening-b-docs/grep.txt`).
    - AC4 `/about`, the Organizer guide and the maintainers guide describe Hosts: PASS (the same file).
    - AC5 `pnpm gate`, and a Host refused outside their Competition: PASS (smoke lines 349-363).
    - Spec checks: migration copy PASS (4 cases); last-Organizer lock PASS (fails with the lock removed); a Host's setup save can't change Hosts PASS; order of checks PASS; former Host PASS.
  - **Open human gate (the `staging` → `main` PR, not this one):** before merging to `main`, Paul confirms that production's current War Week `organizer_emails` is the intended global Organizer list, and takes a Neon backup. Post-check: the Migrate run is green, `/` and `/admin` load, and the `organizer` rows match.
  - **Deviations:** the Hosts field sits on Setup → Competitions rows with its own save; a malformed id gets "no longer exists" before `can`; a change of pinned value is checked as pin or unpin; `removeOrganizer` refuses an email that isn't listed. The review deviations are recorded in [AI CODE REVIEW].

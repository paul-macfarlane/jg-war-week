# 03: Roles and access consolidation (Organizer, Host, write target from the request)

**What to build:** The role model in ADR 0002 and the write-target rule in ADR 0003, behind one `can(actor, action, target)` rule. This is an access and schema change, so it needs a full spec (`/to-spec`) and `/atlas-red-team` before implementation (`docs/agents/planning.md`). The decisions below are settled. The spec turns them into stories and acceptance criteria.

**Blocked by:** 02

**Status:** in-progress

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

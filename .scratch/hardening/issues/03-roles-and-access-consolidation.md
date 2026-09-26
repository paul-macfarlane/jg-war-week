# 03: Roles and access consolidation (Organizer, Host, write target from the request)

**What to build:** The role model in ADR 0002 and the write-target rule in ADR 0003, behind one `can(actor, action, target)` rule. This is an access and schema change, so it needs a full spec (`/to-spec`) and `/atlas-red-team` before implementation (`docs/agents/planning.md`). The decisions below are settled. The spec turns them into stories and acceptance criteria.

**Blocked by:** 02

**Status:** needs-triage (next step: `/to-spec` from this ticket and ADRs 0002–0003)

## Settled decisions

- **Organizer:** a global list in its own table, managed by Organizers in `/admin`. The last Organizer can't be removed; you can remove yourself if another remains. The migration fills it from the current War Week's `organizerEmails`, then drops that column. The seed schema and demo seeds change in the same PR.
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

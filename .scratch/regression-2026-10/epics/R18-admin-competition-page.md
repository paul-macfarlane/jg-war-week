# Epic R18: The admin Competition page

**What to build:** One autosaving admin page per Competition, with execution settings locked once any result exists (part 101); Hosts picked from the roster (102); a rich-text description (103); Log a Game from admin (104).

**Work package:** this epic is **one work package**: one branch, one migration, one full gate, one PR. The files `101`–`104` under `../issues/` are its **parts**: each holds the decisions and behaviour checks for one area, with no gate, branch, PR or migration of its own. Their `Blocked by` lines are an order inside this branch, not merge gates.

**Branch:** `feat/regression-r18-admin-competition-page`, from `staging` after the blocker below has merged.

**Blocked by:** this planning change (`docs/regression-r18-red-team`) merged into `staging`. R17 merged 2026-10-03 (PR #128), so the branch starts from its schema (`drizzle/0029_*`).

**Status:** ready-for-agent

**Red-team:** **required** (Drizzle schema change for the description; Host access on the new page). Pass 1 on 2026-10-03 BLOCKED; resolved below.

**Source:** Paul's regression feedback, 2026-10-03; grilled the same day (`../grilling-2026-10-03.md`); spec `../spec.md`.

## How the work is done

- **Part order on the one branch:** 101 → 103 → 102 → 104. A part may leave the gate red; only the end of the work package must be green.
- **Shared files are owned by one worker at a time**, in part order: the new page under `src/app/admin/competitions/[id]/`, its settings component(s), `src/components/competitions-editor.tsx`, `src/lib/autosave.ts`, `src/actions/setup.ts`, `src/mutations/setup.ts`, `src/mutations/brackets.ts`, `src/lib/competitions.ts`, `src/db/schema.ts`, `drizzle/`, `src/seed/schema.ts` and `src/seed/load.ts`. No two workers edit these in parallel.
- **Permissions and locks are server-side.** Every per-field save goes through a mutation that checks the role and the lock itself, and refuses with the same one-line reason the page shows. A disabled field is the UI's copy of that rule, never the only guard.
- **One migration.** `pnpm db:generate` runs once, after 103's schema change, giving `drizzle/0030_*.sql` with its journal entry and snapshot, then hand-edited as below. drizzle-kit needs a terminal: `script -q /dev/null pnpm db:generate`.
- **Checks while building:** `pnpm typecheck && pnpm lint && pnpm test` with local Postgres up (`docker compose up -d`) and `DATABASE_URL` pointing at it, so Postgres tests run rather than skip. Any skipped Postgres file is a failure. Smoke and e2e run in the full gate at the end.
- **Retired code and tests are deleted, not skipped.** The edit sheet, `/admin/competitions/[id]/bracket`, `/games` and `/participation` pages, `/admin/brackets/[id]` and `/admin/placements/[competitionId]` become redirects. Specs and smoke steps that used them are rewritten against the new page; each part's closeout lists what it deletes and rewrites.
- **Evidence** goes under `test-results/r18/` (vitest summary with its skipped count, gate output); e2e screenshots under `test-results/e2e/<test>/`.

## Test data (every part)

- **Each e2e spec creates its own Competitions** in demo XI (one per Format it needs, named `E2E R18 …`) and deletes them in `finally` with `deleteXiCompetition`. No R18 spec changes a seeded Competition, so none needs a snapshot.
- **The Host** is `E2E_HOST_EMAIL` (`e2e/session.ts`). A spec that picks a Host from the roster gives an XI Participant that email for the test with `withParticipantEmail` (`e2e/db.ts`), which puts the Participant's own email back. `deleteE2eUsers` already removes e2e `competition_host` rows.
- **Server-side checks** (locks, Host refusals) are Postgres tests in the mutation test files, each in its own transaction, rolled back.

## Schema change (the one migration)

| Change | Part |
| --- | --- |
| `competition.description`: `varchar(2000)` → `jsonb` (`Content`, as `announcement.body`), nullable | 103 |

## The migration

Deployed data is **reset, not converted** (Paul, 2026-10-03). Hand-edit the generated SQL so the type change is `ALTER COLUMN "description" SET DATA TYPE jsonb USING NULL`. That applies to rows of any shape and never fails; old descriptions come back from the seeds on the reset below. The seed loader converts plain-text seed descriptions (part 103).

## Human prerequisite: reset staging, then prod

As R16's and R17's, after the R18 PR merges into `staging` and `migrate.yml` is green:

1. **Staging.** Run the **Seed** workflow on `staging`, file blank (all seeds), **reset** ticked, `staging` typed in **confirm_reset**. Expected: green. Check: demo XI's Settlers of Catan shows its description on its Participant page, with its line breaks.
2. **Prod pre-check, before the `staging` → `main` PR merges:** prod holds no Competition description an Organizer wrote that should be kept (the migration clears every description). If it does, don't merge; ask Paul.
3. **Prod**, after the `main` merge's migrate run is green: the Seed workflow **from `main`**, as for staging, on `production`.

If a migrate run fails, don't reseed; fix the migration on a `fix/…` branch.

## Acceptance criteria

The parts' own, plus:

- [ ] `grep -n 'USING NULL' drizzle/0030_*.sql` finds the description change, and the SQL has no other `USING` and no `RENAME`.
- [ ] **Every seed loads twice** in R16's three seed sets (`src/seed/seed-sets.test.ts`), with plain-text descriptions; row counts don't change on the second load.
- [ ] `git diff $(git merge-base HEAD origin/staging) -- e2e src scripts | grep -n '^+.*\(\.skip(\|\.fixme(\|\.only(\)'` finds nothing (`skipIf` is allowed).
- [ ] `grep -rn '/admin/brackets/\|/admin/placements/\|/bracket"\|/games"\|/participation"' src scripts e2e` finds only the redirect pages and tests that prove the redirects.
- [ ] `docs/agents/testing.md`'s smoke and e2e rows describe the new page, its locks, Hosts from the roster, the rich-text description and Log a Game from admin, and name no retired route.
- [ ] `/about` copy and stills (`pnpm tsx scripts/about-media.ts --stills`), `docs/maintainers-guide.md` (including the reset as how R18 reached staging and prod) and `docs/regression-checklist.md` (the Organizer and Host admin lines) updated where user-visible.
- [ ] `CONTEXT.md`: the **Competition page** (admin), settings and run area, and which settings lock; a Competition's **description** is rich text; **Hosts** are picked from the roster by name. **Reset bracket** is not added (cut; see Comments).
- [ ] Each part file records its closeout and is `done`; this epic records the work-package closeout (evidence paths, vitest summary with skipped count, gate result) and the PR URL.
- [ ] The PR description lists the human prerequisite as a post-merge step for Paul.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

## Comments

- 2026-10-03 (Paul): grilled and approved; tickets `ready-for-agent`.
- 2026-10-03 (atlas-implement, R15): when these forms are rebuilt, keep the "forms seeded from server data follow it after a save" rule (`docs/maintainers-guide.md`, UI) and the ticket 89 case: save, leave, return, and the saved values show (`e2e/regression-r15-games-settings.spec.ts`).
- 2026-10-03 (red-team pass 1): BLOCKED, 1 blocking (the description migration unspecified, with no old-row test, seed conversion or deployed-data decision), 9 warnings, 7 minor.
- 2026-10-03 (Paul, on pass 1): B1 don't convert old data, reset staging and prod as a human step; W1 Format locks once any result exists; W2 what affects how the game runs can't change once it started, but name, description and Placement Points can; W3 add the tests; W4 anyone who can sign in can be a Host; W5 add redirects where needed; W6 images by URL only, no upload; W7 build the epic as one work package; W8 one work package, and Reset bracket wasn't asked for: lock with no reset (today's "confirm to clear and start over" goes too); W9 and the minors at the agent's discretion. Applied: one work package with part order and serial shared files (W7, W8); the migration `USING NULL`, seed conversion and the human reset (B1); Format changes between any Formats until a result exists, applying the new Format's create defaults (W1); one lock table, enforced server-side, with name, description, Group, Hosts and Placement Points never locked (W2); server-side Host and Participant refusals and no emails sent to Hosts (W3); only `@jahnelgroup.com` roster emails pickable (W4); every old route redirected and its callers updated (W5); images by URL, sanitised on write and render (W6); the list preview left to ticket 105, and R19 now blocked by R18 (W7); Reset bracket and the forced clear removed (W8); test data per spec (W9); autosave for non-string fields, Standings named, a similar-names fixture, description size, 308 redirects, CONTEXT entries, evidence path, seed and migration together (M1–M7).

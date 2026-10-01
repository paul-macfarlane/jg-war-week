# Epic R5: Admin on a phone

**What to build:** Tickets 30 to 38, from the 375x812 pass on staging on 2026-09-30: the participant side is fine on a phone, `/admin` isn't. A one-row admin header and a bottom section bar, setup rows that open in a Sheet, lists that fit a phone, Save in reach, 44px controls, selects and the color picker that behave on touch, the seed warning trimmed, the pinned Announcement card fitted to its content, and four Bracket bugs found while building test fixtures (38).

**Tickets:** `30`, `31`, `32`, `33`, `34`, `35`, `36`, `37`, `38` (files under `../issues/`)

**Branch:** `feat/regression-r5-admin-on-a-phone`

**Blocked by:** none

**Status:** ready-for-agent

**Red-team:** not required (no schema, auth or access change; `docs/agents/planning.md`).

## Order and parallelism

By file ownership:

1. In parallel, no shared files:
   - `30`: `src/components/admin-shell.tsx` (+ a new client nav component), `admin-shell.test.tsx`, smoke `admin.ts`/`hosts.ts` if the nav marker changes.
   - `31`: `teams-editor.tsx`, `competitions-editor.tsx`, `setup-row.tsx`, `src/lib/setup-row-focus.ts`, `e2e/regression-r1.spec.ts`.
   - `32`: `src/app/admin/points/page.tsx`, `points/[id]/page.tsx`, `announcements/page.tsx`, `awards/page.tsx`, `points-entry-form.tsx`, `award-form.tsx`.
   - `34`: `confirm-dialog.tsx`, `announcement-admin-buttons.tsx`, `setup-schedule-faq-buttons.tsx`, `setup/schedule/page.tsx`, `setup/faq/page.tsx`, `rich-text-editor.tsx`, `ui/combobox.tsx`, `jg-email-chips.tsx`.
   - `35`: `ui/select.tsx`, `option-select.tsx`, `color-field.tsx`.
   - `37`: `announcement-card.tsx` / `rich-text.tsx`.
   - `38`: `bracket-view.tsx`, `bracket-tree.tsx`, `entity-combobox.tsx`, `bracket-builder.tsx` (Format help text only), `bracket-results.tsx`, `games-builder.tsx` (closed note only).
2. After those:
   - `33` after `30`: its sticky bar sits above 30's section bar. Owns `war-week-settings-form.tsx` and any other long form it measures (not `award-form.tsx` until 32 is in).
   - `36` after `31` and `34`: it edits the Setup pages 34 touches (Schedule, FAQ) and `scripts/smoke/setup.ts`, which 31 may touch.

32 and 34 meet only in look: 32's cards use `ConfirmActionButton`, whose size 34 changes. Take 32's 375px screenshots after 34 lands.

## Not covered by the pass

- Save, delete and confirm flows weren't run end to end on a phone; each ticket's Playwright checks cover its own.
- Bracket screens were tested on `[Test]` fixtures in War Week XI on staging (see ticket 38's Source); Games screens weren't.

## Acceptance criteria

Each ticket's own acceptance criteria, plus:

- [ ] `/about` and `docs/maintainers-guide.md` updated where the change is user-visible (the team's showcase rule; at least the admin section bar and Setup rows in a Sheet in the guide).
- [ ] Playwright visual check of `/admin`, `/admin/points`, `/admin/setup/teams`, `/admin/setup/competitions`, `/admin/setup/war-week`, `/admin/announcements` and `/admin/awards` at 375x812 and 1280px, as an Organizer and (where allowed) a Host, with no horizontal page scroll at 375px. Screenshots under `test-results/e2e/<test>/`.
- [ ] Each ticket file records its closeout and is set to `done` in this branch.
- [ ] CI on the PR runs smoke and e2e, and passes.
- [ ] `pnpm gate` passes locally.

## Comments

- 2026-09-30: created from the mobile regression pass (ticket 18). All nine tickets (30-38) `ready-for-agent`, for one `/atlas-implement` run.
- 2026-09-30: `[EXECUTION PLAN]` in [`R5-execution.md`](./R5-execution.md) (`/atlas-plan`; red-team not required).
- 2026-09-30: `[SCOPE CHANGE]` (Paul): fix the e2e flakes failing CI on `staging` as deliverable D0, first; see `R5-execution.md`.

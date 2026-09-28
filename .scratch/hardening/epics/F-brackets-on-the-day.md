# Epic F: Brackets on the day

**What to build:** The part of ticket `16` that helps people follow and run a Bracket during War Week, as one work package, one branch and one PR into `staging`. It covers Heat times and places plus Now/Next (T13), live refresh on the bracket page and MCP `get_bracket` (T14), a Finale for a Bracket (T6 extra), and seeding by Standings (W2). None of it adds a Format, a role or a new kind of write.

**Tickets:** `16` (item 5 of its Order table; from "Also carried": the Finale for a Bracket, T14's live refresh and `get_bracket`, W2's by-Standings seeding); files under `../issues/`

**Branch:** `feat/hardening-f-brackets-on-the-day`

**Blocked by:** Epic E (its PR #84 merged into `staging`)

**Status:** done

**Red-team:** required. Heat times add columns to `heat`, a Drizzle schema change (`docs/agents/planning.md`).

## Named needs

- **Participant:** "When and where is my next Heat?" The Participant view already pins "Your next Heat", but without a time or place. The home page's Now/Next ignores Heats.
- **Host and Organizer:** they see results land on an open bracket page without reloading it, and seed a Bracket from how Entrants are doing so far instead of only at random.
- **Organizer at the closing ceremony:** a finalized Bracket's champion is crowned on the projector the way the Finale crowns the War Week.
- **Claude user:** asks "who's in the Catan final?" through MCP.

## Order

1. **Heat time and place (T13).** A Heat gets an optional Day, start time (ET, like Schedule Items) and location, set by the Competition's Host or an Organizer from the results screen. Brackets spec stories 13 and 22 ("Your next Heat" shows the time and location).
2. **Now/Next includes timed Heats** (story 24). Heats with a Day and start time join the Schedule's now/next under the same ET rules (60 minutes when there's no end). A Heat is never merged with a Schedule Item that links the same Competition; both show. Reset Heats and Heats that are already decided drop out.
3. **Live refresh** (story 25). An open bracket page, both the participant view and the admin results screen, refreshes about every 10 s by reusing `src/components/auto-refresh.tsx`. The refresh never discards an unsaved result the Host is entering.
4. **MCP `get_bracket(competition)`** (story 26). Read-only. It returns the Format, the Rounds and Heats with their Entrants, places, scores, time and location, and the champion once finalized. It never returns emails, the Organizer list or Host lists (MCP policy row in `docs/agents/planning.md`).
5. **Seeding by Standings** (story 9, W2 without drag). The builder offers "By Standings" next to random. Teams are ordered by Team Standings and Participants by individual Standings; ties and Entrants with no points fall back to random order. Seed Positions can still be re-rolled or regenerated as today.
6. **Finale for a Bracket.** A finalized Bracket can be played as a Finale, counting its final placings in from last to first and ending on the champion. It follows the Finale rules (CONTEXT.md): it never reorders or recomputes Standings, and reduced motion shows the final state. Any signed-in JG user can open it; the link shows on the finalized Bracket.

## Acceptance criteria

Brackets spec (`.scratch/brackets/spec.md`) stories 9 (by Standings only), 13, 22, 24, 25 and 26, and its Surfaces decisions for Now/Next, live refresh and MCP, plus:

- [ ] Unit tests for Now/Next with timed Heats, driven by `?at=`: a Heat before, during and after its window; a Heat with no Day or no time (never shown); a Heat and a Schedule Item on the same Competition (both shown); a decided or reset Heat (not shown).
- [ ] Unit tests for by-Standings seeding: Teams and Participants, ties, Entrants with no Points Entries, and a single-elimination and a Heats Bracket generated from the result.
- [ ] `get_bracket` has tests like the other MCP tools (unknown Competition, a `points` Competition, an unfinalized and a finalized Bracket, no email in any response), and smoke calls it on `/api/mcp` with the token.
- [ ] Access tests: only an Organizer or that Competition's Host can set a Heat's time and place; a Participant, and a Host of a different Competition, are refused. Every action still runs `authorize` first (ADR 0003).
- [ ] The migration applies to the seeded local database; every seed still loads twice; smoke passes on it. Existing Heats keep working with no time.
- [ ] Playwright extends the single-elimination Bracket flow: the Host sets a Heat's time and location; the Participant sees them in "Your next Heat" and in Now/Next on the home page (`?at=` pinned); the finalized Bracket's Finale plays to the champion.
- [ ] Screenshots at 375px and 1280px of the results screen with a time set, the participant view, Now/Next with a Heat, and the Bracket Finale; zero horizontal overflow at 375/768/1280.
- [ ] Single elimination and Heats behave as before for Brackets with no times; the existing engine, mutation, smoke and Playwright bracket checks pass unchanged in what they assert.
- [ ] CONTEXT.md (Heat, Now/Next and Finale rules), `/about` copy and media, the Organizer guide and `docs/maintainers-guide.md` match every user-visible change.
- [ ] Ticket 16 records a `[PROGRESS]` comment for this slice and its `Status:` line is unchanged; this epic records its closeout and is set to `done` in this branch.
- [ ] `pnpm gate` passes locally and in CI.

## Out of scope

- Drag seeding, round robin and the Archive bracket view: cut from ticket 16 (Paul, 2026-09-27).
- Squads and self-report: Epic G.
- The Slack champion post: waits on Slack posting (ticket 17).
- Double elimination: only on request.

## Comments
- 2026-09-27 [EXECUTION PLAN]: written to `./F-execution.md`. Red-teamed three times: pass 1 blocked (2 blocking, resolved), pass 2 blocked (1 blocking, resolved), pass 3 `ATLAS_RED_TEAM_PASS` (4 minors, applied). Paul accepted every open-decision default, including refilled reset Heats showing in Now/Next. Ready for `/atlas-implement`.
- 2026-09-27 [PROGRESS]: `/atlas-implement` started on `feat/hardening-f-brackets-on-the-day` from `staging` at `a5a6507`; status `in-progress`. Execution follows `./F-execution.md` (waves D1; D2–D4 in parallel worktrees; D5; D6).
- 2026-09-27 [PROGRESS]: D1–D6 integrated at `ae65010`; status `ai-review`. Aggregate AI code review started.

### [AI CODE REVIEW] Epic F (2026-09-27)

Two independent reviewers (opus) read `a5a6507..adfebe0` (excluding `test-results/`, `drizzle/meta/`, `public/`). The orchestrator adjudicated each finding against the cited hunks. Fixes are in `fe6bf6d`.

**Implementation and spec conformity**
- T-F1 **blocking**, resolved. The builder's one `ConfirmDialog` hard-coded the Heat Result copy and the "Clear results" label, so decision 3's "This clears N Heat times." never showed, and a re-draw with times but no results falsely spoke of results. The dialog now takes the action's description and label: "Clear times" when only times clear. A pure `forceableConfirmCopy` helper decides the copy and is unit-tested.
- T-F2 resolved. An unchanged "Save Heat settings" no longer asks to clear times; saving it doesn't rebuild the Heats.
- T-F3 resolved. Individual Standings list only Participants with a Points Entry, so a Participant with none was seeded below net-0 and net-negative Participants. Seeding by Standings now groups by total and counts that Participant as 0; a new test covers it.
- T-F4 resolved. `get_bracket` returns the champion only once finalized (Order 4), with a new test and the tool description updated.
- T-F5 resolved at closeout: ticket 16 `[PROGRESS]`.
- T-F6 resolved. The authorize-first action test also asserts the `authorize` arguments and that the mutation never runs.
- Coverage judged sufficient: the reviewer checked every AC, ADR 0003's path, the migration, Now/Next filtering, `getTimedHeats`, the `get_bracket` whitelist and the Finale's 404 path against the code.

**Coding standards**
- S-F1 resolved. Bare "seed" in user copy (glossary: "seed position" or "seeding") is reworded: "Seed Positions drawn by Standings", "draw its Seed Positions By Standings".
- S-F2 resolved. Toasts are now "Time and place saved" and "Time and place cleared", with no trailing period like the rest.
- S-F3 resolved. A deleted Day nulls `day_id` but keeps `start_time`. The form now pre-fills the time only with a Day and offers Clear for a leftover time, and `get_bracket` returns a start time only with a date.
- S-F4 resolved. "match" is gone from the `getCompetitionByName` tests and docstring.
- S-F5 **deviation approved**. The Space-to-start handler is repeated in `bracket-finale.tsx`, because the plan moved `useFinale` unchanged.
- S-F6 resolved: small idiom fixes (`nextWhen`, plain JSX text, a redundant annotation).
- Conformant: ADR 0001 layering of the new pure modules, ADR 0003, ADR 0004, shadcn and app wrappers only, a generated migration, static-render tests with no new dependencies, and the showcase rule.

Remaining risks: the Time & place form's field wiring is proved by e2e only (no component test can open a Sheet without jsdom); the reduced-motion e2e check allows 2 s against a 3.9 s count-in.

### [CLOSEOUT] Epic F (2026-09-27)

Branch `feat/hardening-f-brackets-on-the-day`, PR https://github.com/paul-macfarlane/jg-war-week/pull/88. Verified `pnpm format:check && pnpm gate` on `fe6bf6d` (local Postgres 17, Chromium, `DATABASE_DRIVER=pg`): exit 0; 95 files / 2319 tests; smoke 179 ok, 0 not ok; e2e 23 passed. CI runs on the PR.

| Criterion | Verdict | Evidence |
|---|---|---|
| Now/Next unit tests with timed Heats (`?at=`; before/during/after; no Day or no time; Heat and Schedule Item both shown; decided or reset Heat hidden) | PASS | `src/lib/bracket/now-next.test.ts`, `src/lib/schedule.test.ts`, `src/queries/schedule.test.ts` in `test-results/hardening-f-gate/gate.txt` |
| By-Standings seeding unit tests (Teams, Participants, ties, no Points Entries, single elimination and Heats generated) | PASS | `src/lib/bracket/seeding.test.ts` in `gate.txt` |
| `get_bracket` tests and smoke with the token | PASS | `src/mcp/bracket.test.ts`, `src/queries/competitions.test.ts`; smoke `bracket loop` in `gate.txt` |
| Access: only an Organizer or that Competition's Host sets a Heat's time; `authorize` first | PASS | `access.test.ts`, `actions/brackets.test.ts`, `mutations/brackets.test.ts`; smoke "every family" refusals and "setHeatSchedule as a Participant is refused" in `gate.txt` |
| Migration on the seeded local DB; seeds load twice; smoke; old Heats unaffected | PASS | `test-results/hardening-f-migrate/{before,after}.json`, `migrate.txt`; `gate.txt` |
| Playwright: Host sets time and place; Participant sees it in "Your next Heat" and Now/Next; the Bracket Finale plays | PASS | `e2e/bracket.spec.ts` in `gate.txt` (also reduced motion) |
| Screenshots 375/1280 of the four screens; zero overflow 375/768/1280 | PASS | `test-results/e2e/bracket-a-Bracket-is-built-537c3-nalized-into-Points-Entries-chromium/{results-timed,participant-timed,now-next-heat,bracket-finale}-{375,1280}.png`; overflow assertions in `gate.txt` |
| Single elimination and Heats unchanged without times | PASS | `test-results/hardening-f-gate/unchanged-diff.txt`: no pre-existing assertion removed. The only removed lines are moved e2e helpers, imports, a longer flow timeout, the extended smoke check name and the `heatNameAt` refactor. `bracket-heats.spec.ts` changes imports only. |
| CONTEXT.md, `/about`, Organizer guide, maintainer's guide current | PASS | `test-results/hardening-f-docs/grep.txt` (stale copy gone; banned-term counts unchanged from `staging`); `public/about/brackets.png` |
| Ticket 16 `[PROGRESS]`, Status unchanged; epic closeout and `done` | PASS | ticket 16 and this file |
| `pnpm gate` locally and in CI | PASS (local); CI on PR #88 | `gate.txt`; PR #88 checks |

Deliverables (workers):
- D1 schema and write (sonnet; the first worker was interrupted, a fresh sonnet worker finished from its WIP)
- D2 seeding by Standings (sonnet)
- D3 time and place UI, Now/Next, live refresh (opus)
- D4 `get_bracket` (sonnet)
- D5 Bracket Finale (opus)
- D6 flow, docs and About (opus)
- Review fixes (sonnet)

Wave 2 ran in parallel worktrees with no conflicts.

Deviations:
- the Time & place Sheet has a "No Day" option and a Clear button;
- the admin results page refreshes live;
- the builder's confirm title is shorter when only times clear;
- a shared cached helper for the Finale route;
- e2e cleanup by `e2e-%`;
- a local `checkViewports` copy;
- llms.txt page lines;
- a 2 s reduced-motion wait;
- toasts without a trailing period (the plan quoted "Time and place saved.");
- S-F5.

Follow-ups: none new; Epic G remains for ticket 16.

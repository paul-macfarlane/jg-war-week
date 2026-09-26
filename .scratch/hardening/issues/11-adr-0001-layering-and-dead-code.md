# 11: Restore ADR 0001 layering; remove duplication and dead code

**What to build:** A behavior-preserving cleanup, so the codebase matches its own design rules and is easy for one maintainer to change. Absorbs `.scratch/war-weeker/issues/30` and the deferred review items listed below.

**Blocked by:** 03, 13 (refactor behind the test net)

**Status:** ai-review

## Scope

- **Layering:**
  - `src/lib` must not import `src/seed`. Today `lib/setup.ts:12`, `lib/setup-schedule-faq.ts:7` and `lib/war-week-lifecycle.ts:13` import `@/seed/schema`, while `seed/schema` imports lib. Move the shared schema pieces down into lib.
  - `lib` must not read the clock: `resolveClock` → `new Date()` (`lib/schedule.ts:177`). Pass the time in.
  - `src/lib/more-links.ts` imports lucide icons, but lib is meant to be pure. Move the icons to components.
  - Mutation signatures take `(input, ctx)` as the ADR says. `DEFAULT_SETTINGS` moves out of mutations.
- **Duplication:**
  - `organizerContext` and `revalidateWarWeek`, copied in 4 action files
  - `refusingDuplicate` (`mutations/setup.ts:47`, `setup-schedule-faq.ts:21`)
  - `organizerWarWeekColumns` (`queries/points-entries.ts:139`, `announcements.ts:61`, inline in `awards.ts:156`)
  - six or more uuid checks (`isCompetitionId`, `isAnnouncementId`, `isAwardId`, `isPointsEntryId`, `isSetupItemId`, `isRowId`, plus inline `z.uuid()`)
  - hex parsing in `color.ts` and `theme.ts`
  - `useWide` vs the media-query hook
  - the Team swatch mapping, written twice
  - `ActionResult` vs `MutationResult`
  - regex constants shared with `src/lib/setup.ts`
- **One `revalidatePath` rule.** Per edition, plus `/` only when the header or Archive changes.
- **From ticket 30:**
  - one upsert-and-delete-absent helper in `src/seed/load.ts`
  - Zod enums derived from Drizzle `pgEnum` `enumValues`
- **Dead code and clutter:**
  - `src/components/coming-soon.tsx`
  - the leftover `--ww-primary` alias
  - the unused `cn-toast` class
  - the unreachable `OptionSelect` placeholder
  - the multi-list API left in `finaleDurationMs`, with its stale wording
  - `withTransaction`, if still unused outside tests
  - the ~22 one-off `scripts/*-evidence.ts` files
  - Keep `scripts/about-media.ts` (decision 6).
- **Split `scripts/smoke.ts`** (4,178 lines) into modules by area, with no behavior change.
- **`cn`:** check whether the `cn@0.4.0` package merges Tailwind classes. If it doesn't, replace it with the standard shadcn `clsx` + `tailwind-merge` helper.
- **Raw `<button>` overlay on Heat cards:** replace with a shadcn component, per the repo rule.

## Acceptance criteria

- [ ] No behavior change. Existing vitest, the ticket 13 Playwright flows and smoke pass unchanged.
- [ ] A lint rule or test enforces "lib never imports seed, queries, mutations, actions or components" (for example `no-restricted-imports`).
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-26 [EXECUTION PLAN]: claimed by Atlas (`/atlas-implement`, Epic C); branch `chore/hardening-c-tests-and-layering`; deliverables D3 (layering + lint rule), D5 (dead code, evidence scripts, smoke split, Heat button) and D4 (duplication, one `revalidatePath` rule, seed helper, pgEnum-derived zod enums), all behind the ticket 13 test net; plan and verification map in `../epics/C-execution.md`. Resolved here: `cn@0.4.0` is a compiled clsx + tailwind-merge replacement (its README and engine merge Tailwind classes), so it stays.

- 2026-09-27 [AI CODE REVIEW] Epic C aggregate review of `git diff 2db3b38..7e38298`. Two independent reviewers read the diff, one per axis; the orchestrator adjudicated each finding against the cited code. Fixes landed in `d772937`, `c60e155`, `6f84220`.
  - **Technical implementation and spec conformity.** Checked correct: `resolveClock(at, now)` and its callers; every changed mutation signature and caller; `DEFAULT_SETTINGS` in lib; `useMediaQuery` server snapshots; `teamSwatches`; hex and points regexes; uuid helpers; one result type; pgEnum value order, messages and defaults; `finaleDurationMs`; the dead code gone; the smoke split's shared state (same 177 `ok` lines as Epic B); `upsertDeletingAbsent` end state per table; each action's revalidation reach (`/history` reads only War Week rows, so per-edition is enough for setup writes and Awards).
    - BLOCKING, fixed: ticket 13's "manual Points Entry racing a finalize" only flipped a column by hand. Now `finalizeBracket` really races `createPointsEntry` on two connections, in both orders: the hand entry survives and the generated entries match the Placement Points. The two writes touch different rows, so removing either Competition lock doesn't fail it; dropping `deleteGenerated`'s generated-only filter does.
    - BLOCKING, fixed: lib's pgEnum-derived zod enums pulled Drizzle `pg-core` and the table definitions into the `/admin` client chunk (orchestrator confirmed in `.next/static`). Enum tuples now live in `src/lib/enums.ts`; `src/db/schema.ts` builds its pgEnums from them (`db:generate`: no changes); lib may only type-import `@/db/schema`, enforced by lint and ADR 0001. `grep -rl 'drizzle:' .next/static` finds nothing.
    - Fixed: the lint rule now also refuses `@/db`, `@/db/local-url`, `@/db/test-transaction`, `pg`, `@neondatabase/*`, `drizzle-orm`, `@/mcp`, bare `@/app` and `@/auth`, and relative climbs out of lib; exact Team match in `e2e/standings.ts`; CI uploads Playwright results on failure; `revalidateSite()` called directly; the Heat overlay no longer shifts on press.
    - Deviation: two of the seven vitest cases (team target on an individual Competition; a same-winner re-record) tighten existing tests rather than add new ones. They test the named rules.
    - Deviation (follow-up): `e2e/bracket.spec.ts` and `finale.spec.ts` rely on the seed reset per run (Beyblades' Placement Points; the leader's row); port 3200 has no busy check; `upsertDeletingAbsent`'s column parameters aren't tied to the table type.
  - **Coding standards.** Banned-term scan clean. Action order and `(input, ctx, dbOrTx)` signatures conform. UI uses the shadcn `Button`.
    - Fixed: stale comments naming `scripts/smoke.ts` and a deleted evidence script; two stale ADR 0001 lines (UI coverage; step 4 names `revalidateWarWeek`/`revalidateSite`); dead seed re-exports and `*Seed` types; `Parsed` defined once in `src/lib/result.ts`; the smoke harness uses `WriteResult` and one host email; `finaleRows` loses the multi-list `durationMs`; the hook moves to `src/hooks/`; `OptionSelect`'s `placeholder` removed (no call site passes it; D5's report that six did was wrong); the maintainer's guide names the one-time Chromium install; `uuidSchema` un-exported; a JSDoc rewrap.
    - Deviation (follow-up): `src/lib/install-prompt.ts` is a stateful browser module in lib; the DB tests still copy the local-database guard; e2e and smoke each sign stub sessions. None is in ticket 11's list.
  - Remaining risk: `src/db/schema.ts` now imports `@/lib/enums` through the `@/` alias; drizzle-kit, tsx, the build and smoke resolve it.

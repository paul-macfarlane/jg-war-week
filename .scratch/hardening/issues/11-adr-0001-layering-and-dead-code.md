# 11: Restore ADR 0001 layering; remove duplication and dead code

**What to build:** A behavior-preserving cleanup, so the codebase matches its own design rules and is easy for one maintainer to change. Absorbs `.scratch/war-weeker/issues/30` and the deferred review items listed below.

**Blocked by:** 03, 13 (refactor behind the test net)

**Status:** ready-for-agent

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

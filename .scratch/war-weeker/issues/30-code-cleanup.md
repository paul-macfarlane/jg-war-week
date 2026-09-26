# 30: Code cleanup deferred from reviews (post-hackathon)

**What to build:** Pay down the judgment calls that earlier AI code reviews deferred.

**Blocked by:** none, but do it only after the hackathon submission on Fri 2026-09-25 10:00 AM

**Status:** wontfix (superseded by `.scratch/hardening/issues/11`)

## Scope

- **Sync-helper duplication in `src/seed/load.ts`** (ticket 03 review): the upsert-and-delete-absent pattern repeats for each entity. Extract one helper if it stays readable.
- **Enum values duplicated between `pgEnum` and `z.enum`** (ticket 03 review): derive the zod enums from the Drizzle enum values (`warWeekStatus.enumValues`, etc.) so there's one source of truth.
- Related but separate: ticket 18 (standardize form handling).
- Before starting, sweep the other tickets' `[AI CODE REVIEW]` records for more "deferred" items and add them here.

## Acceptance criteria

- [ ] No behavior change: seed tests and the smoke idempotence check pass unchanged.
- [ ] `pnpm gate` passes.

## Comments

- 2026-09-26: Superseded. Both items and the deferred-review sweep are folded into `.scratch/hardening/issues/11`.

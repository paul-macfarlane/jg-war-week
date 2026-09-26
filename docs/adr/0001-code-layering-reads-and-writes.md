# ADR 0001: Code layering for reads, business rules and writes

- Status: accepted
- Date: 2026-09-23
- Context: ticket 06 review (PR #13)

## Context

Pages and the MCP server both read War Week data. Tickets 08 onward add the
first writes: Organizer actions for Points Entries, hide/reveal,
Announcements and Awards. The seed loader already writes setup data. The spec
fixes two points: writes are server actions, and each action checks the
signed-in user's email against that War Week's organizer allowlist. It does
not say where business rules live, or how the action, the database write and
validation relate. Without a rule, each ticket would decide for itself, and
rules like "a Points Entry targets a Team only for a team Competition" would
end up implemented once in the seed and again in a form.

## Decision

Code sits in four layers under `src/`. Each layer only calls the layers
below it.

| Layer | Path | Does | Never |
|---|---|---|---|
| Entry points | `src/app/**` pages, `src/app/api/mcp/route.ts`, `src/actions/*.ts` | Parse input, check auth, call queries, mutations and lib, render or serialize | Business math or rules, raw SQL |
| Mutations | `src/mutations/<area>.ts` | Validated writes. Each takes `DBOrTx` and runs a multi-row change in one transaction | Auth, `revalidatePath`, form parsing |
| Queries | `src/queries/<area>.ts` | Load rows for one War Week and hand them to a lib function. Take `DBOrTx` | Business rules beyond the SQL filter |
| Business logic | `src/lib/<area>.ts` | Pure functions: Standings, schedule now/next, formatting, validation rules and zod field schemas | Database, `next/*`, clock reads (pass `Date` in) |

`src/mcp/*.ts` holds pure serializers from lib results to MCP tool
payloads, and sits alongside the entry points. `src/seed/` is the setup write
path. It uses the same lib rules and schemas as the Organizer actions.

### Reads (in place since ticket 05)

- A page or MCP tool calls a query, which calls a lib function. No page or
  tool does its own math: every Standings figure comes from
  `computeStandings`, and every now/next from `computeNowNext`.
- Lib functions get tested first, table-driven with vitest. Queries stay
  thin enough that the smoke test covers them.

### Writes (from ticket 08)

1. **Server action** in `src/actions/<area>.ts` (`"use server"`), in the
   order authenticate → load the target → `can` → parse → mutation:
   1. Calls `authorize` (`src/auth/authorize.ts`), which authenticates,
      loads the target row and its War Week, and runs `can`.
   2. Only then parses the input with a zod schema from `src/lib/`.
   3. Calls a mutation.
   4. Calls `revalidatePath` for the affected edition routes.
   5. Returns `{ ok: true } | { ok: false; error: string; fieldErrors? }`.
   6. Never throws on a user error.
2. **Mutation** in `src/mutations/<area>.ts`:
   - `(input, ctx: { warWeekId, actorEmail }, dbOrTx = db)`.
   - The global Organizer-list mutations take `actorEmail` rather than a
     War Week `MutationContext`, because the list has no War Week.
   - Enforces business rules by calling lib functions, then writes.
   - Uses `withTransaction` when it touches more than one row, so tests can
     run it against local Postgres.
   - Records the actor where the schema has a column for it, e.g.
     `enteredByEmail`.
3. **Rules and schemas are shared, not copied.** When a rule already lives
   in the seed schema, the first ticket that needs it outside the seed moves
   it into `src/lib/` and has both callers use it. The known cases:
   - Points Entry target versus Competition scoring (`src/seed/schema.ts`,
     `pointsEntries` refinement).
   - The `points` and `email` field schemas.
   - Rich-text content sanitizing. This one already lives in `src/lib/rich-text/`.
4. **Length limits** match the database column in both the zod schema and
   the Drizzle schema (spec convention).

### Tests per layer

- Lib: vitest, pure, and written first.
- Mutations: vitest against local Postgres in a rolled-back transaction, once
  the first mutation lands.
- Actions and admin forms: the smoke test. Testing.md already names smoke as
  the only UI and admin-form coverage.

## Consequences

- A ticket that adds a write touches four predictable places: a lib rule or
  schema, a mutation, an action, and a UI form. Reviewers can check the
  layering rule mechanically.
- Actions stay thin, so the organizer check is written once and is hard to
  skip.
- Moving the seed's rules into `src/lib/` costs a small refactor in the first
  write ticket (09 for Points Entries).
- A new folder (`src/actions/`, `src/mutations/`) appears only when its
  first file does. Nothing is scaffolded ahead of need.

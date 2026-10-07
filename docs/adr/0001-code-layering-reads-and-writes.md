# ADR 0001: Code layering for reads, business rules and writes

- Status: accepted; superseded in part by ADR 0013
- Date: 2026-09-23
- Superseded in part by ADR 0013 (Remove the MCP): the MCP server as an entry point and `src/mcp/` (the MCP route and its serializers are removed; the layering of pages, queries, mutations and lib stands).
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
| Business logic | `src/lib/<area>.ts` | Pure functions: Standings, schedule now/next, formatting, validation rules and zod field schemas | Database, `next/*`, clock reads (pass `Date` in), value imports from `@/db/schema` (types only) |

`src/mcp/*.ts` holds pure serializers from lib results to MCP tool
payloads, and sits alongside the entry points. `src/seed/` is the setup write
path. It uses the same lib rules and schemas as the Organizer actions.

lib imports only types from `@/db/schema`, so Drizzle stays out of client
bundles that use lib. The enum value lists live in `src/lib/enums.ts`;
`src/db/schema.ts` builds its pgEnums from them. ESLint enforces this.

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
   4. Revalidates through `src/actions/revalidate.ts`, the one rule:
      `revalidateWarWeek(edition)` for a write that changes only that War
      Week's routes, `revalidateSite()` when it changes the header or the
      Archive.
   5. Returns `{ ok: true } | { ok: false; error: string; fieldErrors? }`.
   6. Never throws on a user error.
2. **Mutation** in `src/mutations/<area>.ts`:
   - `(input, ctx: { warWeekId, actorEmail }, dbOrTx = db)`.
   - The global Organizer-list mutations take `actorEmail` rather than a
     War Week `MutationContext`, because the list has no War Week.
   - Enforces business rules by calling lib functions, then writes.
   - Runs a change that touches more than one row in one
     `dbOrTx.transaction(...)`, so tests can run it against local Postgres
     inside their own transaction.
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
- Mutations: vitest against local Postgres in a rolled-back transaction
  (`inRolledBackTransaction`, `src/db/test-transaction.ts`), once the first
  mutation lands.
- Actions and admin forms: smoke over HTTP (`pnpm smoke`) plus the
  Playwright flows (`pnpm e2e`).

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

## Amendment (2026-10-03): one mutation checks the role

`saveCompetitionSetting` (`src/mutations/competition-settings.ts`), the
admin Competition page's per-field autosave, checks the actor's role
itself (`can`, with the role read in its transaction), after its action has
already authorized. It is the one exception to "the action runs `can`, the
mutation enforces business rules": Epic R18 requires every per-field save
to go through one mutation that checks both the role and the setting's
lock under the Competition's row lock, so a Host can never save a field
only an Organizer may (Hosts) and a locked field is refused with the same
words the page shows. Other mutations keep the role check in the action.

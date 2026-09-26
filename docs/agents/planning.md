<!-- atlas-v3:planning:start -->
# Repository planning profile

This document is the repository's scoped planning profile. Each entry has the
authority named by its classification; the document is not blanket mandatory
policy.

Read this guide before clarifying, researching, prototyping, specifying,
decomposing, technically planning, or red-team reviewing proposed work. It
routes repository-specific concerns; generic planning mechanics remain in the
invoked skill.

| Classification | Trigger | Required consideration |
|---|---|---|
| confirmed team policy | Drizzle schema change | Red-team the plan; update the demo seed and migration together; confirm smoke still passes on seeded local Postgres. |
| confirmed team policy | Auth or access-control change | Red-team the plan; preserve Google-only sign-in and rejection of non-@jahnelgroup.com emails. |
| confirmed team policy | Finale change | Red-team not required; the Finale must never reorder or recompute Standings. |
| discovered repository fact | Any vertical slice | Gate: type-check, lint, vitest, production build, and smoke (/xi, /xi/leaderboard, /xi/finale, /api/mcp) must pass; on failure stop and report. |
| discovered repository fact | MCP tool change | /api/mcp stays read-only and accepts a signed-in @jahnelgroup.com session or `Authorization: Bearer <MCP_TOKEN>` (ticket 21); never expose emails or the organizer allowlist. |
| Atlas recommendation | Ticket lacks a clear problem, outcome, or bounded decision | Return to /grill-with-docs, /to-spec, or /to-tickets as appropriate. |
| unresolved question | Stairs app integration | No documented owner or access for the Stairs deploy; do not plan work that depends on it. |

Classifications have distinct authority: confirmed team policy is mandatory;
Atlas recommendations are proposals; discovered repository facts are evidence;
unresolved questions must not be silently converted into policy.

## Work-package plan contract

`/atlas-plan <ticket-epic-or-spec>` reads the complete stable contract, existing
technical or execution plan, dependencies, decisions, and relevant repository
areas. For tracked work it also reads state, comments, linked parent specs, and
applicable children. Its plan covers intent, affected areas and interfaces,
ordered steps, declared scope, dependencies, AC and DoD coverage, run surface,
verification commands, real-dependency checks, fixtures, and human
prerequisites. It preserves the stable contract and adequate existing plan
content.

Return an unclear or unbounded work package to `/grill-with-docs`, Wayfinder,
`/to-spec`, or `/to-tickets`; a stable repository spec is a valid input, but
`/atlas-plan` does not invoke those flows or create product specs or child
tickets from unresolved material.

## Review and publication

Red-team policy: Required only for plans that change the Drizzle schema or the better-auth / @jahnelgroup.com access restriction; skipped otherwise (Finale changes included).

Storage: **repository**. Drafts before approval:
**false**. A repository spec uses
the planning section of sibling `execution.md`; tracked work uses the configured
storage. Exact file or tracker mutations are previewed before publication. Read
`docs/agents/issue-tracker.md` for the authoritative approval, persistence, and
ticket status rules, `docs/agents/triage-labels.md` for decomposition,
`docs/agents/domain.md` for terminology, and `docs/agents/testing.md` for AC,
DoD, fixture, and verification design.
<!-- atlas-v3:planning:end -->

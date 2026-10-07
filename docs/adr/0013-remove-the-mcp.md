# ADR 0013: Remove the MCP

- Status: accepted (built in Epic R26, work package r26-cuts-and-consistency)
- Date: 2026-10-06
- Supersedes in part: ADR 0001 (the MCP route as an entry point and `src/mcp/`), ADR 0005, ADR 0007, ADR 0008, ADR 0009 and ADR 0012 (each only where it mentions the MCP)

## Context

The app exposed a read-only Model Context Protocol server at `/api/mcp`
(fourteen tools, a session or an `MCP_TOKEN` bearer token to get in) and an
`/llms.txt` that described it. No Organizer, Host or Participant need
for it was ever named, and claude.ai connectors need OAuth, which the server
never had. It still cost something every change: a
serializer and a test per tool, banned-term scanning of its output
properties, a bearer-token access rule, smoke checks for every tool, and
copy in the guide, the README, the Privacy page and the About page. The
hardening rule is to prefer removing to adding.

## Decision

Remove the MCP entirely.

- `src/app/api/mcp/`, `src/mcp/` (sources and tests), `src/app/llms.txt/`
  and `scripts/smoke/mcp.ts` are deleted, with the `mcp-handler` and
  `@modelcontextprotocol/server` dependencies and `MCP_TOKEN`.
- `canUseMcp` and `McpAccessInput` leave `src/lib/access.ts`, and the
  proxy no longer has a bearer-token branch: every API route answers 401
  without a Jahnel Group session, as before for all but `/api/mcp`.
- The banned-term scan reads UI copy only; the `src/mcp` property-name scan
  and the lint layer entries for `src/mcp` go.
- A query or helper left with no caller is deleted
  (`getArchiveDetailByYear`, `getCompetitionByName`, `attemptSummary`).
- Smoke asserts `/api/mcp` and `/llms.txt` answer 404 for a signed-in user,
  so a returning route fails the gate.
- The About page and the Privacy page no longer mention an AI connector.

## Alternatives considered

- **Keep the MCP, drop `llms.txt` only.** Rejected: the cost is in the tools
  and their access rule, not the one file.
- **Keep it behind a flag.** Rejected: an unused path nobody tests by hand
  is the kind of surface this hardening removes.

## Consequences

- Earlier ADRs keep their history and carry a "Superseded in part" line for
  their MCP mentions; `.scratch/` history is unchanged.
- Bringing a connector back later is a new decision with a named need, its
  own access rule and its own ADR.

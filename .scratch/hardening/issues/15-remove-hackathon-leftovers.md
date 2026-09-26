# 15: Remove hackathon leftovers

**What to build:** Make the repo read as a product, not a hackathon entry.

**Blocked by:** none

**Status:** in-progress

## Scope

- **Remove `MCP_PUBLIC`**, which opened the MCP endpoint to anyone for the claude.ai demo:
  - `src/proxy.ts`, `canUseMcp` in `src/lib/access.ts` and its tests, `scripts/smoke.ts`, `.env.example`, README
  - the `docs/agents/planning.md` MCP row
  - CONTEXT.md "Access rules"

  `MCP_TOKEN` and signed-in JG access stay.
- **Framing:**
  - README: drop the event and submission wording; describe the product, how to run it, and the staging and production URLs.
  - `src/app/llms.txt`: same.
  - The four existing specs' front matter drops the hackathon deadlines.
- **Committed hackathon files:** remove or move out of the repo root: `grill-me-brief.md`, `AI_Connection_Event_Agent_Optimized.md`, and stale `test-results/` evidence from past work packages (the evidence policy keeps only the latest).
- **Keep `/about`** as the public showcase. Update its copy wherever it mentions the hackathon.

## Acceptance criteria

- [ ] `grep -riE "MCP_PUBLIC|hackathon|connection event|submission"` across `src/`, `scripts/`, README and `docs/` finds nothing, except ADRs and specs recording history.
- [ ] An anonymous `POST /api/mcp` returns 401 in smoke. A bearer token and a JG session still work.
- [ ] `pnpm gate` passes.

## Comments

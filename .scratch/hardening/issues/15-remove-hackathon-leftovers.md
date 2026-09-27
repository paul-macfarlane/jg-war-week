# 15: Remove hackathon leftovers

**What to build:** Make the repo read as a product, not a hackathon entry.

**Blocked by:** none

**Status:** done

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

- [x] `grep -riE "MCP_PUBLIC|hackathon|connection event|submission"` across `src/`, `scripts/`, README and `docs/` finds nothing, except ADRs and specs recording history.
- [x] An anonymous `POST /api/mcp` returns 401 in smoke. A bearer token and a JG session still work.
- [x] `pnpm gate` passes.

## Comments

**2026-09-26, Claude (atlas-implement, epic A) — [CLOSEOUT]** Delivered by D15 (worker: sonnet, `d499032`). `MCP_PUBLIC` is removed from the proxy, `canUseMcp` and its tests, smoke, about-media, `.env.example`, README, CONTEXT.md and `docs/agents/planning.md`. README now describes the product, with the staging and production URLs and the claude.ai connector limit. The four specs' `deadline:` lines, `grill-me-brief.md` and `AI_Connection_Event_Agent_Optimized.md` are gone, and the orchestrator cleared the stale `test-results/`. `/about` and `llms.txt` had no hackathon copy to change. Per Paul: root `about.md` and CLAUDE.md's "Post-hackathon" line stay.
- AC1 PASS: `test-results/hardening-a-leftovers/grep.txt` (the only matches are the ADRs, which record history)
- AC2 PASS: `ok - anonymous POST /api/mcp answers 401`, wrong token 401, and bearer token with no session works (smoke in `test-results/hardening-a-gate/gate.txt`). The session path is covered by the smoke MCP checks.
- AC3 PASS: `test-results/hardening-a-gate/gate.txt`
- PR: https://github.com/paul-macfarlane/jg-war-week/pull/78

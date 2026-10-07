---
title: Cuts and admin consistency (Epic R26)
status: ready-for-agent
grilled: 2026-10-06 (see ../regression-2026-10/grilling-2026-10-06.md)
created: 2026-10-06
source: Paul's final regression feedback, items B1, S1, S2, S4–S6, S12–S16 (../regression-2026-10/feedback-final.md)
---

# Cuts and admin consistency

**Epic:** R26 · **Branch:** `feat/r26-cuts-and-consistency` · **Blocked
by:** none · **Red-team:** not required (no schema or access change) ·
**Status:** ready-for-agent

## Summary

Paul's final regression pass found two features nobody needs and a set of
places where admin behaves differently from the rest of itself:

- **Cuts.** The MCP has no real use case, and Create next War Week copies
  settings, Competitions and the FAQ from a War Week that the next one
  won't resemble.
- **Create next War Week** sits inside the current War Week's settings and
  can be used while that War Week is still running.
- **Create and edit** are a page for Announcements and a dialog for nearly
  everything else.
- **Entrants** need a Save button while every other Competition field
  autosaves, and Head-to-head picks its two sides from a multi-select.
- **Participation**: ticking a Participant unchecks itself, then is
  rejected.
- **Brackets** repeat "A later Match already used this result." on almost
  every decided Match, and small ones hug the left edge.
- **Competitions list**: the group tab isn't in the URL, so Back loses it.
- **`/about`**: the "What it does" images are too small to read, and the
  three-phone Standings image doesn't earn its place.

## Decisions

1. **Remove the MCP entirely.**
   - Delete `src/app/api/mcp/`, `src/mcp/` (sources and tests),
     `scripts/smoke/mcp.ts`, the `mcp-handler` and
     `@modelcontextprotocol/server` dependencies, and `MCP_TOKEN` from
     `.env.example`.
   - Delete `llms.txt` (`src/app/llms.txt/`): it is generated from the MCP
     tool list and existed to point agents at it.
   - Remove the `canUseMcp` branch from `src/proxy.ts`, `McpAccessInput` /
     `canUseMcp` from `src/lib/access.ts` (and their tests), the MCP and
     `llms.txt` checks from `scripts/smoke/` (`index.ts`, `harness.ts`,
     `pages.ts`), `askMcp` from `scripts/about-media.ts` and
     `scripts/media/demo.ts`, the MCP entries in `eslint.config.mjs`, and
     the `src/mcp` scan in `src/lib/banned-terms.test.ts`.
   - Delete any query or helper left with no caller.
   - Docs: `README.md`, `docs/maintainers-guide.md`, `CONTEXT.md`,
     `about.md`, the privacy page, `docs/regression-checklist.md`,
     `.github/workflows/ci.yml` comments, and `docs/agents/testing.md` (the
     MCP mentions in its commands). In `docs/agents/planning.md`, drop
     `/api/mcp` from the slice-gate smoke list and remove the "MCP tool
     change" row. Code comments that mention the MCP are reworded or
     dropped. ADRs and `.scratch/` history stay as written; an ADR records
     the removal (superseding the MCP parts of earlier ADRs).
2. **Create next War Week copies nothing.** The copy options (Settings,
   Competitions, FAQ) and their code go. The new War Week starts `upcoming`
   with default settings, no Competitions and no FAQ.
3. **Create next War Week lives in Lifecycle.**
   - The "Create next War Week" section leaves the Settings form. A
     **"Create next War Week"** button sits in the Lifecycle section and
     opens the form (edition, number, year, dates, story theme) in a
     `ResponsiveSheetDialog`.
   - It shows **only** when the War Week being viewed is the **latest by
     start date** and is `complete`. Otherwise there is no button and no
     hint.
   - The server enforces the same rule: creating while the latest War Week
     (by start date) is `upcoming` or `live` is refused.
4. **One rule for create and edit.** A **record** is created and edited in
   the same dialog (`SetupSheet` / `ResponsiveSheetDialog`); only a thing
   you **run** gets a page, which today is a Competition (created in a
   dialog, then run on its page).
   - Announcements follow it: New and Edit open the same dialog from the
     Announcements list. `/admin/announcements/new` and
     `/admin/announcements/[id]` are deleted. On a phone the dialog is a
     full-height sheet with the rich-text body.
   - Every other admin entity already follows the rule. The rule is
     written into `docs/maintainers-guide.md` and `CONTEXT.md`.
5. **Entrants autosave.** `EntrantsPicker` loses its Save button and saves
   with the existing autosave (`src/lib/autosave.ts`,
   `AutosaveStatusLine`) on Head-to-head, Bracket and League. A refusal
   (for example a lock once results exist) shows the server's message and
   reverts the picker to what was saved.
6. **Head-to-head picks "A vs B".** Head-to-head's Entrants become two
   single pickers side by side: `ParticipantPicker` for individual scoring,
   the Team combobox for team scoring. Each leaves out the other's choice.
   The pair autosaves once both are set; clearing one leaves the saved pair
   unchanged until both are set again.
7. **Fix the participation checkbox (bug).** Ticking or unticking a
   Participant in `participation-builder.tsx` holds its new state until
   the refreshed data arrives, and a refusal reverts it and shows the
   server's reason. Likely cause, to be confirmed by reproducing first: the
   optimistic entry is deleted right after an un-awaited `router.refresh()`.
   A regression test reproduces the glitch before the fix. The layout is
   unchanged (S3: leave it).
8. **Locked Bracket Matches.** "A later Match already used this result."
   (and the Group Bracket "A later round already has a result…") no longer
   prints under every locked Match. A locked Match shows a **lock icon** and
   its disabled Edit and Clear controls carry the reason as a **tooltip**
   (reachable by keyboard focus and by tap on a phone). The lock rule itself
   is unchanged.
9. **Center small Brackets.** A Bracket tree narrower than its space is
   centered horizontally on the Participant page and in admin; a wider one
   starts at the left and scrolls as now. "Jump to your Match" still works.
10. **The Competition group tab is in the URL.** The Participant
    Competitions list's tabs read and write `?group=<slug>` with history
    **replace**, so Back from a Competition returns to the tab that was
    open, and an unknown or missing value opens the first tab.
11. **`/about` "What it does".** The three-phone Standings demo
    (`about-standings-demo.tsx` and its stills) is removed. "What it does"
    becomes one feature per row: the still fills the content column, with
    its caption beside it on desktop and below it on a phone. A feature
    whose still is still unreadable at that size is cut.

## Acceptance criteria

- [ ] `/api/mcp` and `/llms.txt` return 404, no source file imports
      `src/mcp`, `MCP_TOKEN` appears nowhere in code or `.env.example`, and
      both MCP packages are gone from `package.json` (smoke; grep).
- [ ] Create next War Week has no copy options and creates an `upcoming`
      War Week with default settings, no Competitions and no FAQ (vitest).
- [ ] The Lifecycle button shows only on the latest War Week by start date
      when it is `complete`, and the server refuses creation otherwise
      (vitest on the rule; e2e for the button).
- [ ] An Organizer creates and edits an Announcement in the dialog; the old
      `/new` and `/[id]` routes return 404 (e2e at 1440 and 390; smoke).
- [ ] Changing Entrants on Head-to-head, Bracket and League saves with no
      button and shows the autosave status; a locked change shows the
      server's message and reverts (e2e).
- [ ] Head-to-head shows two pickers, each excluding the other's choice,
      saving once both are set (e2e).
- [ ] Ticking a Participant stays ticked through the save; a refused tick
      reverts with the reason (regression test written first, failing on
      today's code).
- [ ] A decided Bracket with later results shows lock icons, no repeated
      message, and the reason as a tooltip on the disabled control (e2e,
      screenshots at 1440 and 390).
- [ ] A 4-Entrant Bracket is centered and a 64-Entrant one starts at the
      left and scrolls (screenshots at 1440 and 390).
- [ ] Choosing a group tab sets `?group=`; opening a Competition and going
      Back returns to that tab without extra history entries (e2e).
- [ ] `/about` has no three-phone demo and shows one feature per row with
      readable stills in light and dark (screenshots at 1440 and 390).

## Out of scope

- The participation layout (S3, left as is).
- Any change to the Bracket lock rule.
- Replacing the MCP with another integration.
- A schema change of any kind.

## Definition of Done

- [ ] ADR recording the MCP removal.
- [ ] `docs/agents/planning.md` and `docs/agents/testing.md` updated for
      the MCP removal (slice-gate smoke list, MCP rule, command coverage).
- [ ] `CONTEXT.md`, `docs/maintainers-guide.md` (the create/edit rule),
      `docs/regression-checklist.md` (every changed page at both
      viewports) and `/about` copy and media updated.
- [ ] e2e screenshots at 1440 and 390 committed under `test-results/e2e/`.
- [ ] `pnpm format:check && pnpm gate` passes; CI on the PR passes.

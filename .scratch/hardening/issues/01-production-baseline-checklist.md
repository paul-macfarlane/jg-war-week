# 01: Production baseline checklist (phase 0)

**What to build:** Nothing. These are Paul's manual steps, so production matches `staging` and has been checked before hardening changes land.

**Blocked by:** none

**Status:** ready-for-human

## Steps

Each step lists the action, the expected result, and the check afterwards.

- [ ] **Reset the seed on staging.** Run the Seed workflow with `confirm_reset`. Expected: the stale `mvp` and `spirit` Awards are gone. Check: `/xi/awards` lists only the seeded Awards. (Moved from `.scratch/war-weeker/issues/29`.)
- [ ] **Promote staging → main.** Open and merge the `staging` → `main` PR. Expected: production runs PRs #65–#71. Check: `pnpm smoke`-equivalent pages load on production: `/xi`, `/xi/leaderboard`, `/xi/finale`, `/api/mcp` with the token.
- [ ] **Reset the seed on production** the same way, after promoting.
- [ ] **Confirm `MCP_PUBLIC` is unset or `false` on production and staging** (Vercel project env). Expected: an anonymous `POST /api/mcp` gets 401.
- [ ] **Real Google sign-in check** (from `.scratch/war-weeker/issues/08`). Expected: an `@jahnelgroup.com` account signs in; a personal Gmail is refused and no user row is created.
- [ ] **OAuth consent screen** (from `.scratch/admin-polish` AC-oauth-consent). Set the logo, home page and privacy/terms URLs on the `jg-war-week` domain (not the old `war-weeker` one), and keep the user type Internal.
- [ ] **PWA install check on a real phone** (from `.scratch/war-weeker/issues/14`): install on iOS or Android; the app opens standalone with the right icon.
- [ ] **Old wiki links.** Spot-check the guessed `war-week-<year>` wiki links in the Archive. Decide whether past-year Slack links pointing at the workspace root are acceptable. Record the answer here.
- [ ] **Legal copy.** Send `/privacy` and `/terms` to whoever at JG should review them, or record that no review is needed.

## Comments

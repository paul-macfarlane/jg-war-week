# D4 evidence (ticket 08), commit 51b109d

- `pnpm vitest run` (worktree database `war_weeker_d4`, migration-copy test excluded): Test Files 67 passed, Tests 1216 passed.
- `src/auth/trusted-origins.test.ts`, 5 tests:
  - production gives only the base origin
  - a preview adds exactly its two Vercel hosts
  - a preview with a missing or blank branch URL adds only the deployment host
  - normalizes values that already carry a scheme or trailing slash
  - has no duplicates when the deployment host equals the branch alias
- OAuth finding: better-auth builds Google's `redirect_uri` from `BETTER_AUTH_URL` (`node_modules/better-auth/dist/api/routes/sign-in.mjs:228`, `utils/url.mjs:68-71`), not from `trustedOrigins`. So sign-in on a branch alias also needs that alias's `/api/auth/callback/google` registered in the Google OAuth client, and `BETTER_AUTH_URL` for the preview set to the alias. This is the human step recorded on ticket 08.

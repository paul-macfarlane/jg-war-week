import { loadEnvConfig } from "@next/env";

// The same env the app gets from `.env.local`, as `scripts/smoke/index.ts` loads it.
loadEnvConfig(process.cwd());

// E2E_PORT lets parallel worktrees run e2e side by side.
export const E2E_PORT = Number(process.env.E2E_PORT || 3200);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/**
 * Signs the e2e session cookies and is handed to the server. Deterministic,
 * not random: Playwright re-imports this module in every worker, and the
 * worker that signs a cookie must use the server's secret.
 */
export const E2E_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "e2e-only-secret-never-used-in-production";

/** A Host once a flow gives it a `competition_host` row; not an Organizer. */
export const E2E_HOST_EMAIL = "e2e-host@jahnelgroup.com";

/** e2e users never share an email with a real person. */
export const E2E_EMAIL_PATTERN = "e2e-%";

/**
 * Test sign-in's secret for the e2e server: a fixed 40-character test value,
 * not a secret. Test sign-in is never on in Production.
 */
export const E2E_TEST_SIGN_IN_SECRET =
  "e2e-test-sign-in-secret-not-a-real-value";

/**
 * e2e users outside `E2E_EMAIL_PATTERN` (a `+` alias can't start `e2e-`),
 * removed by exact match.
 */
export const E2E_EXACT_EMAILS = ["e2e+linked@jahnelgroup.com"];

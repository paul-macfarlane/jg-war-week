import { loadEnvConfig } from "@next/env";

// The same env the app gets from `.env.local`, as `scripts/smoke/index.ts` loads it.
loadEnvConfig(process.cwd());

export const E2E_PORT = 3200;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/**
 * Signs the e2e session cookies and is handed to the server. Deterministic,
 * not random: Playwright re-imports this module in every worker, and the
 * worker that signs a cookie must use the server's secret.
 */
export const E2E_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "e2e-only-secret-never-used-in-production";

/** e2e users never share an email with a real person. */
export const E2E_EMAIL_PATTERN = "e2e-%";

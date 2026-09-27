import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

import { E2E_AUTH_SECRET, E2E_BASE_URL, E2E_PORT } from "./e2e/env";
import { isLocalDatabaseUrl } from "./src/db/local-url";

// Checked here, not in globalSetup: Playwright starts the webServer before
// globalSetup runs, and neither check should wait on it.
if (
  !isLocalDatabaseUrl(process.env.DATABASE_URL, process.env.DATABASE_DRIVER)
) {
  throw new Error(
    'DATABASE_URL must point at a local database (localhost, 127.0.0.1 or [::1]) with DATABASE_DRIVER not "neon"; pnpm e2e resets every seeded War Week and never runs against a hosted database',
  );
}
if (!existsSync(path.resolve(process.cwd(), ".next"))) {
  throw new Error(
    ".next build output missing: run `pnpm build` before `pnpm e2e`",
  );
}

/**
 * The Playwright flows (ticket 13) over the production build against local
 * Postgres. One worker: the flows share the seeded database.
 */
export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/sign-in`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      DATABASE_DRIVER: process.env.DATABASE_DRIVER ?? "",
      BETTER_AUTH_SECRET: E2E_AUTH_SECRET,
      BETTER_AUTH_URL: E2E_BASE_URL,
      // Never real OAuth: the flows sign their own session cookies.
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});

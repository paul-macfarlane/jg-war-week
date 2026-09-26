import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

// Mutation tests run against a local Postgres: CI's service (which sets
// DATABASE_URL) or `docker compose up -d` (the URL in .env.example).
const LOCAL_DATABASE_URL =
  "postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable";

export default defineConfig({
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
    },
    // DB tests load seeds in a rolled-back transaction; allow for a busy
    // local Postgres (parallel worktrees).
    testTimeout: 20_000,
    watch: false,
    // e2e/ holds the Playwright flows (`pnpm e2e`), not vitest tests.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});

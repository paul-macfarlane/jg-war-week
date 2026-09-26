import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

import { deleteE2eUsers } from "./db";

function run(args: string[]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} exited with ${result.status}`);
  }
}

/**
 * Puts the local database in a known state before the flows run: current
 * migrations, every seed reloaded with `--reset` (this wipes those War
 * Weeks), and no e2e users left from an interrupted run. The local-database
 * and build checks run earlier, when `playwright.config.ts` loads.
 */
export default async function globalSetup() {
  run(["db:migrate"]);
  const seedFiles = readdirSync(path.resolve(process.cwd(), "seeds"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => `seeds/${f}`);
  run(["seed:load", "--reset", ...seedFiles]);
  await deleteE2eUsers();
}

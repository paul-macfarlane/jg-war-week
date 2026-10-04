import { spawnSync } from "node:child_process";

import { localSeedFiles } from "@/seed/local-files";

import { deleteE2eAwardCategories, deleteE2eUsers } from "./db";

function run(args: string[]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} exited with ${result.status}`);
  }
}

/**
 * Puts the local database in a known state before the flows run: current
 * migrations, every seed (with the XI demo in place of the real XI)
 * reloaded with `--reset` (this wipes those War Weeks), and no e2e users left from an interrupted run. The local-database
 * and build checks run earlier, when `playwright.config.ts` loads.
 */
export default async function globalSetup() {
  run(["db:migrate"]);
  run(["seed:load", "--reset", ...localSeedFiles()]);
  await deleteE2eUsers();
  // After the reset: Awards of the reset War Weeks no longer hold them.
  await deleteE2eAwardCategories();
}

import { type Page, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";

import { localSeedFiles } from "@/seed/local-files";

import { runQuery } from "./db";

/** Runs `pnpm <args>` with its output shown; throws on a non-zero exit. */
export function pnpm(args: string[]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} exited with ${result.status}`);
  }
}

/** Loads the XII scale demo (100 Participants) over the local seed. */
export function loadScaleDemo() {
  pnpm(["seed:demo:scale"]);
}

/** Team rule: put the shared seeded data back after a scale-demo spec. */
export function restoreLocalSeed() {
  pnpm(["seed:load", "--reset", ...localSeedFiles()]);
}

/** The page never scrolls sideways at its current viewport. */
export async function expectNoSidewaysScroll(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("The page has no viewport size");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(viewport.width);
}

/** The id of the named Competition in an edition (e.g. "xii", "Ping Pong Bracket"). */
export async function competitionId(
  edition: string,
  name: string,
): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = $1 and c.name = $2`,
    [edition, name],
  );
  if (!row) throw new Error(`No ${edition} Competition named "${name}"`);
  return row.id;
}

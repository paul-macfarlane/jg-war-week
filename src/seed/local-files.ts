import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * The live War Week XI demo: fictional mid-week points, Announcements and
 * Awards that smoke, e2e and local development exercise. It lives outside
 * `seeds/*.json`, so the Seed workflow never loads it into a deployed
 * database; `seeds/xi.json` holds XI's real results.
 */
export const DEMO_SEED = "seeds/demo/xi.json";

/**
 * Every seed a local test database loads, relative to the repo root: the
 * committed history, with the XI demo in place of the real XI.
 */
export function localSeedFiles(root = process.cwd()): string[] {
  return readdirSync(path.resolve(root, "seeds"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => (f === "xi.json" ? DEMO_SEED : `seeds/${f}`));
}

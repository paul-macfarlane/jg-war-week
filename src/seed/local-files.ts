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
 * committed history, with the XI demo in place of the real XI. The live XI
 * demo loads last, so a live demo of another edition (`seed:demo:xii`) is
 * reset to its committed seed first rather than refusing a second live War
 * Week.
 */
export function localSeedFiles(root = process.cwd()): string[] {
  return [
    ...readdirSync(path.resolve(root, "seeds"))
      .filter((f) => f.endsWith(".json") && f !== "xi.json")
      .map((f) => `seeds/${f}`),
    DEMO_SEED,
  ];
}

/** The 100-Participant XII demo (ticket 106), live and free-for-all. */
export const SCALE_SEED = "seeds/demo/xii-scale.json";

/**
 * What `pnpm seed:demo:scale` loads: the committed history with the real,
 * complete XI, and the scale demo in place of `seeds/xii.json`, last.
 * `scripts/seed-scale.ts` then adds what the seed format can't hold.
 */
export function scaleSeedFiles(root = process.cwd()): string[] {
  return [
    ...readdirSync(path.resolve(root, "seeds"))
      .filter((f) => f.endsWith(".json") && f !== "xii.json")
      .map((f) => `seeds/${f}`),
    SCALE_SEED,
  ];
}

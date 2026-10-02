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
 * A live, free-for-all War Week XII demo with fictional Participants, for
 * About's stills (`scripts/about-media.ts`, loaded by `pnpm seed:demo:xii`
 * with the history in place of the upcoming XII). Smoke and e2e never load
 * it: they run on the XI demo.
 */
export const XII_DEMO_SEED = "seeds/demo/xii.json";

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

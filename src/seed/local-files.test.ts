import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEMO_SEED, localSeedFiles } from "@/seed/local-files";

describe("localSeedFiles", () => {
  const files = localSeedFiles(path.resolve(__dirname, "../.."));

  it("loads the XI demo in place of the real XI", () => {
    expect(files).toContain(DEMO_SEED);
    expect(files).not.toContain("seeds/xi.json");
  });

  it("loads the live XI demo last, after XII is reset to upcoming", () => {
    // Another live War Week (the XII demo) would refuse a live XI load.
    expect(files.at(-1)).toBe(DEMO_SEED);
    expect(files).toContain("seeds/xii.json");
  });
});

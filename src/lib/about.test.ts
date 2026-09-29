import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { STATIC_PAGE_THEME } from "@/lib/about";

describe("STATIC_PAGE_THEME", () => {
  it("wears War Week XI's seeded Appearance Theme, the Privacy and Terms pages' only theme", () => {
    const seed = JSON.parse(
      readFileSync(new URL("../../seeds/xi.json", import.meta.url), "utf8"),
    );

    expect(STATIC_PAGE_THEME).toEqual({
      primaryColor: seed.primary,
      primaryForegroundColor: seed.primaryForeground,
      accentColor: seed.accent,
      backgroundColor: seed.background,
      foregroundColor: seed.foreground,
      fontPreset: seed.fontPreset,
    });
  });
});

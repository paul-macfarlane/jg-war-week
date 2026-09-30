import { describe, expect, it } from "vitest";

import { DISPLAY_SCRIPT, parseDisplay } from "@/lib/display";

describe("parseDisplay", () => {
  it("keeps light, dark and system", () => {
    expect(parseDisplay("light")).toBe("light");
    expect(parseDisplay("dark")).toBe("dark");
    expect(parseDisplay("system")).toBe("system");
  });

  it("reads an absent or unknown value as System", () => {
    expect(parseDisplay(null)).toBe("system");
    expect(parseDisplay("")).toBe("system");
    expect(parseDisplay("DARK")).toBe("system");
    expect(parseDisplay("sepia")).toBe("system");
  });
});

/** Runs the pre-paint script against a stored value (or a throwing store). */
function runScript(stored: string | null | Error) {
  const dataset: Record<string, string> = {};
  const localStorage = {
    getItem(key: string) {
      if (stored instanceof Error) throw stored;
      return key === "ww:display" ? stored : null;
    },
  };
  const document = { documentElement: { dataset } };
  new Function("localStorage", "document", DISPLAY_SCRIPT)(
    localStorage,
    document,
  );
  return dataset.display;
}

describe("DISPLAY_SCRIPT", () => {
  it("sets html[data-display] for a stored Light or Dark", () => {
    expect(runScript("dark")).toBe("dark");
    expect(runScript("light")).toBe("light");
  });

  it("leaves it unset for System, an absent key, junk or a throwing store", () => {
    expect(runScript("system")).toBeUndefined();
    expect(runScript(null)).toBeUndefined();
    expect(runScript("sepia")).toBeUndefined();
    expect(runScript(new Error("SecurityError"))).toBeUndefined();
  });
});

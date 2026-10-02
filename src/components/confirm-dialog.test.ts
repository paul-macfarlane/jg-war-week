import { describe, expect, it } from "vitest";

import { confirmTextMatches } from "./confirm-dialog";

describe("confirmTextMatches", () => {
  it("matches ignoring case and surrounding spaces", () => {
    expect(
      confirmTextMatches("  Ann@JahnelGroup.com ", "ann@jahnelgroup.com"),
    ).toBe(true);
  });

  it("refuses anything else, including a partial", () => {
    expect(confirmTextMatches("", "ann@jahnelgroup.com")).toBe(false);
    expect(confirmTextMatches("ann@jahnel", "ann@jahnelgroup.com")).toBe(false);
    expect(
      confirmTextMatches("a nn@jahnelgroup.com", "ann@jahnelgroup.com"),
    ).toBe(false);
  });
});

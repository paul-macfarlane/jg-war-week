import { describe, expect, it } from "vitest";

import { ADD_ROW, setupRowFocusTarget } from "@/lib/setup-row-focus";

describe("setupRowFocusTarget", () => {
  it("moves to the next row after the deleted one", () => {
    expect(setupRowFocusTarget(["a", "b", "c"], "b")).toBe("c");
    expect(setupRowFocusTarget(["a", "b", "c"], "a")).toBe("b");
  });

  it("moves to the previous row when the last row is deleted", () => {
    expect(setupRowFocusTarget(["a", "b", "c"], "c")).toBe("b");
  });

  it("moves to the add row when the list becomes empty", () => {
    expect(setupRowFocusTarget(["a"], "a")).toBe(ADD_ROW);
  });

  it("moves to the add row when the deleted row isn't listed", () => {
    expect(setupRowFocusTarget(["a", "b"], "z")).toBe(ADD_ROW);
  });
});

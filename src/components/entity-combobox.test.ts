import { describe, expect, it } from "vitest";

import { appliesMultipleChange } from "./entity-combobox";

describe("appliesMultipleChange", () => {
  it("ignores the empty selection Base UI sends on Escape, so chosen items stay", () => {
    expect(appliesMultipleChange("escape-key")).toBe(false);
  });

  it("applies picking, removing and clearing", () => {
    for (const reason of ["item-press", "input-clear", "clear-press", "none"]) {
      expect(appliesMultipleChange(reason)).toBe(true);
    }
    expect(appliesMultipleChange(undefined)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { appliesMultipleChange, fitsQuery } from "./entity-combobox";

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

describe("fitsQuery", () => {
  const ada = {
    id: "1",
    label: "Ada Anvil",
    detail: "Red",
    keywords: "ada.anvil@example.com",
  };

  it("matches a substring of the name, the detail or the email, ignoring case", () => {
    expect(fitsQuery(ada, "anv")).toBe(true);
    expect(fitsQuery(ada, "RED")).toBe(true);
    expect(fitsQuery(ada, "ada.anvil@ex")).toBe(true);
  });

  it("matches everything on an empty query, and nothing that's in none of them", () => {
    expect(fitsQuery(ada, "  ")).toBe(true);
    expect(fitsQuery(ada, "jahnelgroup")).toBe(false);
    expect(fitsQuery({ id: "2", label: "Bo Banner" }, "example")).toBe(false);
  });
});

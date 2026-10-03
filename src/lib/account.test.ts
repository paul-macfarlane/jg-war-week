import { describe, expect, it } from "vitest";

import { nameFromEmail } from "./account";

describe("nameFromEmail", () => {
  it("is the part before the @", () => {
    expect(nameFromEmail("paul.macfarlane@jahnelgroup.com")).toBe(
      "paul.macfarlane",
    );
  });

  it("falls back to the whole address when there's no local part", () => {
    expect(nameFromEmail("@jahnelgroup.com")).toBe("@jahnelgroup.com");
  });
});

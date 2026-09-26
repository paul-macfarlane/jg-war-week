import { describe, expect, it } from "vitest";

import { isUuid } from "@/lib/uuid";

describe("isUuid", () => {
  it.each<[unknown, boolean]>([
    ["3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b", true],
    ["f47ac10b-58cc-4372-a567-0e02b2c3d479", true],
    ["not-a-uuid", false],
    ["new", false],
    ["", false],
    ["3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b; drop table", false],
    [undefined, false],
    [42, false],
  ])("%s is %s", (value, expected) => {
    expect(isUuid(value)).toBe(expected);
  });
});

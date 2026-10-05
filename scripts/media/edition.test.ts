import { describe, expect, it } from "vitest";

import { assertEdition, requestedEdition } from "./edition";

describe("about-media edition", () => {
  it("defaults to xii and reads --edition", () => {
    expect(requestedEdition(["--stills"])).toBe("xii");
    expect(requestedEdition(["--edition", "XIII"])).toBe("xiii");
  });

  it("refuses a bare --edition", () => {
    expect(() => requestedEdition(["--edition"])).toThrow(/needs a value/);
  });

  it("passes when / is the requested edition", () => {
    expect(() => assertEdition("xii", "xii")).not.toThrow();
  });

  it("fails naming the seed to run when / is another edition", () => {
    expect(() => assertEdition("xi", "xii")).toThrow(/pnpm seed:demo:xii/);
  });
});

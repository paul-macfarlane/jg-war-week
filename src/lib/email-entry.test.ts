import { describe, expect, it } from "vitest";

import { parseEmailEntry } from "@/lib/email-entry";

describe("parseEmailEntry", () => {
  it("accepts a single address typed then Enter", () => {
    expect(parseEmailEntry("  jane@jahnelgroup.com ")).toEqual({
      accepted: ["jane@jahnelgroup.com"],
      rejected: [],
    });
  });

  it("splits a comma-separated entry", () => {
    expect(
      parseEmailEntry("jane@jahnelgroup.com,sam@jahnelgroup.com,"),
    ).toEqual({
      accepted: ["jane@jahnelgroup.com", "sam@jahnelgroup.com"],
      rejected: [],
    });
  });

  it("splits a pasted list on newlines, spaces and commas", () => {
    expect(
      parseEmailEntry(
        "jane@jahnelgroup.com\nsam@jahnelgroup.com, lee@jahnelgroup.com\tkim@jahnelgroup.com",
      ).accepted,
    ).toEqual([
      "jane@jahnelgroup.com",
      "sam@jahnelgroup.com",
      "lee@jahnelgroup.com",
      "kim@jahnelgroup.com",
    ]);
  });

  it("lowercases and dedupes", () => {
    expect(
      parseEmailEntry("Jane@JahnelGroup.com jane@jahnelgroup.com").accepted,
    ).toEqual(["jane@jahnelgroup.com"]);
  });

  it("rejects addresses outside @jahnelgroup.com", () => {
    expect(
      parseEmailEntry("jane@gmail.com, sam@jahnelgroup.com, not-an-email"),
    ).toEqual({
      accepted: ["sam@jahnelgroup.com"],
      rejected: ["jane@gmail.com", "not-an-email"],
    });
  });

  it("gives nothing for blank input", () => {
    expect(parseEmailEntry(" , \n")).toEqual({ accepted: [], rejected: [] });
  });
});

import { describe, expect, it } from "vitest";

import { filterRoster, rosterCountText } from "./roster-filter";

const people = [
  { displayName: "Ada Anvil", email: "ada.anvil@example.com" },
  { displayName: "Bo Banner", email: "BO@Jahnelgroup.com" },
  { displayName: "Cass Comet", email: null },
];

describe("filterRoster", () => {
  it("returns everyone for an empty or blank query", () => {
    expect(filterRoster(people, "")).toHaveLength(3);
    expect(filterRoster(people, "   ")).toHaveLength(3);
  });

  it("matches part of a name, ignoring case", () => {
    expect(filterRoster(people, "aNvI").map((p) => p.displayName)).toEqual([
      "Ada Anvil",
    ]);
  });

  it("matches part of an email, ignoring case", () => {
    expect(
      filterRoster(people, "jahnelgroup").map((p) => p.displayName),
    ).toEqual(["Bo Banner"]);
  });

  it("does not match a missing email, and finds no one for a stranger", () => {
    expect(filterRoster(people, "null")).toEqual([]);
    expect(filterRoster(people, "zzz")).toEqual([]);
  });
});

describe("rosterCountText", () => {
  it("counts N of M", () => {
    expect(rosterCountText(12, 100, "a")).toBe("12 of 100");
    expect(rosterCountText(100, 100, "")).toBe("100 of 100");
  });

  it("says no one matches, quoting the query", () => {
    expect(rosterCountText(0, 100, " zz ")).toBe("No one matches 'zz'");
  });
});

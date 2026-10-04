import { describe, expect, it } from "vitest";

import { parseCompetitionSetting } from "@/lib/competition-settings";

describe("parseCompetitionSetting", () => {
  it("trims a name and refuses a blank one at its field", () => {
    expect(
      parseCompetitionSetting({ field: "name", value: "  Darts " }),
    ).toEqual({ ok: true, value: { field: "name", value: "Darts" } });
    expect(parseCompetitionSetting({ field: "name", value: "  " })).toEqual({
      ok: false,
      error: "Enter the name.",
      fieldErrors: { name: "Enter the name." },
    });
  });

  it("stores a blank description or Group as none", () => {
    expect(
      parseCompetitionSetting({
        field: "description",
        value: { type: "doc", content: [] },
      }),
    ).toEqual({ ok: true, value: { field: "description", value: null } });
    expect(parseCompetitionSetting({ field: "group", value: "" })).toEqual({
      ok: true,
      value: { field: "group", value: null },
    });
  });

  it("keeps rich text beyond the old 2000-character cap and refuses a non-document", () => {
    const long = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(5000) }],
        },
      ],
    };
    expect(
      parseCompetitionSetting({ field: "description", value: long }),
    ).toEqual({ ok: true, value: { field: "description", value: long } });
    expect(
      parseCompetitionSetting({ field: "description", value: "plain" }),
    ).toEqual({
      ok: false,
      error: "The description must be valid rich text.",
      fieldErrors: { description: "The description must be valid rich text." },
    });
  });

  it("takes Placement Points as text or a list, highest first", () => {
    expect(
      parseCompetitionSetting({ field: "placementPoints", value: "10, 6 3" }),
    ).toEqual({
      ok: true,
      value: { field: "placementPoints", value: [10, 6, 3] },
    });
    expect(
      parseCompetitionSetting({ field: "placementPoints", value: [5, 3] }),
    ).toEqual({ ok: true, value: { field: "placementPoints", value: [5, 3] } });
    expect(
      parseCompetitionSetting({ field: "placementPoints", value: [3, 5] }),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        placementPoints:
          "Each place's Placement Points must be no more than the place above it.",
      },
    });
  });

  it("lowercases and deduplicates Hosts, refusing a non-JG email", () => {
    expect(
      parseCompetitionSetting({
        field: "hosts",
        value: ["Sam@JahnelGroup.com", "sam@jahnelgroup.com"],
      }),
    ).toEqual({
      ok: true,
      value: { field: "hosts", value: ["sam@jahnelgroup.com"] },
    });
    expect(
      parseCompetitionSetting({ field: "hosts", value: ["sam@example.com"] }),
    ).toMatchObject({
      ok: false,
      error: "Use an @jahnelgroup.com email.",
    });
  });

  it("takes any Format, and refuses an unknown one", () => {
    expect(
      parseCompetitionSetting({ field: "format", value: "participation" }),
    ).toEqual({ ok: true, value: { field: "format", value: "participation" } });
    expect(
      parseCompetitionSetting({ field: "format", value: "swiss" }),
    ).toMatchObject({ ok: false, error: "Choose a Format." });
  });

  it("takes a blank Entrant limit or close time as none, and a date string as a time", () => {
    expect(
      parseCompetitionSetting({ field: "entrantLimit", value: "" }),
    ).toEqual({ ok: true, value: { field: "entrantLimit", value: null } });
    expect(
      parseCompetitionSetting({ field: "entrantLimit", value: 1 }),
    ).toMatchObject({ ok: false, error: "An Entrant limit is at least 2." });
    expect(
      parseCompetitionSetting({
        field: "enrollClosesAt",
        value: "2099-01-03T17:00:00Z",
      }),
    ).toEqual({
      ok: true,
      value: {
        field: "enrollClosesAt",
        value: new Date("2099-01-03T17:00:00Z"),
      },
    });
  });

  it("refuses a Bracket config where as many advance as play", () => {
    expect(
      parseCompetitionSetting({
        field: "bracketConfig",
        value: { entrantsPerHeat: 3, advancePerHeat: 3, thirdPlaceGame: false },
      }),
    ).toMatchObject({
      ok: false,
      error: "Fewer must advance than play in a Match.",
    });
  });

  it("refuses a switch that isn't on or off, and an unknown field", () => {
    expect(
      parseCompetitionSetting({ field: "selfReport", value: "yes" }),
    ).toMatchObject({ ok: false, error: "Turn self-report on or off." });
    expect(
      parseCompetitionSetting({ field: "finalizedAt", value: null }),
    ).toEqual({ ok: false, error: "Choose a setting to save." });
    expect(parseCompetitionSetting(null)).toEqual({
      ok: false,
      error: "Choose a setting to save.",
    });
  });
});

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { type WarWeekSeed, warWeekSeedSchema } from "@/seed/schema";

/**
 * Content checks on the committed seeds: ten years of history plus the War
 * Week XI demo. Schema validity itself is covered in schema.test.ts.
 */

const SEEDS_DIR = path.resolve(__dirname, "../../seeds");

function load(file: string): WarWeekSeed {
  return warWeekSeedSchema.parse(
    JSON.parse(readFileSync(path.join(SEEDS_DIR, file), "utf-8")),
  );
}

const files = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"));
const seeds = files.map(load).sort((a, b) => a.year - b.year);

describe("War Week history", () => {
  it("has one seed per year from 2016 to 2026", () => {
    expect(seeds.map((s) => s.year)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
  });

  it.each(files)("%s is named after its Edition", (file) => {
    expect(`${load(file).edition}.json`).toBe(file);
  });

  it("numbers Editions from War Week I in 2016", () => {
    const romans = [
      "i",
      "ii",
      "iii",
      "iv",
      "v",
      "vi",
      "vii",
      "viii",
      "ix",
      "x",
      "xi",
    ];
    for (const seed of seeds) {
      expect(seed.editionNumber).toBe(seed.year - 2015);
      expect(seed.edition).toBe(romans[seed.editionNumber - 1]);
    }
  });

  it.each(seeds.filter((s) => s.year < 2026).map((s) => [s.year, s] as const))(
    "%i is complete, with its dates in its year and a wiki URL",
    (year, seed) => {
      expect(seed.status).toBe("complete");
      expect(seed.startDate.startsWith(String(year))).toBe(true);
      expect(seed.wikiUrl).toMatch(/^https:\/\//);
      expect(seed.pointsEntries).toEqual([]);
      expect(seed.organizers).toEqual([]);
    },
  );
});

describe("War Week XI demo", () => {
  const xi = seeds.find((s) => s.edition === "xi")!;

  it("is live, The Matrix, Red vs. Blue, in green on black", () => {
    expect(xi).toMatchObject({
      year: 2026,
      status: "live",
      storyTheme: "The Matrix",
      primary: "#00ff41",
      background: "#000000",
    });
    expect(xi.teams.map((t) => t.name)).toEqual(["Red", "Blue"]);
  });

  it("has the real roster, schedule and Competitions", () => {
    expect(xi.participants.length).toBeGreaterThan(80);
    expect(xi.participants.filter((p) => p.isLeader)).toHaveLength(8);
    expect(xi.days).toHaveLength(6);
    expect(xi.days.every((d) => d.scheduleItems.length > 0)).toBe(true);
    expect(xi.competitions.length).toBeGreaterThan(15);
  });

  it("has a close mid-week race with a fractional and a Counts-Toward-Team-off entry", () => {
    const competitions = new Map(xi.competitions.map((c) => [c.name, c]));
    const teamOf = new Map(xi.participants.map((p) => [p.displayName, p.team]));
    const totals = new Map<string, number>();
    for (const entry of xi.pointsEntries) {
      const comp = competitions.get(entry.competition)!;
      const team =
        entry.team ??
        (comp.countsTowardTeam ? teamOf.get(entry.participant!) : null);
      if (team) totals.set(team, (totals.get(team) ?? 0) + entry.points);
    }

    const [red, blue] = [totals.get("Red") ?? 0, totals.get("Blue") ?? 0];
    expect(red).toBeGreaterThan(0);
    expect(blue).toBeGreaterThan(0);
    expect(Math.abs(red - blue)).toBeLessThanOrEqual(3);

    expect(xi.pointsEntries.some((e) => !Number.isInteger(e.points))).toBe(
      true,
    );
    expect(
      xi.pointsEntries.some((e) => {
        const comp = competitions.get(e.competition)!;
        return comp.scoring === "individual" && !comp.countsTowardTeam;
      }),
    ).toBe(true);
    expect(xi.pointsEntries.every((e) => e.enteredAt < "2026-02-26")).toBe(
      true,
    );
  });

  it("has Announcements (one pinned, one with a video), Awards and organizers", () => {
    expect(xi.announcements.filter((a) => a.pinned)).toHaveLength(1);
    expect(xi.announcements.some((a) => a.videoUrls.length > 0)).toBe(true);
    expect(xi.awards.length).toBeGreaterThanOrEqual(2);
    expect(xi.organizers.length).toBeGreaterThan(0);
  });
});

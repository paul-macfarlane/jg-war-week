import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { categoryKeyForAwardName } from "@/lib/award-categories";
import { DEMO_SEED } from "@/seed/local-files";
import { type WarWeekSeed, warWeekSeedSchema } from "@/seed/schema";

/**
 * Content checks on the committed seeds: eleven years of history, the
 * tentative upcoming War Week XII, plus the War Week XI demo that local test
 * databases load in its place and the War Week XII demo About's stills are
 * taken from. Schema validity itself is covered in
 * schema.test.ts.
 */

const SEEDS_DIR = path.resolve(__dirname, "../../seeds");
const DEMO_SEED_PATH = path.resolve(__dirname, "../..", DEMO_SEED);

function load(file: string): WarWeekSeed {
  return warWeekSeedSchema.parse(
    JSON.parse(readFileSync(path.join(SEEDS_DIR, file), "utf-8")),
  );
}

const files = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"));
const all = files.map(load).sort((a, b) => a.year - b.year);
const seeds = all.filter((s) => s.status === "complete");
const demo = load(path.relative(SEEDS_DIR, DEMO_SEED_PATH));
const xiiDemo = load(
  path.relative(
    SEEDS_DIR,
    path.resolve(__dirname, "../..", "seeds/demo/xii.json"),
  ),
);

describe("War Week history", () => {
  it("has one seed per year from 2016 to 2026", () => {
    expect(seeds.map((s) => s.year)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
  });

  it("has only War Week XII beyond the history, and it is upcoming", () => {
    expect(
      all
        .filter((s) => s.status !== "complete")
        .map((s) => [s.edition, s.status]),
    ).toEqual([["xii", "upcoming"]]);
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
      "xii",
    ];
    for (const seed of all) {
      expect(seed.editionNumber).toBe(seed.year - 2015);
      expect(seed.edition).toBe(romans[seed.editionNumber - 1]);
    }
  });

  it.each(seeds.map((s) => [s.year, s] as const))(
    "%i is complete, with its dates in its year and its wiki page",
    (year, seed) => {
      expect(seed.status).toBe("complete");
      expect(seed.startDate.startsWith(String(year))).toBe(true);
      expect(seed.wikiUrl).toBe(
        `https://sites.google.com/jahnelgroup.com/jahnel-group-wiki/home/war-week/war-week-${year}`,
      );
      expect(seed.announcements).toEqual([]);
      expect(seed.organizers).toEqual([]);
    },
  );

  it("has Placements and Discretionary points only for War Week XI, the first scored in the app's terms", () => {
    expect(
      seeds.filter((s) => s.placements.length > 0).map((s) => s.edition),
    ).toEqual(["xi"]);
    expect(
      seeds
        .filter((s) => s.discretionaryPoints.length > 0)
        .map((s) => s.edition),
    ).toEqual(["xi"]);
    expect(seeds.flatMap((s) => s.competitions.map((c) => c.format))).toEqual(
      expect.not.arrayContaining(["head-to-head", "best-score"]),
    );
  });
});

describe("Award Categories", () => {
  it("tag every seed Award exactly as the name matcher says", () => {
    const tagged = [...all, demo, xiiDemo].flatMap((s) =>
      s.awards.map((a) => ({
        edition: s.edition,
        name: a.name,
        category: a.category ?? null,
        expected: categoryKeyForAwardName(a.name),
      })),
    );
    expect(tagged.length).toBeGreaterThan(0);
    for (const a of tagged) {
      expect(a.category, `${a.edition}: ${a.name}`).toBe(a.expected);
    }
  });

  it("tags the Awards the wikis name for each seeded Category", () => {
    const keysOf = (edition: string) =>
      all
        .find((s) => s.edition === edition)
        ?.awards.flatMap((a) => (a.category ? [a.category] : [])) ?? [];
    expect(keysOf("iv")).toEqual(["war-week-mvp", "billable-hours-champ"]);
    expect(keysOf("viii")).toEqual(["billable-hours-champ", "black-midnight"]);
    expect(demo.awards.find((a) => a.name === "Black Midnight")?.category).toBe(
      "black-midnight",
    );
  });
});

describe("War Week XI", () => {
  const xi = seeds.find((s) => s.edition === "xi")!;

  it("holds Subjective Points as Discretionary points, one per Team, and no Subjective Points Competition", () => {
    expect(xi.competitions.map((c) => c.name)).not.toContain(
      "Subjective Points",
    );
    expect(
      xi.discretionaryPoints.map((e) => [e.team, e.points, e.reason]),
    ).toEqual([
      ["Red", 6, "Subjective Points"],
      ["Blue", 4, "Subjective Points"],
    ]);
    expect(xi.winner).toBe("Red");
  });

  it("holds every wiki result as a Finalized Placement at the wiki scoreboard's time", () => {
    const placed = new Set(xi.placements.map((p) => p.competition));
    expect(placed.size).toBe(19);
    for (const name of placed) {
      const comp = xi.competitions.find((c) => c.name === name)!;
      expect(comp.format, name).toBe("placement");
      expect(comp.finalized, name).toBe(true);
      expect(comp.finalizedAt, name).toBe("2026-02-27T15:00:00-05:00");
      expect(comp.finalizedByEmail, name).toBe("pmacfarlane@jahnelgroup.com");
    }
    expect(xi.placements.every((p) => p.team != null)).toBe(true);
    // HQ Attendance and AI Survey Completion are Placements, not Discretionary.
    expect(placed).toContain("HQ Attendance");
    expect(placed).toContain("AI Survey Completion");
  });

  it("keeps the demo's schedule, roster and Appearance Theme", () => {
    const { days, participants, teams, primary, background, storyTheme } = demo;
    // Only the demo describes a Day: the history seed carries no Day
    // descriptions, so they're left out of the match.
    const undescribed = days.map((day) => {
      const copy = { ...day };
      delete copy.description;
      return copy;
    });
    expect(xi).toMatchObject({
      days: undescribed,
      participants,
      teams,
      primary,
      background,
      storyTheme,
    });
  });
});

describe("War Week XI demo", () => {
  const xi = demo;

  it("is the XI Edition", () => {
    expect(path.basename(DEMO_SEED)).toBe(`${xi.edition}.json`);
  });

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

  it("runs a Head-to-head and a Best score Competition as Games, and the old ranked one as an empty Placement", () => {
    const formats = ["head-to-head", "best-score"];
    const games = xi.competitions
      .filter((c) => formats.includes(c.format))
      .map((c) => ({
        name: c.name,
        scoring: c.scoring,
        format: c.format,
        gameConfig: c.gameConfig,
        entrantsOpen: c.entrantsOpen,
      }));
    expect(games).toEqual([
      {
        name: "Bouncy Pong",
        scoring: "individual",
        format: "head-to-head",
        gameConfig: { drawsAllowed: false, bestOf: null },
        entrantsOpen: true,
      },
      {
        name: "Tuesday Stairs",
        scoring: "team",
        format: "best-score",
        gameConfig: { count: "total", betterIs: "higher", unit: "trips" },
        entrantsOpen: true,
      },
    ]);
    const pong = xi.competitions.find((c) => c.name === "Bouncy Pong")!;
    expect(pong).toMatchObject({
      countsTowardTeam: true,
      placementPoints: [3, 2, 1],
    });
    const matrix = xi.competitions.find(
      (c) => c.name === "Electric City Matrix",
    )!;
    expect(matrix.format).toBe("placement");
    expect(matrix.finalized).toBeUndefined();
    expect(xi.placements.filter((p) => p.competition === matrix.name)).toEqual(
      [],
    );
    // Games aren't seeded: no Placements stand in for Pong or Stairs.
    expect(
      xi.placements.filter((p) =>
        ["Bouncy Pong", "Tuesday Stairs"].includes(p.competition),
      ),
    ).toEqual([]);
  });

  it("runs one team Competition as Participation, ranked by headcount with self check-in", () => {
    const participation = xi.competitions
      .filter((c) => c.format === "participation")
      .map((c) => ({
        name: c.name,
        scoring: c.scoring,
        placementPoints: c.placementPoints,
        participationPoints: c.participationPoints,
        selfCheckIn: c.selfCheckIn,
        checkInClosesAt: c.checkInClosesAt,
      }));
    expect(participation).toEqual([
      {
        name: "Daily Workout Check-in",
        scoring: "team",
        placementPoints: [5, 3, 1],
        participationPoints: undefined,
        selfCheckIn: true,
        checkInClosesAt: undefined,
      },
    ]);
  });

  it("has Finalized Placements: a fractional Placement Point value, a Counts-Toward-Team-off Competition, and the Settlers [5, 3, 1] kept", () => {
    const competitions = new Map(xi.competitions.map((c) => [c.name, c]));
    const finalized = xi.competitions.filter((c) => c.finalized);
    expect(finalized.length).toBe(12);
    expect(finalized.every((c) => c.finalizedAt! < "2026-02-26")).toBe(true);
    expect(
      finalized.some((c) =>
        c.placementPoints?.some((n) => !Number.isInteger(n)),
      ),
    ).toBe(true);
    expect(
      finalized.some((c) => c.scoring === "individual" && !c.countsTowardTeam),
    ).toBe(true);
    expect(competitions.get("Settlers of Catan")).toMatchObject({
      placementPoints: [5, 3, 1],
      finalized: true,
    });
    expect(
      xi.placements.filter((p) => p.competition === "Settlers of Catan"),
    ).toEqual([
      {
        key: "settlers-of-catan-anthony-conway",
        competition: "Settlers of Catan",
        participant: "Anthony Conway",
        place: 1,
      },
    ]);
  });

  it("has Announcements (one pinned, one with a video in its body), Awards and organizers", () => {
    expect(xi.announcements.filter((a) => a.pinned)).toHaveLength(1);
    expect(
      xi.announcements.some((a) =>
        a.body.content.some((block) => block.type === "video"),
      ),
    ).toBe(true);
    expect(xi.awards.length).toBeGreaterThanOrEqual(2);
    expect(xi.organizers.length).toBeGreaterThan(0);
  });
});

describe("War Week XII demo", () => {
  const xii = all.find((s) => s.edition === "xii")!;

  it("is a live, free-for-all XII in XII's Story Theme, colors and font", () => {
    expect(xiiDemo).toMatchObject({
      edition: "xii",
      year: 2027,
      status: "live",
      mode: "free-for-all",
      teams: [],
      storyTheme: xii.storyTheme,
      primary: xii.primary,
      primaryForeground: xii.primaryForeground,
      accent: xii.accent,
      background: xii.background,
      foreground: xii.foreground,
      fontPreset: xii.fontPreset,
    });
    expect(xiiDemo.logoUrl ?? null).toBeNull();
    expect(xiiDemo.bannerUrl ?? null).toBeNull();
  });

  it("has about 12 Participants, none of them a name from a real roster", () => {
    const real = new Set(
      [...all, demo].flatMap((s) => s.participants.map((p) => p.displayName)),
    );
    expect(xiiDemo.participants.length).toBeGreaterThanOrEqual(10);
    expect(xiiDemo.participants.length).toBeLessThanOrEqual(14);
    expect(xiiDemo.participants.filter((p) => real.has(p.displayName))).toEqual(
      [],
    );
    expect(xiiDemo.participants.every((p) => p.team == null)).toBe(true);
  });

  it("has a few scheduled Days and one Bracket, one Head-to-head and two placement-only Competitions", () => {
    expect(xiiDemo.days.length).toBeGreaterThanOrEqual(3);
    expect(xiiDemo.days.every((d) => d.scheduleItems.length > 0)).toBe(true);
    expect(xiiDemo.competitions.map((c) => c.format).sort()).toEqual([
      "head-to-head",
      "heats",
      "placement",
      "placement",
    ]);
    expect(xiiDemo.competitions.every((c) => c.scoring === "individual")).toBe(
      true,
    );
  });

  it("has one pinned Announcement, a Finalized Mile Run, and a Finalized Step Challenge scored by steps", () => {
    expect(xiiDemo.announcements.filter((a) => a.pinned)).toHaveLength(1);
    const rows = (name: string) =>
      xiiDemo.placements.filter((p) => p.competition === name);
    expect(
      rows("Mile Run").map((p) => [p.participant, p.place, p.score]),
    ).toEqual([
      ["Fay Falcon", 1, undefined],
      ["Ada Anvil", 2, undefined],
      ["Jax Jetpack", 3, undefined],
    ]);
    const steps = rows("Step Challenge");
    expect(
      new Set(steps.map((p) => p.participant)).size,
    ).toBeGreaterThanOrEqual(10);
    expect(steps.every((p) => typeof p.score === "number")).toBe(true);
    // Hal and Jax tie on 1, so they share place 10 and 11 is skipped.
    expect(
      steps
        .filter((p) => p.place === 10)
        .map((p) => p.participant)
        .sort(),
    ).toEqual(["Hal Harbor", "Jax Jetpack"]);
    expect(steps.some((p) => p.place === 11)).toBe(false);
    expect(
      xiiDemo.competitions.find((c) => c.name === "Step Challenge"),
    ).toMatchObject({ scoreDirection: "higher", finalized: true });
    expect(xiiDemo.awards).toEqual([]);
  });
});

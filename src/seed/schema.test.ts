import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { warWeekSeedSchema } from "@/seed/schema";

const SEEDS_DIR = path.resolve(__dirname, "../../seeds");

function loadFixture() {
  return JSON.parse(
    readFileSync(path.join(SEEDS_DIR, "demo", "xi.json"), "utf-8"),
  );
}

/** Parses a seed that must fail and returns its issues as "path: message". */
function rejectionOf(seed: unknown): string[] {
  const result = warWeekSeedSchema.safeParse(seed);
  expect(result.success).toBe(false);
  return (result.error?.issues ?? []).map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
}

describe("committed seed files", () => {
  const files = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"));

  it("finds at least one seed file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s passes the seed schema", (file) => {
    const json = JSON.parse(readFileSync(path.join(SEEDS_DIR, file), "utf-8"));
    const result = warWeekSeedSchema.safeParse(json);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });
});

describe("warWeekSeedSchema", () => {
  it("covers every entity in the XI seed", () => {
    const seed = warWeekSeedSchema.parse(loadFixture());
    expect(seed.teams.length).toBeGreaterThan(0);
    expect(seed.participants.length).toBeGreaterThan(0);
    expect(seed.competitions.length).toBeGreaterThan(0);
    expect(seed.days.some((d) => d.scheduleItems.length > 0)).toBe(true);
    expect(seed.pointsEntries.length).toBeGreaterThan(0);
    expect(seed.awards.length).toBeGreaterThan(0);
    expect(seed.announcements.length).toBeGreaterThan(0);
    expect(seed.faqItems.length).toBeGreaterThan(0);
  });

  it("rejects an unknown status", () => {
    rejectionOf({ ...loadFixture(), status: "archived" });
  });

  it("rejects a story theme over the length limit", () => {
    rejectionOf({ ...loadFixture(), storyTheme: "x".repeat(121) });
  });

  it("rejects a day whose date falls outside the War Week's range", () => {
    const fixture = loadFixture();
    rejectionOf({
      ...fixture,
      days: [...fixture.days, { date: "2026-03-01", dayTheme: "Out of range" }],
    });
  });

  it("accepts a day with or without a description and rejects 281 characters", () => {
    const fixture = loadFixture();
    const withDay = (day: object) => ({
      ...fixture,
      days: [{ ...fixture.days[0], ...day }, ...fixture.days.slice(1)],
    });
    expect(
      warWeekSeedSchema.safeParse(withDay({ description: "Hello" })).success,
    ).toBe(true);
    expect(
      warWeekSeedSchema.safeParse(withDay({ description: "" })).success,
    ).toBe(true);
    expect(rejectionOf(withDay({ description: "x".repeat(281) }))).toEqual([
      expect.stringMatching(/^days\.0\.description: /),
    ]);
  });

  it("rejects a non-hex appearance color", () => {
    rejectionOf({ ...loadFixture(), primary: "not-a-color" });
  });

  it("accepts a hex override of a derived palette color", () => {
    const seed = warWeekSeedSchema.parse({
      ...loadFixture(),
      overrideAccent: "#123abc",
    });
    expect(seed.overrideAccent).toBe("#123abc");
  });

  it("rejects a non-hex override", () => {
    rejectionOf({ ...loadFixture(), overrideBackground: "light-green" });
  });

  it("rejects duplicate day dates", () => {
    const fixture = loadFixture();
    rejectionOf({ ...fixture, days: [...fixture.days, fixture.days[0]] });
  });

  describe("Placement Points", () => {
    function withCompetition(competition: Record<string, unknown>) {
      const fixture = loadFixture();
      return {
        ...fixture,
        competitions: [
          ...fixture.competitions,
          { name: "Fixture Cup", scoring: "team", ...competition },
        ],
      };
    }
    const at = `competitions.${loadFixture().competitions.length}.placementPoints`;

    it("accepts a non-increasing list", () => {
      const result = warWeekSeedSchema.safeParse(
        withCompetition({ placementPoints: [5, 3, 3, 0.5] }),
      );
      expect(result.success ? [] : result.error.issues).toEqual([]);
    });

    it("rejects an increasing list", () => {
      expect(
        rejectionOf(withCompetition({ placementPoints: [3, 5, 1] })),
      ).toContain(
        `${at}: each place must be worth no more than the one above it`,
      );
    });

    it("rejects a negative value", () => {
      expect(
        rejectionOf(withCompetition({ placementPoints: [3, 1, -1] })),
      ).toContain(`${at}.2: must be at least 0`);
    });

    it("rejects a key that is no longer a setting, so an old seed fails loudly", () => {
      expect(
        rejectionOf(
          withCompetition({ retiredSetting: 3, placementPoints: [5, 3, 1] }),
        ),
      ).toContain(
        `competitions.${loadFixture().competitions.length}: Unrecognized key: "retiredSetting"`,
      );
    });

    it("rejects more than five places", () => {
      expect(
        rejectionOf(withCompetition({ placementPoints: [6, 5, 4, 3, 2, 1] })),
      ).toContain(`${at}: at most 5 places`);
    });

    it("rejects an empty list", () => {
      expect(rejectionOf(withCompetition({ placementPoints: [] }))).toContain(
        `${at}: at least 1 place`,
      );
    });
  });

  describe("Bracket config", () => {
    function withCompetition(competition: Record<string, unknown>) {
      const fixture = loadFixture();
      return {
        ...fixture,
        competitions: [
          ...fixture.competitions,
          { name: "Fixture Relay", scoring: "team", ...competition },
        ],
      };
    }
    const at = `competitions.${loadFixture().competitions.length}.bracketConfig`;

    it("accepts a heats Competition with or without its config", () => {
      for (const extra of [
        { bracketConfig: { entrantsPerHeat: 5, advancePerHeat: 2 } },
        {},
      ]) {
        const result = warWeekSeedSchema.safeParse(
          withCompetition({ format: "heats", ...extra }),
        );
        expect(result.success ? [] : result.error.issues).toEqual([]);
      }
    });

    it("rejects a heats config where as many advance as play", () => {
      expect(
        rejectionOf(
          withCompetition({
            format: "heats",
            bracketConfig: { entrantsPerHeat: 4, advancePerHeat: 4 },
          }),
        ),
      ).toContain(
        `${at}.advancePerHeat: Fewer must advance than play in a Heat.`,
      );
    });

    it("rejects a config on a single-elimination Competition", () => {
      expect(
        rejectionOf(
          withCompetition({
            format: "single-elimination",
            bracketConfig: { entrantsPerHeat: 4, advancePerHeat: 2 },
          }),
        ),
      ).toContain(`${at}: bracketConfig is only for a heats Competition`);
    });
  });

  describe("Participation", () => {
    function withCompetition(competition: Record<string, unknown>) {
      const fixture = loadFixture();
      return {
        ...fixture,
        competitions: [
          ...fixture.competitions,
          { name: "Fixture Check-in", scoring: "team", ...competition },
        ],
      };
    }
    const at = `competitions.${loadFixture().competitions.length}`;

    it("accepts a team one with Placement Points, or an individual one with N", () => {
      for (const extra of [
        {
          scoring: "team",
          placementPoints: [5, 3, 1],
          selfCheckIn: true,
          checkInClosesAt: "2026-02-27T22:00:00Z",
        },
        { scoring: "individual", participationPoints: 2 },
        { scoring: "individual" },
      ]) {
        const result = warWeekSeedSchema.safeParse(
          withCompetition({ format: "participation", ...extra }),
        );
        expect(result.success ? [] : result.error.issues).toEqual([]);
      }
    });

    it("rejects the settings on another Format", () => {
      const issues = rejectionOf(
        withCompetition({
          format: "placement",
          participationPoints: 1,
          selfCheckIn: true,
          checkInClosesAt: "2026-02-27T22:00:00Z",
        }),
      );
      for (const key of [
        "participationPoints",
        "selfCheckIn",
        "checkInClosesAt",
      ]) {
        expect(issues).toContain(
          `${at}.${key}: ${key} is only for a participation Competition`,
        );
      }
    });

    it("follows the scoring: a team one needs Placement Points and takes no N, an individual one takes no Placement Points", () => {
      expect(
        rejectionOf(withCompetition({ format: "participation" })),
      ).toContain(
        `${at}.placementPoints: placementPoints is required for a team participation Competition`,
      );
      expect(
        rejectionOf(
          withCompetition({
            format: "participation",
            placementPoints: [3],
            participationPoints: 1,
          }),
        ),
      ).toContain(
        `${at}.participationPoints: participationPoints is only for an individual Competition`,
      );
      expect(
        rejectionOf(
          withCompetition({
            format: "participation",
            scoring: "individual",
            placementPoints: [3],
          }),
        ),
      ).toContain(
        `${at}.placementPoints: placementPoints is only for a team participation Competition`,
      );
    });

    it("rejects the removed participationTeamScoring key, and N of 0", () => {
      expect(
        rejectionOf(
          withCompetition({
            format: "participation",
            placementPoints: [3],
            participationTeamScoring: "ranked",
          }),
        ),
      ).toContain(`${at}: Unrecognized key: "participationTeamScoring"`);
      expect(
        rejectionOf(
          withCompetition({
            format: "participation",
            scoring: "individual",
            participationPoints: 0,
          }),
        ),
      ).toContain(`${at}.participationPoints: must be more than 0`);
    });
  });

  describe("Points Entries", () => {
    function withEntry(entry: Record<string, unknown>) {
      const fixture = loadFixture();
      return {
        ...fixture,
        pointsEntries: [
          {
            key: "fixture-entry",
            enteredByEmail: "organizer@jahnelgroup.com",
            enteredAt: "2026-02-23T20:00:00-05:00",
            points: 5,
            ...entry,
          },
        ],
      };
    }

    it("rejects an entry with both a team and a participant", () => {
      expect(
        rejectionOf(
          withEntry({
            competition: "Black Midnight",
            team: "Red",
            participant: "Paul Macfarlane",
          }),
        ),
      ).toContain(
        "pointsEntries.0.team: a Points Entry must target exactly one of team or participant",
      );
    });

    it("rejects an entry with neither a team nor a participant", () => {
      expect(
        rejectionOf(withEntry({ competition: "Black Midnight" })),
      ).toContain(
        "pointsEntries.0.team: a Points Entry must target exactly one of team or participant",
      );
    });

    it("rejects a participant target on a team Competition", () => {
      expect(
        rejectionOf(
          withEntry({
            competition: "Black Midnight",
            participant: "Paul Macfarlane",
          }),
        ),
      ).toContain(
        'pointsEntries.0.participant: "Black Midnight" is a team Competition, so its Points Entries must target a team',
      );
    });

    it("rejects a team target on an individual Competition", () => {
      expect(
        rejectionOf(withEntry({ competition: "Speed Chess", team: "Red" })),
      ).toContain(
        'pointsEntries.0.team: "Speed Chess" is an individual Competition, so its Points Entries must target a participant',
      );
    });

    it("rejects an unknown Competition or target", () => {
      const issues = rejectionOf(
        withEntry({ competition: "Pod Racing", team: "Green" }),
      );
      expect(issues).toContain(
        'pointsEntries.0.competition: unknown Competition "Pod Racing"',
      );
      expect(issues).toContain('pointsEntries.0.team: unknown Team "Green"');
    });

    it("accepts fractional points", () => {
      const result = warWeekSeedSchema.safeParse(
        withEntry({
          competition: "Black Midnight",
          team: "Red",
          points: 1.5,
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  it("rejects an unknown Schedule Item category", () => {
    const fixture = loadFixture();
    fixture.days[1].scheduleItems[0].category = "party";
    const issues = rejectionOf(fixture);
    expect(
      issues.some((i) => i.startsWith("days.1.scheduleItems.0.category:")),
    ).toBe(true);
  });

  it("accepts an `other` Schedule Item category", () => {
    const fixture = loadFixture();
    fixture.days[1].scheduleItems[0].category = "other";
    const seed = warWeekSeedSchema.parse(fixture);
    expect(seed.days[1].scheduleItems[0].category).toBe("other");
  });

  it("rejects Counts Toward Team on a team Competition", () => {
    const fixture = loadFixture();
    fixture.competitions.push({
      name: "Pushup Contest",
      scoring: "team",
      countsTowardTeam: true,
    });
    const index = fixture.competitions.length - 1;
    expect(rejectionOf(fixture)).toContain(
      `competitions.${index}.countsTowardTeam: countsTowardTeam can only be set on an individual Competition`,
    );
  });

  it("refuses a seed that still carries videoUrls, naming where videos go", () => {
    const fixture = loadFixture();
    fixture.announcements[0].videoUrls = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ];
    expect(rejectionOf(fixture)).toContain(
      "announcements.0.videoUrls: videoUrls is gone; put each video in body as a video block",
    );
  });

  it("rejects duplicate Participant emails, ignoring case", () => {
    const fixture = loadFixture();
    fixture.participants[0].email = "neo@example.com";
    fixture.participants[1].email = "NEO@example.com";
    expect(rejectionOf(fixture)).toContain(
      'participants.1.email: duplicate Participant email "neo@example.com"',
    );
  });

  it("rejects a Participant on an unknown Team", () => {
    const fixture = loadFixture();
    fixture.participants[0].team = "Green";
    expect(rejectionOf(fixture)).toContain(
      'participants.0.team: unknown Team "Green"',
    );
  });

  it("rejects an Award with no recipients", () => {
    const fixture = loadFixture();
    fixture.awards[0].participants = [];
    expect(rejectionOf(fixture)).toContain(
      "awards.0.participants: an Award needs at least one recipient (a team or participants)",
    );
  });

  it("accepts an Award's Category key and refuses a name-like value", () => {
    const fixture = loadFixture();
    fixture.awards[0].category = "war-week-mvp";
    expect(warWeekSeedSchema.parse(fixture).awards[0].category).toBe(
      "war-week-mvp",
    );
    fixture.awards[0].category = "War Week MVP";
    expect(rejectionOf(fixture).join("\n")).toContain("awards.0.category");
  });

  it("rejects Teams in a free-for-all War Week", () => {
    expect(rejectionOf({ ...loadFixture(), mode: "free-for-all" })).toContain(
      "teams: a free-for-all War Week has no Teams",
    );
  });

  it("sanitizes rich text on parse", () => {
    const fixture = loadFixture();
    fixture.faqItems[0].answer = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    };
    const seed = warWeekSeedSchema.parse(fixture);
    expect(seed.faqItems[0].answer).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "click" }] },
      ],
    });
  });
});

describe("warWeekSeedSchema Finale slides", () => {
  const withSlides = (finaleSlides: unknown[]) => ({
    ...loadFixture(),
    finaleSlides,
  });

  it("parses an ordered list with a Custom slide, lower-casing its background", () => {
    const seed = warWeekSeedSchema.parse(
      withSlides([
        { kind: "title" },
        { kind: "standings", hidden: true },
        {
          kind: "custom",
          heading: "  Thank you  ",
          backgroundColor: "#AABBCC",
          body: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Hi" }] },
            ],
          },
        },
      ]),
    );
    expect(seed.finaleSlides).toEqual([
      { kind: "title", hidden: false },
      { kind: "standings", hidden: true },
      {
        kind: "custom",
        hidden: false,
        heading: "Thank you",
        backgroundColor: "#aabbcc",
        body: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Hi" }] },
          ],
        },
      },
    ]);
  });

  it("leaves finaleSlides and finaleAwardsLayout out when a seed has none", () => {
    const fixture = loadFixture();
    delete fixture.finaleSlides;
    const seed = warWeekSeedSchema.parse(fixture);
    expect(seed.finaleSlides).toBeUndefined();
    expect(seed.finaleAwardsLayout).toBeUndefined();
    expect(
      warWeekSeedSchema.parse({
        ...fixture,
        finaleAwardsLayout: "per-category",
      }).finaleAwardsLayout,
    ).toBe("per-category");
  });

  it("requires a heading on a Custom slide and refuses Custom fields on a built-in", () => {
    expect(rejectionOf(withSlides([{ kind: "custom" }]))).toEqual([
      "finaleSlides.0.heading: a Custom slide needs a heading",
    ]);
    expect(
      rejectionOf(
        withSlides([
          { kind: "title", heading: "Hello", backgroundColor: "#000000" },
        ]),
      ),
    ).toEqual([
      "finaleSlides.0.heading: only a Custom slide has a heading",
      "finaleSlides.0.backgroundColor: only a Custom slide has a backgroundColor",
    ]);
  });

  it("refuses a built-in twice and two Custom slides with one heading", () => {
    expect(
      rejectionOf(
        withSlides([
          { kind: "title" },
          { kind: "custom", heading: "Thanks" },
          { kind: "title" },
          { kind: "custom", heading: "Thanks" },
        ]),
      ),
    ).toEqual([
      'finaleSlides.2.kind: duplicate Finale slide "title"',
      'finaleSlides.3.kind: duplicate Finale slide "custom: Thanks"',
    ]);
  });

  it("refuses a background that isn't #rrggbb and an unknown kind", () => {
    expect(
      rejectionOf(
        withSlides([
          { kind: "custom", heading: "Hi", backgroundColor: "red" },
          { kind: "intro" },
        ]),
      ).map((issue) => issue.split(":")[0]),
    ).toEqual(["finaleSlides.0.backgroundColor", "finaleSlides.1.kind"]);
  });
});

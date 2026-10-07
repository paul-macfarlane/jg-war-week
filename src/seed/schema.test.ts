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
    expect(seed.placements.length).toBeGreaterThan(0);
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

  describe("Schedule Items", () => {
    /** The fixture with one more item on its first Day. */
    const withItem = (item: object) => {
      const fixture = loadFixture();
      const [first, ...rest] = fixture.days;
      return {
        ...fixture,
        days: [
          { ...first, scheduleItems: [...first.scheduleItems, item] },
          ...rest,
        ],
      };
    };

    it("accepts an item with no start time", () => {
      const seed = warWeekSeedSchema.parse(
        withItem({ title: "Step Challenge", category: "other" }),
      );
      expect(seed.days[0].scheduleItems.at(-1)).toMatchObject({
        title: "Step Challenge",
      });
      expect(seed.days[0].scheduleItems.at(-1)?.startTime ?? null).toBeNull();
    });

    it("rejects a host or hosts key on an item", () => {
      expect(
        rejectionOf(
          withItem({ title: "Quiz", category: "social", host: "Jet Breuer" }),
        ),
      ).toEqual([
        expect.stringMatching(/^days\.0\.scheduleItems\.\d+: .*host/),
      ]);
      expect(
        rejectionOf(
          withItem({ title: "Quiz", category: "social", hosts: ["Tony"] }),
        ),
      ).toEqual([
        expect.stringMatching(/^days\.0\.scheduleItems\.\d+: .*hosts/),
      ]);
    });

    it("rejects a Competition on any category but competition", () => {
      const fixture = loadFixture();
      expect(
        rejectionOf(
          withItem({
            title: "Bouncy Pong social",
            category: "social",
            competition: fixture.competitions[0].name,
          }),
        ),
      ).toEqual([
        expect.stringMatching(/^days\.0\.scheduleItems\.\d+\.competition: /),
      ]);
    });

    it("rejects an end time without a start time", () => {
      expect(
        rejectionOf(
          withItem({ title: "Lego", category: "other", endTime: "10:00" }),
        ),
      ).toEqual([
        expect.stringMatching(/^days\.0\.scheduleItems\.\d+\.endTime: /),
      ]);
    });

    it("rejects two untimed items with the same title on a Day", () => {
      const item = { title: "Lego", category: "other" };
      const once = withItem(item);
      once.days[0].scheduleItems.push(item);
      expect(rejectionOf(once)).toHaveLength(1);
    });
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

    it("rejects more than five places for a Bracket", () => {
      expect(
        rejectionOf(
          withCompetition({
            format: "bracket",
            bracketConfig: {
              kind: "group" as const,
              entrantsPerMatch: 4,
              advancePerMatch: 2,
              thirdPlaceMatch: false,
              rounds: {},
            },
            placementPoints: [5, 4, 3, 2, 1],
          }),
        ),
      ).toContain(
        `${at}: Placement Points cover at most 4 places for this Format.`,
      );
    });

    it("accepts twelve places for Placement, Head-to-head and Best score", () => {
      const twelve = Array.from({ length: 12 }, (_, i) => 12 - i);
      for (const format of ["placement", "head-to-head", "best-score"]) {
        const result = warWeekSeedSchema.safeParse(
          withCompetition({ format, placementPoints: twelve }),
        );
        expect(result.success ? [] : result.error.issues).toEqual([]);
      }
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
    const full = {
      kind: "group" as const,
      entrantsPerMatch: 5,
      advancePerMatch: 2,
      thirdPlaceMatch: false,
      rounds: {},
    };

    it("accepts a Bracket with its full config", () => {
      const result = warWeekSeedSchema.safeParse(
        withCompetition({ format: "bracket", bracketConfig: full }),
      );
      expect(result.success ? [] : result.error.issues).toEqual([]);
    });

    it("rejects a Bracket without its config", () => {
      expect(rejectionOf(withCompetition({ format: "bracket" }))).toContain(
        `${at}: a Bracket needs its bracketConfig (kind, entrantsPerMatch, advancePerMatch, thirdPlaceMatch, rounds)`,
      );
    });

    it("rejects a Bracket config missing its 3rd place Match", () => {
      expect(
        rejectionOf(
          withCompetition({
            format: "bracket",
            bracketConfig: { entrantsPerMatch: 4, advancePerMatch: 2 },
          }),
        ),
      ).not.toEqual([]);
    });

    it("rejects a config where as many advance as play", () => {
      expect(
        rejectionOf(
          withCompetition({
            format: "bracket",
            bracketConfig: {
              kind: "group" as const,
              entrantsPerMatch: 4,
              advancePerMatch: 4,
              thirdPlaceMatch: false,
              rounds: {},
            },
          }),
        ),
      ).toContain(
        `${at}.advancePerMatch: Fewer must advance than play in a Match.`,
      );
    });

    it("rejects the retired Format names", () => {
      for (const format of ["single-elimination", "matches"]) {
        expect(
          warWeekSeedSchema.safeParse(
            withCompetition({ format, bracketConfig: full }),
          ).success,
        ).toBe(false);
      }
    });

    it("rejects a config on a Competition that isn't a Bracket", () => {
      expect(
        rejectionOf(
          withCompetition({ format: "placement", bracketConfig: full }),
        ),
      ).toContain(`${at}: bracketConfig is only for a Bracket`);
    });
  });

  describe("Head-to-head and Best score", () => {
    function withCompetition(competition: Record<string, unknown>) {
      const fixture = loadFixture();
      return {
        ...fixture,
        competitions: [
          ...fixture.competitions,
          { name: "Fixture Series", scoring: "individual", ...competition },
        ],
      };
    }
    const at = `competitions.${loadFixture().competitions.length}`;

    it("accepts a Head-to-head's Best of and two named Entrants", () => {
      const result = warWeekSeedSchema.safeParse(
        withCompetition({
          format: "head-to-head",
          seriesConfig: { drawsAllowed: true, bestOf: 1 },
          entrants: ["Albert Hernandez", "Austin Gage"],
        }),
      );
      expect(result.success ? [] : result.error.issues).toEqual([]);
    });

    it("rejects an unknown, repeated or third Entrant, and Entrants on another Format", () => {
      expect(
        rejectionOf(
          withCompetition({
            format: "head-to-head",
            entrants: ["Albert Hernandez", "Nobody Atall"],
          }),
        ),
      ).toContain(`${at}.entrants.1: unknown Participant "Nobody Atall"`);
      expect(
        rejectionOf(
          withCompetition({
            format: "head-to-head",
            entrants: ["Albert Hernandez", "Albert Hernandez"],
          }),
        ),
      ).toContain(`${at}.entrants: a head-to-head's 2 entrants are different`);
      rejectionOf(
        withCompetition({
          format: "head-to-head",
          entrants: ["Albert Hernandez", "Austin Gage", "Casey Snow"],
        }),
      );
      expect(
        rejectionOf(
          withCompetition({
            format: "best-score",
            entrants: ["Albert Hernandez", "Austin Gage"],
          }),
        ),
      ).toContain(
        `${at}.entrants: entrants is only for a head-to-head or league Competition`,
      );
    });

    it("has no Best of off and no Best / Total count", () => {
      rejectionOf(
        withCompetition({
          format: "head-to-head",
          seriesConfig: { drawsAllowed: false, bestOf: null },
        }),
      );
      rejectionOf(
        withCompetition({
          format: "best-score",
          bestScoreConfig: { teamScore: "best-member", count: "total" },
        }),
      );
      rejectionOf(withCompetition({ format: "best-score", count: "best" }));
    });

    it("gives Best score a higher or lower direction, never none, and no close times anywhere", () => {
      expect(
        rejectionOf(
          withCompetition({ format: "best-score", scoreDirection: "none" }),
        ),
      ).toContain(
        `${at}.scoreDirection: a best-score Competition's scoreDirection is higher or lower`,
      );
      for (const key of [
        "entrantsOpen",
        "loggingClosesAt",
        "enrollClosesAt",
        "checkInClosesAt",
      ]) {
        rejectionOf(withCompetition({ format: "best-score", [key]: null }));
      }
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
        }),
      );
      for (const key of ["participationPoints", "selfCheckIn"]) {
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

  it("refuses the retired pointsEntries list rather than dropping it", () => {
    expect(
      rejectionOf({ ...loadFixture(), pointsEntries: [] }).join("|"),
    ).toContain("pointsEntries is gone");
  });

  describe("Discretionary points", () => {
    function withDiscretionary(entry: Record<string, unknown>, rest = {}) {
      return {
        ...loadFixture(),
        ...rest,
        discretionaryPoints: [
          {
            key: "fixture-discretionary",
            enteredByEmail: "organizer@jahnelgroup.com",
            enteredAt: "2026-02-23T20:00:00-05:00",
            points: 6,
            reason: "Subjective Points",
            ...entry,
          },
        ],
      };
    }

    it("accepts an entry to a Team or a Participant with a reason", () => {
      for (const target of [
        { team: "Red" },
        { participant: "Paul Macfarlane" },
      ]) {
        expect(
          warWeekSeedSchema.safeParse(withDiscretionary(target)).success,
          JSON.stringify(target),
        ).toBe(true);
      }
    });

    it("rejects an entry without a reason", () => {
      expect(
        rejectionOf(withDiscretionary({ team: "Red", reason: "  " })).join("|"),
      ).toContain("discretionaryPoints.0.reason");
    });

    it("rejects both targets, neither, and an unknown Team or Participant", () => {
      expect(
        rejectionOf(
          withDiscretionary({ team: "Red", participant: "Paul Macfarlane" }),
        ),
      ).toContain(
        "discretionaryPoints.0.team: Discretionary points must target exactly one of team or participant",
      );
      expect(rejectionOf(withDiscretionary({}))).toContain(
        "discretionaryPoints.0.team: Discretionary points must target exactly one of team or participant",
      );
      expect(rejectionOf(withDiscretionary({ team: "Nope" }))).toContain(
        'discretionaryPoints.0.team: unknown Team "Nope"',
      );
      expect(
        rejectionOf(withDiscretionary({ participant: "Nobody" })),
      ).toContain(
        'discretionaryPoints.0.participant: unknown Participant "Nobody"',
      );
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
    // Only a competition-category item may link a Competition.
    delete fixture.days[1].scheduleItems[0].competition;
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

  it("leaves finaleSlides out when a seed has none", () => {
    const fixture = loadFixture();
    delete fixture.finaleSlides;
    const seed = warWeekSeedSchema.parse(fixture);
    expect(seed.finaleSlides).toBeUndefined();
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

describe("warWeekSeedSchema Placements", () => {
  const base = () => ({
    ...loadFixture(),
    competitions: [
      {
        name: "Darts",
        scoring: "individual",
        placementPoints: [10, 6, 3],
        scoreDirection: "higher",
        closed: true,
        closedAt: "2099-01-03T18:00:00.000Z",
        closedByEmail: "host@jahnelgroup.com",
      },
      { name: "Quiz", scoring: "team" },
      { name: "Pong", scoring: "individual", format: "head-to-head" },
    ],
    placements: [],
    days: [],
  });
  const participant = () => loadFixture().participants[0].displayName;
  const team = () => loadFixture().teams[0].name;

  it("parses Placements and a Closed Placement Competition", () => {
    const seed = warWeekSeedSchema.parse({
      ...base(),
      placements: [
        {
          key: "darts-1",
          competition: "Darts",
          participant: participant(),
          place: 1,
          score: 12.5,
        },
        { key: "quiz-1", competition: "Quiz", team: team(), place: 2 },
      ],
    });
    expect(seed.placements).toHaveLength(2);
    expect(seed.competitions[0]).toMatchObject({
      scoreDirection: "higher",
      closed: true,
    });
  });

  it("requires closedAt and closedByEmail with closed, and only on a Placement Competition", () => {
    const [darts, quiz, pong] = base().competitions;
    const withoutEmail = { ...darts, closedByEmail: undefined };
    expect(
      rejectionOf({ ...base(), competitions: [withoutEmail, quiz, pong] }),
    ).toEqual([
      "competitions.0.closed: closed needs closedAt and closedByEmail together",
    ]);
    expect(
      rejectionOf({
        ...base(),
        competitions: [
          darts,
          quiz,
          {
            ...pong,
            scoreDirection: "lower",
            closed: true,
            closedAt: darts.closedAt,
            closedByEmail: darts.closedByEmail,
          },
        ],
      }),
    ).toEqual([
      "competitions.2.closed: closed is only for a placement or league Competition",
      "competitions.2.scoreDirection: scoreDirection is only for a placement, best-score or league Competition",
    ]);
  });

  it("refuses a Placement on an unknown or non-Placement Competition, the wrong kind of row, an unknown name and a duplicate key", () => {
    expect(
      rejectionOf({
        ...base(),
        placements: [
          {
            key: "a",
            competition: "Nope",
            participant: participant(),
            place: 1,
          },
          {
            key: "b",
            competition: "Pong",
            participant: participant(),
            place: 1,
          },
          { key: "c", competition: "Darts", team: team(), place: 1 },
          {
            key: "d",
            competition: "Quiz",
            participant: participant(),
            place: 1,
          },
          { key: "e", competition: "Darts", participant: "Nobody", place: 1 },
          { key: "e", competition: "Quiz", team: "Nobody", place: 0 },
        ],
      }),
    ).toEqual([
      "placements.5.place: Too small: expected number to be >=1",
      'placements.5.key: duplicate Placement key "e"',
      'placements.0.competition: unknown Competition "Nope"',
      "placements.1.competition: Pong isn't a placement Competition",
      "placements.2.team: an individual Competition takes participants, not teams",
      "placements.3.participant: a team Competition takes teams, not participants",
      'placements.4.participant: unknown Participant "Nobody"',
      'placements.5.team: unknown Team "Nobody"',
    ]);
  });
});

describe("League seeds", () => {
  const NAMES = [
    "Albert Hernandez",
    "Austin Gage",
    "Ashley Schuliger",
    "Sam Schantz",
  ];
  const league = (extra: object = {}) => ({
    name: "Fixture League",
    scoring: "individual",
    format: "league",
    leagueConfig: { pairing: "round-robin", rounds: null },
    entrants: NAMES,
    ...extra,
  });
  const match = (extra: object = {}) => ({
    key: "m1",
    competition: "Fixture League",
    round: 1,
    position: 0,
    a: NAMES[0],
    b: NAMES[1],
    result: "a",
    ...extra,
  });
  const seed = (competition: object, leagueMatches: object[] = []) => {
    const fixture = loadFixture();
    return {
      ...fixture,
      competitions: [...fixture.competitions, competition],
      leagueMatches,
    };
  };
  const at = `competitions.${loadFixture().competitions.length}`;
  const parse = (input: unknown) => {
    const result = warWeekSeedSchema.safeParse(input);
    return result.success
      ? []
      : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  };

  it("takes a League with any number of Entrants and its Matches, with a bye and a played draw", () => {
    expect(
      parse(
        seed(league(), [
          match(),
          match({
            key: "m2",
            position: 1,
            a: NAMES[2],
            b: NAMES[3],
            result: "draw",
            scoreA: 1,
            scoreB: 1,
          }),
          match({ key: "m3", round: 2, a: NAMES[0], b: null, result: null }),
          match({
            key: "m4",
            round: 2,
            position: 1,
            a: NAMES[1],
            b: NAMES[2],
            result: null,
          }),
        ]),
      ),
    ).toEqual([]);
    expect(parse(seed(league({ entrants: undefined })))).toEqual([]);
  });

  it("takes a Swiss config and a seeded Close on a League, and a Head-to-head still takes exactly 2 Entrants", () => {
    expect(
      parse(
        seed(
          league({
            leagueConfig: { pairing: "swiss", rounds: 3 },
            scoreDirection: "higher",
            scoreUnit: "pts",
            closed: true,
            closedAt: "2027-02-24T10:00:00-05:00",
            closedByEmail: "demo-organizer@jahnelgroup.com",
          }),
        ),
      ),
    ).toEqual([]);
    expect(
      parse(
        seed({
          name: "Fixture H2H",
          scoring: "individual",
          format: "head-to-head",
          entrants: NAMES.slice(0, 3),
        }),
      ),
    ).not.toEqual([]);
  });

  it("refuses a League's config on another Format, an unknown or repeated Entrant, and too many Swiss rounds", () => {
    expect(
      parse(
        seed({
          name: "Fixture Placement",
          scoring: "individual",
          leagueConfig: { pairing: "swiss", rounds: 2 },
        }),
      ),
    ).toContain(`${at}.leagueConfig: leagueConfig is only for a League`);
    expect(
      parse(seed(league({ entrants: [NAMES[0], "Nobody Atall"] }))),
    ).toContain(`${at}.entrants.1: unknown Participant "Nobody Atall"`);
    expect(parse(seed(league({ entrants: [NAMES[0], NAMES[0]] })))).toContain(
      `${at}.entrants: a League's entrants are all different`,
    );
    expect(parse(seed(league({ entrants: [NAMES[0]] })))).not.toEqual([]);
    expect(
      parse(seed(league({ leagueConfig: { pairing: "swiss", rounds: 4 } }))),
    ).toContain(
      `${at}.leagueConfig.rounds: A Swiss League of 4 Entrants plays 1 to 3 rounds.`,
    );
  });

  it("refuses a Match on a Competition that isn't a seeded League, or with an Entrant it doesn't have", () => {
    expect(parse(seed(league(), [match({ competition: "Nobody" })]))).toContain(
      'leagueMatches.0.competition: unknown Competition "Nobody"',
    );
    expect(
      parse(seed(league(), [match({ competition: "HQ Attendance" })])).join(
        "\n",
      ),
    ).toContain("isn't a league Competition");
    expect(parse(seed(league(), [match({ b: "Eve Stone" })]))).toContain(
      'leagueMatches.0.b: "Eve Stone" is not an Entrant of Fixture League',
    );
    expect(
      parse(seed(league(), [match({ b: NAMES[0] })])).join("\n"),
    ).toContain("plays itself");
  });

  it("refuses an Entrant twice in a round, a rematch, a bye with a result and a Score without a result", () => {
    expect(
      parse(
        seed(league(), [
          match(),
          match({ key: "m2", position: 1, a: NAMES[1], b: NAMES[2] }),
        ]),
      ),
    ).toContain("leagueMatches.1.a: Austin Gage plays twice in round 1");
    expect(
      parse(
        seed(league(), [
          match(),
          match({ key: "m2", round: 2, a: NAMES[1], b: NAMES[0] }),
        ]),
      ),
    ).toContain(
      "leagueMatches.1.a: Austin Gage and Albert Hernandez already met in Fixture League",
    );
    expect(parse(seed(league(), [match({ b: null })]))).toContain(
      "leagueMatches.0.result: a bye has no result",
    );
    expect(
      parse(seed(league(), [match({ b: null, result: null, scoreA: 1 })])),
    ).toContain("leagueMatches.0.scoreA: a bye has no Score");
    expect(
      parse(seed(league(), [match({ result: null, scoreA: 1 })])),
    ).toContain("leagueMatches.0.scoreA: a Score needs a result");
  });

  it("refuses a duplicate key or position in a round", () => {
    expect(
      parse(
        seed(league(), [
          match(),
          match({ position: 1, a: NAMES[2], b: NAMES[3] }),
        ]),
      ),
    ).toContain('leagueMatches.1.key: duplicate League Match key "m1"');
    expect(
      parse(
        seed(league(), [
          match(),
          match({ key: "m2", a: NAMES[2], b: NAMES[3] }),
        ]),
      ),
    ).toContain(
      "leagueMatches.1.position: round 1 position 0 is taken in Fixture League",
    );
  });
});

import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/engine";
import { champion as championOf } from "@/lib/bracket/formats";
import type { Entrant } from "@/lib/bracket/types";
import {
  toBracketResult,
  toGamesBracketResult,
  toParticipationBracketResult,
} from "@/mcp/bracket";
import type { BracketEntrant, BracketView } from "@/queries/brackets";

const entrants: Entrant[] = [
  { id: "e1", seedPosition: 1, label: "Alpha" },
  { id: "e2", seedPosition: 2, label: "Bravo" },
  { id: "e3", seedPosition: 3, label: "Charlie" },
];

function bracketEntrantFixture(entrant: Entrant, teamName: string | null) {
  return {
    id: entrant.id,
    seedPosition: entrant.seedPosition,
    label: entrant.label,
    teamId: null,
    participantId: null,
    squadId: null,
    participantNames: [],
    pointsTeamId: null,
    color: null,
    teamName,
  } satisfies BracketEntrant;
}

/**
 * A single-elimination Bracket of 3 Entrants: Seed Position 1 (Alpha) gets
 * the bye of Round 1; Bravo and Charlie play Round 1; the final is Round 2.
 * Alpha's bye advance and any recorded result run through the real engine,
 * never hand-built, so the fixture matches what the engine actually
 * produces.
 */
function bracketFixture() {
  return generate(entrants);
}

describe("toParticipationBracketResult", () => {
  it("answers no Bracket and points to get_participation", () => {
    expect(
      toParticipationBracketResult({ name: "Workout", scoring: "team" }),
    ).toEqual({
      found: true,
      competition: {
        name: "Workout",
        scoring: "team",
        format: "participation",
      },
      bracket: null,
      message:
        "Workout isn't run as a Bracket; it's run as Participation. Call get_participation instead.",
    });
  });
});

describe("toGamesBracketResult", () => {
  it("answers bracket: null and points to get_games for a Head-to-head or Best score Competition", () => {
    expect(
      toGamesBracketResult({
        name: "Bouncy Pong",
        scoring: "individual",
        format: "head-to-head",
      }),
    ).toEqual({
      found: true,
      competition: {
        name: "Bouncy Pong",
        scoring: "individual",
        format: "head-to-head",
      },
      bracket: null,
      message:
        "Bouncy Pong isn't run as a Bracket; it's run as Head-to-head or Best score. Call get_games instead.",
    });
  });
});

describe("toBracketResult", () => {
  it("returns found: false for an unknown Competition", () => {
    const result = toBracketResult(undefined, "Nonexistent");

    expect(result).toEqual({
      found: false,
      message: expect.stringContaining("Nonexistent"),
    });
  });

  it("returns bracket: null with a message for a points Competition", () => {
    const view: BracketView = {
      competition: {
        id: "c1",
        warWeekId: "w1",
        name: "Trivia",
        scoring: "team",
        format: "placement",
        placementPoints: null,
        finalizedAt: null,
        selfReport: false,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
      entrants: [],
      bracket: { config: DEFAULT_BRACKET_CONFIG, heats: [] },
      champion: null,
      finalized: false,
    };

    expect(toBracketResult(view, "Trivia")).toEqual({
      found: true,
      competition: { name: "Trivia", scoring: "team", format: "placement" },
      bracket: null,
      message:
        "Trivia isn't run as a Bracket; it's run as Placement: call get_placements.",
    });
  });

  it("shows an unfinalized Bracket's bye, played Heat with when it was recorded, and ready Heat", () => {
    let bracket = bracketFixture();
    // Round 1's non-bye Heat (Bravo v Charlie): Bravo wins.
    const round1Heat = bracket.heats.find(
      (h) => h.round === 1 && h.slots.every((s) => s.entrantId !== null),
    )!;
    bracket = applyResult(bracket, round1Heat.id, { order: ["e2", "e3"] });
    // The mutation stamps when the Result was saved; the engine doesn't.
    bracket.heats.find((h) => h.id === round1Heat.id)!.recordedAt = new Date(
      "2026-02-22T00:05:00Z",
    );
    // The final is now ready (Alpha v Bravo) but not decided.

    const view: BracketView = {
      competition: {
        id: "c1",
        warWeekId: "w1",
        name: "Beyblades",
        scoring: "team",
        format: "bracket",
        placementPoints: [10, 6],
        finalizedAt: null,
        selfReport: false,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
      entrants: entrants.map((e) =>
        bracketEntrantFixture(e, `${e.label} Squad`),
      ),
      bracket,
      champion: null,
      finalized: false,
    };

    const result = toBracketResult(view, "Beyblades");

    expect(result.found).toBe(true);
    if (!result.found || "bracket" in result) throw new Error("unreachable");
    expect(result.competition).toEqual({
      name: "Beyblades",
      scoring: "team",
      format: "bracket",
      heatSize: 2,
      advancing: 1,
      thirdPlaceGame: false,
      finalized: false,
    });
    expect(result.entrants).toEqual([
      {
        seedPosition: 1,
        name: "Alpha",
        team: "Alpha Squad",
        participants: null,
      },
      {
        seedPosition: 2,
        name: "Bravo",
        team: "Bravo Squad",
        participants: null,
      },
      {
        seedPosition: 3,
        name: "Charlie",
        team: "Charlie Squad",
        participants: null,
      },
    ]);
    expect(result.champion).toBeNull();

    const round1 = result.rounds.find((r) => r.round === 1)!;
    const bye = round1.heats.find((h) => h.entrants.length === 1)!;
    expect(bye.status).toBe("bye");
    expect(bye.entrants).toEqual([{ name: "Alpha", place: 1, score: null }]);
    const decided = round1.heats.find((h) => h.entrants.length === 2)!;
    expect(decided.status).toBe("played");
    expect(decided.recordedAt).toBe("2026-02-22T00:05:00.000Z");
    expect(bye.recordedAt).toBeNull();
    expect(decided.entrants).toEqual([
      { name: "Bravo", place: 1, score: null },
      { name: "Charlie", place: 2, score: null },
    ]);

    const round2 = result.rounds.find((r) => r.round === 2)!;
    const ready = round2.heats[0];
    expect(ready.name).toBe("Final");
    expect(ready.status).toBe("ready");
    expect(ready.recordedAt).toBeNull();
    expect(ready).not.toHaveProperty("startTime");
    expect(ready).not.toHaveProperty("location");
  });

  it("returns champion: null for a decided but unfinalized Bracket", () => {
    let bracket = bracketFixture();
    const round1Heat = bracket.heats.find(
      (h) => h.round === 1 && h.slots.every((s) => s.entrantId !== null),
    )!;
    bracket = applyResult(bracket, round1Heat.id, { order: ["e2", "e3"] });
    const final = bracket.heats.find((h) => h.round === 2)!;
    bracket = applyResult(bracket, final.id, { order: ["e1", "e2"] });
    const championId = championOf(bracket);
    expect(championId).toBe("e1");

    const view: BracketView = {
      competition: {
        id: "c1",
        warWeekId: "w1",
        name: "Beyblades",
        scoring: "team",
        format: "bracket",
        placementPoints: [10, 6],
        finalizedAt: null,
        selfReport: false,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
      entrants: entrants.map((e) =>
        bracketEntrantFixture(e, `${e.label} Squad`),
      ),
      bracket,
      champion: championId,
      finalized: false,
    };

    const result = toBracketResult(view, "Beyblades");

    expect(result.found).toBe(true);
    if (!result.found || "bracket" in result) throw new Error("unreachable");
    expect(result.competition.finalized).toBe(false);
    expect(result.champion).toBeNull();
  });

  it("shows a finalized Bracket's champion", () => {
    let bracket = bracketFixture();
    const round1Heat = bracket.heats.find(
      (h) => h.round === 1 && h.slots.every((s) => s.entrantId !== null),
    )!;
    bracket = applyResult(bracket, round1Heat.id, { order: ["e2", "e3"] });
    const final = bracket.heats.find((h) => h.round === 2)!;
    bracket = applyResult(bracket, final.id, { order: ["e1", "e2"] });
    const championId = championOf(bracket);
    expect(championId).toBe("e1");

    const view: BracketView = {
      competition: {
        id: "c1",
        warWeekId: "w1",
        name: "Beyblades",
        scoring: "team",
        format: "bracket",
        placementPoints: [10, 6],
        finalizedAt: new Date(),
        selfReport: false,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
      entrants: entrants.map((e) =>
        bracketEntrantFixture(e, `${e.label} Squad`),
      ),
      bracket,
      champion: championId,
      finalized: true,
    };

    const result = toBracketResult(view, "Beyblades");

    expect(result.found).toBe(true);
    if (!result.found || "bracket" in result) throw new Error("unreachable");
    expect(result.competition.finalized).toBe(true);
    expect(result.champion).toBe("Alpha");
  });

  it("lists a Squad's Participants by name", () => {
    const view: BracketView = {
      competition: {
        id: "c1",
        warWeekId: "w1",
        name: "Cypher",
        scoring: "team",
        format: "bracket",
        placementPoints: [3, 2, 1],
        finalizedAt: null,
        selfReport: true,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
      entrants: [
        {
          id: "e1",
          seedPosition: 1,
          label: "Red Alpha",
          teamId: null,
          participantId: null,
          squadId: "s1",
          participantNames: ["Ashley Schuliger", "Sam Schantz"],
          pointsTeamId: "red",
          color: "#f00",
          teamName: "Red",
        },
        {
          id: "e2",
          seedPosition: 2,
          label: "Blue Bravo",
          teamId: null,
          participantId: null,
          squadId: "s2",
          participantNames: ["Alec Haring"],
          pointsTeamId: "blue",
          color: "#00f",
          teamName: "Blue",
        },
      ],
      bracket: generate([
        { id: "e1", seedPosition: 1, label: "Red Alpha" },
        { id: "e2", seedPosition: 2, label: "Blue Bravo" },
      ]),
      champion: null,
      finalized: false,
    };

    const result = toBracketResult(view, "Cypher");

    if (!result.found || "bracket" in result) throw new Error("unreachable");
    expect(result.entrants).toEqual([
      {
        seedPosition: 1,
        name: "Red Alpha",
        team: "Red",
        participants: ["Ashley Schuliger", "Sam Schantz"],
      },
      {
        seedPosition: 2,
        name: "Blue Bravo",
        team: "Blue",
        participants: ["Alec Haring"],
      },
    ]);
  });

  it("serializes only whitelisted keys, even when the Entrant carries an email and Hosts", () => {
    const bracket = bracketFixture();
    bracket.heats[0].recordedAt = new Date("2026-02-22T00:05:00Z");
    // A self-reported Heat: its reporter must never reach the payload.
    for (const heat of bracket.heats) {
      Object.assign(heat, {
        reportedByEmail: "reporter@jahnelgroup.com",
        reportedByParticipantId: "p-reporter",
      });
    }
    const entrantsWithExtras = entrants.map((e, i) => ({
      ...bracketEntrantFixture(e, `${e.label} Squad`),
      ...(i === 0
        ? { squadId: "s1", participantNames: ["Ashley Schuliger"] }
        : {}),
      email: `${e.label.toLowerCase()}@jahnelgroup.com`,
      hosts: ["Some Host"],
      reportedByEmail: "reporter@jahnelgroup.com",
    })) as unknown as BracketEntrant[];

    const view: BracketView = {
      competition: {
        id: "c1",
        warWeekId: "w1",
        name: "Beyblades",
        scoring: "team",
        format: "bracket",
        placementPoints: [10, 6],
        finalizedAt: null,
        selfReport: false,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
      entrants: entrantsWithExtras,
      bracket,
      champion: null,
      finalized: false,
    };

    const result = toBracketResult(view, "Beyblades");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("@");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("hosts");
    expect(serialized).not.toContain("Some Host");
    expect(serialized.toLowerCase()).not.toContain("report");
    if (!result.found || "bracket" in result) throw new Error("unreachable");
    for (const entrant of result.entrants) {
      expect(Object.keys(entrant).sort()).toEqual(
        ["name", "participants", "seedPosition", "team"].sort(),
      );
    }
    expect(result.entrants[0].participants).toEqual(["Ashley Schuliger"]);
    for (const heat of result.rounds.flatMap((r) => r.heats)) {
      expect(Object.keys(heat).sort()).toEqual(
        ["entrants", "name", "recordedAt", "status", "thirdPlace"].sort(),
      );
    }
  });
});

describe("toBracketResult with a 3rd place game", () => {
  it("gives the final's winner as champion and marks the 3rd place game", () => {
    const eight: Entrant[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i + 1}`,
      seedPosition: i + 1,
      label: `S${i + 1}`,
    }));
    let bracket = generate(eight, undefined, {
      entrantsPerHeat: 2,
      advancePerHeat: 1,
      thirdPlaceGame: true,
    });
    for (const [heatId, order] of [
      ["r1h1", ["s1", "s8"]],
      ["r1h2", ["s4", "s5"]],
      ["r1h3", ["s2", "s7"]],
      ["r1h4", ["s3", "s6"]],
      ["r2h1", ["s1", "s4"]],
      ["r2h2", ["s2", "s3"]],
      ["r3h1", ["s2", "s1"]],
      // The 3rd place game last: the champion is still the final's winner.
      ["r3h2", ["s3", "s4"]],
    ] as const) {
      bracket = applyResult(bracket, heatId, { order: [...order] });
    }
    const view: BracketView = {
      competition: {
        id: "c1",
        warWeekId: "w1",
        name: "Beyblades",
        scoring: "team",
        format: "bracket",
        placementPoints: [10, 7, 5, 3],
        finalizedAt: new Date("2026-02-22T00:00:00Z"),
        selfReport: false,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
      entrants: eight.map((e) => bracketEntrantFixture(e, null)),
      bracket,
      champion: championOf(bracket),
      finalized: true,
    };

    const result = toBracketResult(view, "Beyblades");
    if (!result.found || !("rounds" in result)) throw new Error("no rounds");
    expect(result.champion).toBe("S2");
    expect(result.competition.thirdPlaceGame).toBe(true);
    expect(
      result.rounds.at(-1)!.heats.map((h) => [h.name, h.thirdPlace]),
    ).toEqual([
      ["Final", false],
      ["3rd place game", true],
    ]);
    expect(result.rounds[1].heats.every((h) => h.thirdPlace === false)).toBe(
      true,
    );
  });
});

import { describe, expect, it } from "vitest";

import { kindOf } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import type { Bracket } from "@/lib/bracket/types";
import type { LeagueMatchFacts } from "@/lib/league/pairing";
import type { ResultFact } from "@/lib/logged-results";
import {
  FINISH_EVERY_MATCH,
  FINISH_THE_SERIES,
  type PlacingsNow,
  bracketPlacingsNow,
  leaguePlacingsNow,
  loggedPlacingsNow,
  participationPlacingsNow,
  placementPlacingsNow,
  seriesCloseError,
  seriesPlacingsNow,
} from "@/lib/placings-now";
import { rankSeries } from "@/lib/series/standings";

const rules = { placementPoints: [10, 6, 3] };

let n = 0;
/** A Head-to-head Match: each side's place (1 and 2 a win, 1 and 1 a Draw). */
function played(first: [string, number], second: [string, number]): ResultFact {
  n += 1;
  return {
    id: `m${n}`,
    recordedAt: new Date(Date.UTC(2027, 1, 22, 12, n)),
    players: [
      { id: first[0], place: first[1], score: null },
      { id: second[0], place: second[1], score: null },
    ],
  };
}
const beat = (w: string, l: string) => played([w, 1], [l, 2]);
const drew = (a: string, b: string) => played([a, 1], [b, 1]);

const bracketEntrants = ["a", "b", "c", "d"].map((id, i) => ({
  id,
  seedPosition: i + 1,
  label: id.toUpperCase(),
  pointsTeamId: `team-${id}`,
  participantId: null,
}));

function fourEntrantBracket(): Bracket {
  return generate(
    {
      kind: kindOf(2, 1),
      entrantsPerMatch: 2,
      advancePerMatch: 1,
      thirdPlaceMatch: false,
      rounds: {},
    },
    bracketEntrants,
    (r, p) => `r${r}m${p}`,
  );
}

function finishedBracket(): Bracket {
  let bracket = fourEntrantBracket();
  bracket = applyResult(bracket, "r1m1", { order: ["a", "d"] });
  bracket = applyResult(bracket, "r1m2", { order: ["b", "c"] });
  return applyResult(bracket, "r2m1", { order: ["b", "a"] });
}

const placementRow = (
  id: string,
  place: number | null,
  score: number | null,
) => ({
  id,
  name: id.toUpperCase(),
  teamId: id,
  participantId: null,
  place,
  score,
});

const cases: { name: string; now: () => PlacingsNow; expected: PlacingsNow }[] =
  [
    {
      name: "Placement: each placed row's Place's points, ties in full",
      now: () =>
        placementPlacingsNow(
          [
            placementRow("red", 1, 9),
            placementRow("blue", 2, 7),
            placementRow("gold", 2, 7),
            placementRow("green", null, null),
          ],
          rules,
        ),
      expected: {
        ok: true,
        points: [
          { teamId: "red", participantId: null, points: 10 },
          { teamId: "blue", participantId: null, points: 6 },
          { teamId: "gold", participantId: null, points: 6 },
        ],
      },
    },
    {
      name: "Placement: refused while nobody is placed",
      now: () => placementPlacingsNow([placementRow("red", null, null)], rules),
      expected: { ok: false, error: "Give someone a Place first." },
    },
    {
      name: "Placement: refused while a row has a Score and no Place",
      now: () =>
        placementPlacingsNow(
          [placementRow("red", 1, 9), placementRow("blue", null, 4)],
          rules,
        ),
      expected: {
        ok: false,
        error:
          "Give every row with a Score a Place, or clear its Score. No Place: BLUE.",
      },
    },
    {
      name: "Bracket: the final's placings' points to each Entrant's Team (no 3rd place Match, so no 3rd)",
      now: () => bracketPlacingsNow(finishedBracket(), bracketEntrants, rules),
      expected: {
        ok: true,
        points: [
          { teamId: "team-b", participantId: null, points: 10 },
          { teamId: "team-a", participantId: null, points: 6 },
        ],
      },
    },
    {
      name: "Bracket: refused until every Match is played",
      now: () =>
        bracketPlacingsNow(fourEntrantBracket(), bracketEntrants, rules),
      expected: { ok: false, error: FINISH_EVERY_MATCH },
    },
    {
      name: "Head-to-head: the series Winner 1st, the other 2nd",
      now: () =>
        loggedPlacingsNow(
          rankSeries(
            { drawsAllowed: false, bestOf: 3 },
            [beat("ana", "ben"), beat("ana", "ben")],
            ["ana", "ben"],
          ),
          { ...rules, scoring: "individual" },
        ),
      expected: {
        ok: true,
        points: [
          { teamId: null, participantId: "ana", points: 10 },
          { teamId: null, participantId: "ben", points: 6 },
        ],
      },
    },
    {
      name: "Head-to-head: a drawn Best of 3 (win, Draw, Draw) gives both 1st's full points",
      now: () =>
        loggedPlacingsNow(
          rankSeries(
            { drawsAllowed: true, bestOf: 3 },
            [beat("red", "blue"), drew("red", "blue"), drew("red", "blue")],
            ["red", "blue"],
          ),
          { ...rules, scoring: "team" },
        ),
      expected: {
        ok: true,
        points: [
          { teamId: "blue", participantId: null, points: 10 },
          { teamId: "red", participantId: null, points: 10 },
        ],
      },
    },
    {
      name: "Participation, individual: N to each Participant who took part",
      now: () =>
        participationPlacingsNow(
          [
            { participantId: "ana", teamId: "red" },
            { participantId: "ben", teamId: null },
          ],
          {
            scoring: "individual",
            placementPoints: null,
            participationPoints: 2,
          },
        ),
      expected: {
        ok: true,
        points: [
          { teamId: null, participantId: "ana", points: 2 },
          { teamId: null, participantId: "ben", points: 2 },
        ],
      },
    },
    {
      name: "Participation, team: Teams by headcount, each place's points",
      now: () =>
        participationPlacingsNow(
          [
            { participantId: "ana", teamId: "red" },
            { participantId: "ben", teamId: "red" },
            { participantId: "cy", teamId: "blue" },
          ],
          {
            scoring: "team",
            placementPoints: [10, 6],
            participationPoints: null,
          },
        ),
      expected: {
        ok: true,
        points: [
          { teamId: "red", participantId: null, points: 10 },
          { teamId: "blue", participantId: null, points: 6 },
        ],
      },
    },
  ];

describe("placings now, by Format", () => {
  it.each(cases)("$name", ({ now, expected }) => {
    expect(now()).toEqual(expected);
  });
});

describe("SC1: a Head-to-head series closes once decided or drawn", () => {
  const bestOf3 = { drawsAllowed: true, bestOf: 3 as const };
  const series = (matches: ResultFact[]) => ({
    config: bestOf3,
    matches,
    entrantIds: ["ana", "ben"],
  });
  const individual = { ...rules, scoring: "individual" as const };

  it("refuses a series nobody has won and not every Match is played", () => {
    expect(FINISH_THE_SERIES).toBe("Finish the series before closing.");
    expect(seriesPlacingsNow(series([]), individual)).toEqual({
      ok: false,
      error: "Finish the series before closing.",
    });
    expect(
      seriesPlacingsNow(
        series([beat("ana", "ben"), drew("ana", "ben")]),
        individual,
      ),
    ).toEqual({ ok: false, error: FINISH_THE_SERIES });
    expect(seriesCloseError(bestOf3, [beat("ben", "ana")])).toBe(
      FINISH_THE_SERIES,
    );
  });

  it("closes a decided series: the Winner 1st, the other 2nd", () => {
    expect(
      seriesPlacingsNow(
        series([beat("ana", "ben"), beat("ana", "ben")]),
        individual,
      ),
    ).toEqual({
      ok: true,
      points: [
        { teamId: null, participantId: "ana", points: 10 },
        { teamId: null, participantId: "ben", points: 6 },
      ],
    });
  });

  it("closes a drawn series (win, Draw, Draw): both take 1st's full points", () => {
    const now = seriesPlacingsNow(
      series([beat("ana", "ben"), drew("ana", "ben"), drew("ana", "ben")]),
      individual,
    );
    expect(now).toEqual({
      ok: true,
      points: expect.arrayContaining([
        { teamId: null, participantId: "ana", points: 10 },
        { teamId: null, participantId: "ben", points: 10 },
      ]),
    });
  });
});

describe("leaguePlacingsNow (spec R23, decision 9; R10)", () => {
  const people = [
    {
      id: "ea",
      seedPosition: 1,
      name: "Ada",
      teamId: null,
      participantId: "ada",
    },
    {
      id: "eb",
      seedPosition: 2,
      name: "Bea",
      teamId: null,
      participantId: "bea",
    },
    {
      id: "ec",
      seedPosition: 3,
      name: "Cy",
      teamId: null,
      participantId: "cy",
    },
  ];
  const roundRobin = { pairing: "round-robin" as const, rounds: null };
  const lm = (
    round: number,
    a: string,
    b: string | null,
    result: LeagueMatchFacts["result"],
  ): LeagueMatchFacts => ({ round, a, b, result });
  // Ada beats both; Bea and Cy draw. MP: Ada 2, Bea ½, Cy ½; Bea and Cy
  // level on head-to-head (½ each) and Sonneborn-Berger (¼ each).
  const complete = [
    lm(1, "ea", "eb", "a"),
    lm(1, "ec", null, null),
    lm(2, "ea", "ec", "a"),
    lm(2, "eb", null, null),
    lm(3, "eb", "ec", "draw"),
    lm(3, "ea", null, null),
  ];

  it("gives each standing's Placement Points, Entrants still tied sharing a place's full points", () => {
    expect(
      leaguePlacingsNow(
        { config: roundRobin, entrants: people, matches: complete },
        rules,
      ),
    ).toEqual({
      ok: true,
      points: [
        { teamId: null, participantId: "ada", points: 10 },
        { teamId: null, participantId: "bea", points: 6 },
        { teamId: null, participantId: "cy", points: 6 },
      ],
    });
  });

  it("gives a team League's points to each Entrant's Team", () => {
    const teams = people.map((e) => ({
      ...e,
      teamId: `team-${e.participantId}`,
      participantId: null,
    }));
    const now = leaguePlacingsNow(
      { config: roundRobin, entrants: teams, matches: complete },
      rules,
    );
    expect(now.ok && now.points[0]).toEqual({
      teamId: "team-ada",
      participantId: null,
      points: 10,
    });
  });

  it("refuses with a Match unplayed, naming it", () => {
    const unplayed = complete.map((m) =>
      m.round === 3 && m.b !== null ? { ...m, result: null } : m,
    );
    expect(
      leaguePlacingsNow(
        { config: roundRobin, entrants: people, matches: unplayed },
        rules,
      ),
    ).toEqual({
      ok: false,
      error: "Finish every Match before closing. Unplayed: Round 3: Bea v Cy.",
    });
  });

  it("refuses a Swiss League with a round not yet paired", () => {
    const four = [
      ...people,
      {
        id: "ed",
        seedPosition: 4,
        name: "Di",
        teamId: null,
        participantId: "di",
      },
    ];
    expect(
      leaguePlacingsNow(
        {
          config: { pairing: "swiss", rounds: 2 },
          entrants: four,
          matches: [lm(1, "ea", "ec", "a"), lm(1, "eb", "ed", "draw")],
        },
        rules,
      ),
    ).toEqual({
      ok: false,
      error: "Finish every Match before closing. Not yet paired: round 2.",
    });
  });

  // 6 Entrants whose first three rounds played every pair across
  // {Ada, Bea, Cy} and {Di, Ed, Flo}: two triangles are left, and a
  // triangle can't pair a 4th round (EVERY_PAIRING_REPEATS).
  const six = [
    ...people,
    {
      id: "ed",
      seedPosition: 4,
      name: "Di",
      teamId: null,
      participantId: "di",
    },
    {
      id: "ee",
      seedPosition: 5,
      name: "Ed",
      teamId: null,
      participantId: "ed",
    },
    {
      id: "ef",
      seedPosition: 6,
      name: "Flo",
      teamId: null,
      participantId: "flo",
    },
  ];
  const deadEnd = [
    lm(1, "ea", "ed", "a"),
    lm(1, "eb", "ee", "a"),
    lm(1, "ec", "ef", "b"),
    lm(2, "ea", "ee", "a"),
    lm(2, "eb", "ef", "draw"),
    lm(2, "ec", "ed", "b"),
    lm(3, "ea", "ef", "a"),
    lm(3, "eb", "ed", "b"),
    lm(3, "ec", "ee", "a"),
  ];

  it("closes a Swiss League of 5 rounds at a dead end once round 3 is complete", () => {
    const now = leaguePlacingsNow(
      {
        config: { pairing: "swiss", rounds: 5 },
        entrants: six,
        matches: deadEnd,
      },
      rules,
    );
    expect(now.ok).toBe(true);
    // Ada won all three; 10 Placement Points for 1st.
    expect(now.ok && now.points[0]).toEqual({
      teamId: null,
      participantId: "ada",
      points: 10,
    });
  });

  it("refuses a Swiss League whose rounds are out of range with the rounds rule", () => {
    expect(
      leaguePlacingsNow(
        {
          config: { pairing: "swiss", rounds: 1e9 },
          entrants: six,
          matches: deadEnd,
        },
        rules,
      ),
    ).toEqual({
      ok: false,
      error: "A Swiss League of 6 Entrants plays 1 to 5 rounds.",
    });
  });

  it("refuses a League of fewer than 2 Entrants", () => {
    expect(
      leaguePlacingsNow(
        { config: roundRobin, entrants: [people[0]], matches: [] },
        rules,
      ),
    ).toEqual({ ok: false, error: "Add at least 2 Entrants before pairing." });
  });
});

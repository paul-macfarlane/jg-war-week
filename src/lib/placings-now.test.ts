import { describe, expect, it } from "vitest";

import { kindOf } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import type { Bracket } from "@/lib/bracket/types";
import type { ResultFact } from "@/lib/logged-results";
import {
  FINISH_EVERY_MATCH,
  type PlacingsNow,
  bracketPlacingsNow,
  loggedPlacingsNow,
  participationPlacingsNow,
  placementPlacingsNow,
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

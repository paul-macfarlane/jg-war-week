import { describe, expect, it } from "vitest";

import type { LeagueResult } from "@/lib/enums";
import { swapError } from "@/lib/league/rules";
import {
  editDisabledReason,
  isViewer,
  yourNextMatch,
} from "@/lib/league/view-rules";

const m = (
  id: string,
  round: number,
  a: string,
  b: string | null,
  result: LeagueResult | null = null,
) => ({ id, round, a, b, result });

describe("isViewer: whether an Entrant is the signed-in viewer", () => {
  const ada = { participantId: "ada", teamId: "red" };

  it("matches the Participant in individual scoring and their Team in team scoring", () => {
    expect(
      isViewer("individual", ada, { teamId: null, participantId: "ada" }),
    ).toBe(true);
    expect(
      isViewer("individual", ada, { teamId: "red", participantId: "bo" }),
    ).toBe(false);
    expect(isViewer("team", ada, { teamId: "red", participantId: null })).toBe(
      true,
    );
    expect(isViewer("team", ada, { teamId: "blue", participantId: null })).toBe(
      false,
    );
  });

  it("is never a viewer with no link, or a teamless viewer in team scoring", () => {
    expect(
      isViewer("individual", null, { teamId: null, participantId: "ada" }),
    ).toBe(false);
    expect(
      isViewer(
        "team",
        { participantId: "ada", teamId: null },
        { teamId: null, participantId: null },
      ),
    ).toBe(false);
  });
});

describe("editDisabledReason: Edit pairings agrees with swapError", () => {
  it("is open for a round with two Matches to swap between, a bye or sit-out included", () => {
    const round = [m("1", 1, "A", "B"), m("2", 1, "C", null)];
    for (const pairing of ["swiss", "round-robin"] as const) {
      expect(editDisabledReason({ closed: false, pairing, round })).toBeNull();
      expect(
        swapError({ closed: false, pairing, round, x: "B", y: "C" }),
      ).toBeNull();
    }
  });

  it("is off once Closed", () => {
    expect(
      editDisabledReason({
        closed: true,
        pairing: "swiss",
        round: [m("1", 1, "A", "B"), m("2", 1, "C", "D")],
      }),
    ).toBe("This Competition is closed.");
  });

  it("is off for a Swiss round with a result, and a round robin round with fewer than two open Matches", () => {
    const played = [m("1", 1, "A", "B", "a"), m("2", 1, "C", "D")];
    expect(
      editDisabledReason({ closed: false, pairing: "swiss", round: played }),
    ).toBe("A Match in this round has a result.");
    expect(
      editDisabledReason({
        closed: false,
        pairing: "round-robin",
        round: played,
      }),
    ).toBe("A Match being swapped has a result.");
    expect(
      editDisabledReason({
        closed: false,
        pairing: "round-robin",
        round: [...played, m("3", 1, "E", null)],
      }),
    ).toBeNull();
  });

  it("with one Match in the round and no result, says there's nothing to swap, not that a result exists", () => {
    const round = [m("1", 1, "A", "B")];
    for (const pairing of ["swiss", "round-robin"] as const) {
      expect(editDisabledReason({ closed: false, pairing, round })).toBe(
        "Those two already play each other.",
      );
      expect(swapError({ closed: false, pairing, round, x: "A", y: "B" })).toBe(
        "Those two already play each other.",
      );
    }
  });
});

describe("yourNextMatch: the viewer's next Match", () => {
  const names: Record<string, string> = { A: "Ada", B: "Bo", C: "Cy", D: "Di" };
  const nameOf = (id: string) => names[id];
  const matches = [
    m("r1a", 1, "A", "B", "a"),
    m("r1b", 1, "C", null),
    m("r2a", 2, "A", "C"),
    m("r2b", 2, "B", null),
  ];

  it("is the first Match without a result, with the opponent's name", () => {
    expect(
      yourNextMatch({ closed: false, yourEntrantId: "C", matches, nameOf }),
    ).toEqual({ round: 2, matchId: "r2a", opponent: "Ada" });
  });

  it("is a bye while its round still has a Match to play, and skips one whose round is played", () => {
    expect(
      yourNextMatch({ closed: false, yourEntrantId: "B", matches, nameOf }),
    ).toEqual({ round: 2, matchId: "r2b", opponent: null });
    const played = matches.map((x) =>
      x.id === "r2a" ? { ...x, result: "draw" as const } : x,
    );
    expect(
      yourNextMatch({
        closed: false,
        yourEntrantId: "B",
        matches: played,
        nameOf,
      }),
    ).toBeNull();
  });

  it("is nothing once Closed or for a viewer who isn't an Entrant", () => {
    expect(
      yourNextMatch({ closed: true, yourEntrantId: "C", matches, nameOf }),
    ).toBeNull();
    expect(
      yourNextMatch({ closed: false, yourEntrantId: null, matches, nameOf }),
    ).toBeNull();
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { generate } from "@/lib/bracket/engine";

import { HeatRows } from "./bracket-view";
import { type BracketViewEntrant } from "./entrant-mark";

const entrant = (
  id: string,
  label: string,
  over: Partial<BracketViewEntrant> = {},
): BracketViewEntrant => ({
  id,
  label,
  color: "#f00",
  teamId: null,
  participantId: null,
  squadId: null,
  participantNames: [],
  ...over,
});

const render = (entrants: BracketViewEntrant[]) => {
  const bracket = generate(
    entrants.map((e, i) => ({ id: e.id, seedPosition: i + 1, label: e.label })),
  );
  return renderToStaticMarkup(
    <HeatRows
      heat={bracket.heats[0]}
      bracket={bracket}
      entrantsById={new Map(entrants.map((e) => [e.id, e]))}
      scoring="team"
      primaryColor="#000"
    />,
  );
};

describe("HeatRows", () => {
  it("lists a Squad's Participants under its name", () => {
    const html = render([
      entrant("e1", "Red Alpha", {
        squadId: "s1",
        participantNames: ["Ashley Schuliger", "Sam Schantz"],
      }),
      entrant("e2", "Blue Bravo", {
        squadId: "s2",
        participantNames: ["Alec Haring"],
      }),
    ]);
    expect(html).toContain("Red Alpha");
    expect(html).toContain("Ashley Schuliger, Sam Schantz");
    expect(html).toContain("Alec Haring");
    expect(html).toContain("text-xs");
  });

  it("shows a Team Entrant by its name alone", () => {
    const html = render([
      entrant("e1", "Red", { teamId: "red" }),
      entrant("e2", "Blue", { teamId: "blue" }),
    ]);
    expect(html).toContain("Red");
    expect(html).not.toContain("text-xs");
  });
});

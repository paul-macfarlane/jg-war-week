import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { generate } from "@/lib/bracket/engine";
import type { Entrant } from "@/lib/bracket/types";

import { Avatar } from "./avatar";
import { BracketTree } from "./bracket-tree";
import { type BracketViewEntrant, EntrantTeam } from "./entrant-mark";
import { ParticipantMark, TeamTag } from "./participant-mark";

describe("Avatar's Team mark", () => {
  it("wears a Team-colored ring when it is a picture", () => {
    const html = renderToStaticMarkup(
      <Avatar name="Ada Lovelace" teamColor="#e11d48" image="/ada.png" />,
    );
    expect(html).toContain('data-team-color="#e11d48"');
    expect(html).toContain("data-team-ring");
    expect(html).toContain("outline:2px solid #e11d48");
  });

  it("fills initials with the Team color and needs no ring", () => {
    const html = renderToStaticMarkup(
      <Avatar name="Ada Lovelace" teamColor="#e11d48" />,
    );
    expect(html).toContain('data-team-color="#e11d48"');
    expect(html).toContain("background-color:#e11d48");
    expect(html).not.toContain("data-team-ring");
  });

  it("carries no Team mark without a Team", () => {
    const html = renderToStaticMarkup(
      <Avatar name="Ada Lovelace" teamColor={null} image="/ada.png" />,
    );
    expect(html).not.toContain("data-team-color");
    expect(html).not.toContain("data-team-ring");
  });
});

describe("TeamTag", () => {
  it("shows the Team name with its color dot", () => {
    const html = renderToStaticMarkup(
      <TeamTag name="Red Rockets" color="#e11d48" />,
    );
    expect(html).toContain("Red Rockets");
    expect(html).toContain("background-color:#e11d48");
  });

  it("renders nothing without a Team", () => {
    expect(renderToStaticMarkup(<TeamTag name={null} color={null} />)).toBe("");
  });

  it("hides the name below md when responsive", () => {
    const html = renderToStaticMarkup(
      <TeamTag name="Red Rockets" color="#e11d48" responsive />,
    );
    expect(html).toContain("hidden md:inline-flex");
  });
});

describe("ParticipantMark", () => {
  const props = {
    name: "Ada Lovelace",
    teamName: "Red Rockets",
    teamColor: "#e11d48",
  };

  it("shows avatar, name and Team", () => {
    const html = renderToStaticMarkup(<ParticipantMark {...props} />);
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Red Rockets");
    expect(html).toContain('data-team-color="#e11d48"');
  });

  it("leaves the Team to the color where asked", () => {
    const html = renderToStaticMarkup(
      <ParticipantMark {...props} team="color" />,
    );
    expect(html).not.toContain("Red Rockets");
    expect(html).toContain('data-team-color="#e11d48"');
  });

  it("shows no Team in a free-for-all War Week", () => {
    const html = renderToStaticMarkup(
      <ParticipantMark name="Ada Lovelace" teamColor={null} />,
    );
    expect(html).not.toContain("data-team");
  });
});

const entrant = (over: Partial<BracketViewEntrant>): BracketViewEntrant => ({
  id: "e1",
  label: "Ada Lovelace",
  color: "#e11d48",
  teamId: null,
  participantId: "p1",
  squadId: null,
  participantNames: [],
  teamName: "Red Rockets",
  ...over,
});

describe("EntrantTeam", () => {
  it("names an individual Entrant's Team", () => {
    const html = renderToStaticMarkup(
      <EntrantTeam entrant={entrant({})} scoring="individual" />,
    );
    expect(html).toContain("Red Rockets");
  });

  it("adds nothing for a Team Entrant, which is the Team", () => {
    expect(
      renderToStaticMarkup(
        <EntrantTeam entrant={entrant({})} scoring="team" />,
      ),
    ).toBe("");
  });

  it("adds nothing for an Entrant with no Team", () => {
    expect(
      renderToStaticMarkup(
        <EntrantTeam
          entrant={entrant({ teamName: null, color: null })}
          scoring="individual"
        />,
      ),
    ).toBe("");
  });
});

describe("BracketTree's individual Entrants", () => {
  const seeds: Entrant[] = ["Ada", "Bo"].map((label, i) => ({
    id: `e${i + 1}`,
    seedPosition: i + 1,
    label,
  }));

  it("marks each node by Team color, not by name", () => {
    const byId = new Map(
      seeds.map((e) => [
        e.id,
        entrant({ id: e.id, label: e.label, teamName: "Red Rockets" }),
      ]),
    );
    const html = renderToStaticMarkup(
      <BracketTree
        bracket={generate(seeds)}
        entrantsById={byId}
        scoring="individual"
        primaryColor="#000"
      />,
    );
    expect(html).toContain('data-team-color="#e11d48"');
    expect(html).not.toContain("Red Rockets");
  });
});

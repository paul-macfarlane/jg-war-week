import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FinaleSlideData } from "@/lib/finale-slides";

import { FinaleSlideView } from ".";

function render(data: FinaleSlideData, step = 0, final = false) {
  const html = renderToStaticMarkup(
    <FinaleSlideView
      data={data}
      step={step}
      final={final}
      complete={() => {}}
      edition="xii"
      storyTheme="Wrapped"
    />,
  );
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ");
  return { html, text };
}

const awards: FinaleSlideData = {
  key: "awards",
  kind: "awards",
  name: "Awards",
  heading: "Awards",
  primaryColor: "#123456",
  groups: [
    {
      key: "c-grind",
      name: "Grind",
      awards: [
        {
          id: "a1",
          name: "Hardest Worker",
          description: "Never logged off.",
          team: null,
          participants: [
            { id: "p1", displayName: "Ada Anvil", teamColor: "#ff0000" },
          ],
        },
      ],
    },
    {
      key: "other",
      name: "Other Awards",
      awards: [
        {
          id: "a2",
          name: "Best Banner",
          description: null,
          team: { name: "Red", color: "#ff0000" },
          participants: [],
        },
      ],
    },
  ],
};

describe("the built-in Finale slides", () => {
  it("Title: War Week, its edition and Story Theme", () => {
    const { text } = render({
      key: "title",
      kind: "title",
      name: "Title",
      edition: "xii",
      year: 2027,
      storyTheme: "Wrapped",
      logoUrl: null,
      bannerUrl: null,
    });
    expect(text).toContain("War Week XII");
    expect(text).toContain("Wrapped");
    expect(text).toContain("2027");
  });

  it("By the numbers: each figure over its label", () => {
    const { html } = render({
      key: "numbers",
      kind: "numbers",
      name: "By the numbers",
      figures: [
        { label: "Points Entries", value: "18" },
        { label: "Participants", value: "12" },
      ],
    });
    expect(html).toMatch(/<dt[^>]*>Points Entries<\/dt><dd[^>]*>18<\/dd>/);
    expect(html).toMatch(/<dt[^>]*>Participants<\/dt><dd[^>]*>12<\/dd>/);
  });

  it("Awards: reveals one Award per step, under its Category", () => {
    const arrived = render(awards, 0);
    expect(arrived.text).toContain("Awards");
    expect(arrived.text).not.toContain("Hardest Worker");
    expect(arrived.text).not.toContain("Best Banner");

    const one = render(awards, 1);
    expect(one.text).toContain("Grind");
    expect(one.text).toContain("Hardest Worker");
    expect(one.text).toContain("Ada Anvil");
    expect(one.text).not.toContain("Best Banner");

    const all = render(awards, 1, true);
    expect(all.text).toContain("Hardest Worker");
    expect(all.text).toContain("Other Awards");
    expect(all.text).toContain("Best Banner");
    expect(all.text).toContain("Red");
  });

  it("Winners: each Competition's Winner or winners, a tie together", () => {
    const { text } = render({
      key: "champions",
      kind: "champions",
      name: "Winners",
      primaryColor: "#123456",
      champions: [
        {
          competitionId: "c1",
          competition: "Chess Heats",
          format: "bracket",
          label: "Winner",
          title: "Ada Anvil",
          winners: [
            { id: "p1", name: "Ada Anvil", color: null, kind: "participant" },
          ],
        },
        {
          competitionId: "c2",
          competition: "Ping Pong",
          format: "head-to-head",
          label: "Winner",
          title: "Tie: Fay Falcon & Jax Jetpack",
          winners: [
            { id: "p2", name: "Fay Falcon", color: null, kind: "participant" },
            { id: "p3", name: "Jax Jetpack", color: null, kind: "participant" },
          ],
        },
      ],
    });
    expect(text).toContain("Chess Heats");
    expect(text).toContain("Ada Anvil");
    expect(text).toContain("Ping Pong");
    expect(text).toContain("Tie: Fay Falcon & Jax Jetpack");
  });

  it("Winner: first place, a tie as a tie, with the totals", () => {
    const { html, text } = render({
      key: "winner",
      kind: "winner",
      name: "Winner",
      title: "Tie: Red & Blue",
      tie: true,
      primaryColor: "#123456",
      rows: [
        { id: "t1", name: "Red", total: "40", color: "#ff0000", kind: "team" },
        { id: "t2", name: "Blue", total: "40", color: "#0000ff", kind: "team" },
      ],
    });
    expect(html).toMatch(/<h1[^>]*>Tie: Red &amp; Blue<\/h1>/);
    expect(text).toContain("40 points");
  });
});

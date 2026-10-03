import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { applyResult, generate } from "@/lib/bracket/engine";
import { heats } from "@/lib/bracket/heats";
import type { Entrant } from "@/lib/bracket/types";

import { BracketTree } from "./bracket-tree";
import type { BracketViewEntrant } from "./entrant-mark";

const entrant = (
  id: string,
  label: string,
  over: Partial<BracketViewEntrant> = {},
): BracketViewEntrant => ({
  id,
  label,
  color: "#f00",
  teamId: `t${id}`,
  participantId: null,
  squadId: null,
  participantNames: [],
  ...over,
});

const seeds: Entrant[] = ["Red", "Blue", "Green"].map((label, i) => ({
  id: `e${i + 1}`,
  seedPosition: i + 1,
  label,
}));
// 3 Entrants: Semifinal 1 is Red's bye, Semifinal 2 is Blue v Green.
const three = generate(seeds);
const threeById = new Map(seeds.map((e) => [e.id, entrant(e.id, e.label)]));

function tree(
  props: Partial<Parameters<typeof BracketTree>[0]> = {},
  bracket = three,
  entrantsById = threeById,
) {
  return renderToStaticMarkup(
    <BracketTree
      bracket={bracket}
      entrantsById={entrantsById}
      scoring="team"
      primaryColor="#000"
      {...props}
    />,
  );
}

/** Every button's accessible name (its aria-label) in `html`. */
function buttonNames(html: string): string[] {
  return [...html.matchAll(/<button[^>]*aria-label="([^"]*)"/g)].map(
    (m) => m[1],
  );
}

describe("BracketTree's Record result buttons", () => {
  it("shows no button on any Heat when the viewer may record none", () => {
    expect(buttonNames(tree())).toEqual([]);
    expect(tree()).not.toContain("Record result");
  });

  it("shows a solid Record result only on the Heats the viewer may record", () => {
    const html = tree({ recordableHeatIds: ["r1h2"], onRecord: () => {} });
    expect(buttonNames(html)).toEqual(["Record result for Semifinal 2"]);
    const button = html.match(/<button[^>]*>Record result<\/button>/)?.[0];
    expect(button).toBeDefined();
    // The solid primary variant (87's rule), not a ghost overlay.
    expect(button).toContain("bg-primary");
  });

  it("offers Edit on a played Heat the viewer may record", () => {
    const played = applyResult(three, "r1h2", { order: ["e2", "e3"] });
    const html = tree(
      { recordableHeatIds: ["r1h2", "r2h1"], onRecord: () => {} },
      played,
    );
    expect(buttonNames(html)).toEqual([
      "Edit Semifinal 2",
      "Record result for Final",
    ]);
  });

  it("names who self-reported a Heat's result in its box", () => {
    expect(tree({ reporters: { r1h2: "Ashley Schuliger" } })).toContain(
      "Reported by Ashley Schuliger",
    );
    expect(tree()).not.toContain("Reported by");
  });
});

describe("BracketTree's layout", () => {
  it("scrolls sideways inside its own focusable Rounds region, never as Round tabs", () => {
    const html = tree();
    expect(html).toMatch(
      /<div[^>]*role="region"[^>]*aria-label="Rounds"[^>]*>/,
    );
    const region = html.match(/<div[^>]*aria-label="Rounds"[^>]*>/)![0];
    expect(region).toContain('tabindex="0"');
    expect(region).toContain("overflow-x-auto");
    expect(region).toContain('data-testid="bracket-tree-scroll"');
    expect(html).not.toContain('role="tablist"');
  });

  it("lists a Squad's Participants under its name", () => {
    const html = tree(
      {},
      generate([
        { id: "s1", seedPosition: 1, label: "Red Alpha" },
        { id: "s2", seedPosition: 2, label: "Blue Bravo" },
      ]),
      new Map([
        [
          "s1",
          entrant("s1", "Red Alpha", {
            squadId: "s1",
            participantNames: ["Ashley Schuliger", "Sam Schantz"],
          }),
        ],
        [
          "s2",
          entrant("s2", "Blue Bravo", {
            squadId: "s2",
            participantNames: ["Alec Haring"],
          }),
        ],
      ]),
    );
    expect(html).toContain("Ashley Schuliger, Sam Schantz");
    expect(html).toContain("Alec Haring");
  });

  it("highlights places 1 and 2 of a Heat of 4 with 2 advancing, and only 1st in the final", () => {
    const eight: Entrant[] = Array.from({ length: 8 }, (_, i) => ({
      id: `h${i + 1}`,
      seedPosition: i + 1,
      label: `Entrant ${i + 1}`,
    }));
    const byId = new Map(eight.map((e) => [e.id, entrant(e.id, e.label)]));
    let bracket = heats.generate(
      { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
      eight,
      (round, position) => `r${round}h${position}`,
    );
    const play = (id: string) => {
      const heat = bracket.heats.find((h) => h.id === id)!;
      bracket = heats.applyResult(bracket, id, {
        order: heat.slots.map((s) => s.entrantId!),
        scores: {},
      });
    };
    /** The place numbers of the rows marked as advancing in Heat `name`. */
    const advancing = (name: string) => {
      const html = tree({}, bracket, byId);
      // The Heat's box: from its (last) label to the next group.
      const box = html
        .split(`aria-label="${name}"`)
        .at(-1)!
        .split('role="group"')[0];
      return [
        ...box.matchAll(/data-advances[^>]*>.*?aria-label="Place (\d)"/g),
      ].map((m) => m[1]);
    };

    play("r1h1");
    expect(advancing("Round 1 Heat 1")).toEqual(["1", "2"]);
    play("r1h2");
    play("r2h1");
    expect(advancing("Final")).toEqual(["1"]);
  });
});

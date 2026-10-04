import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/engine";
import * as formats from "@/lib/bracket/formats";
import { matches } from "@/lib/bracket/groups";
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
  it("shows no button on any Match when the viewer may record none", () => {
    expect(buttonNames(tree())).toEqual([]);
    expect(tree()).not.toContain("Record result");
  });

  it("shows a solid Record result only on the Matches the viewer may record", () => {
    const html = tree({ recordableMatchIds: ["r1h2"], onRecord: () => {} });
    expect(buttonNames(html)).toEqual(["Record result for Semifinal 2"]);
    const button = html.match(/<button[^>]*>Record result<\/button>/)?.[0];
    // The solid primary variant (87's rule), not a ghost overlay.
    expect(button).toContain("bg-primary");
  });

  it("offers Edit on a played Match the viewer may record", () => {
    const played = applyResult(three, "r1h2", { order: ["e2", "e3"] });
    const html = tree(
      { recordableMatchIds: ["r1h2", "r2h1"], onRecord: () => {} },
      played,
    );
    expect(buttonNames(html)).toEqual([
      "Edit Semifinal 2",
      "Record result for Final",
    ]);
  });

  it("names who self-reported a Match's result in its box", () => {
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

  it("highlights places 1 and 2 of a Match of 4 with 2 advancing, and only 1st in the final", () => {
    const eight: Entrant[] = Array.from({ length: 8 }, (_, i) => ({
      id: `h${i + 1}`,
      seedPosition: i + 1,
      label: `Entrant ${i + 1}`,
    }));
    const byId = new Map(eight.map((e) => [e.id, entrant(e.id, e.label)]));
    let bracket = matches.generate(
      {
        kind: "group" as const,
        entrantsPerMatch: 4,
        advancePerMatch: 2,
        thirdPlaceMatch: false,
        rounds: {},
      },
      eight,
      (round, position) => `r${round}h${position}`,
    );
    const play = (id: string) => {
      const match = bracket.matches.find((h) => h.id === id)!;
      bracket = matches.applyResult(bracket, id, {
        order: match.slots.map((s) => s.entrantId!),
        scores: {},
      });
    };
    /** The place numbers of the rows marked as advancing in Match `name`. */
    const advancing = (name: string) => {
      const html = tree({}, bracket, byId);
      // The Match's box: from its (last) label to the next group.
      const box = html
        .split(`aria-label="${name}"`)
        .at(-1)!
        .split('role="group"')[0];
      return [
        ...box.matchAll(/data-advances[^>]*>.*?aria-label="Place (\d)"/g),
      ].map((m) => m[1]);
    };

    play("r1h1");
    expect(advancing("Round 1 Match 1")).toEqual(["1", "2"]);
    play("r1h2");
    play("r2h1");
    expect(advancing("Final")).toEqual(["1"]);
  });
});

describe("BracketTree's 3rd place Match", () => {
  it("names the final's winner the winner, and the 3rd place Match's winner 3rd", () => {
    const four: Entrant[] = ["A", "B", "C", "D"].map((label, i) => ({
      id: label,
      seedPosition: i + 1,
      label,
    }));
    let bracket = formats.generate(
      { ...DEFAULT_BRACKET_CONFIG, thirdPlaceMatch: true },
      four,
      (round, position) => `r${round}h${position}`,
    );
    for (const [id, winner] of [
      ["r1h1", "A"],
      ["r1h2", "B"],
      ["r2h1", "A"],
      ["r2h2", "D"],
    ]) {
      const others = bracket.matches
        .find((h) => h.id === id)!
        .slots.map((s) => s.entrantId!)
        .filter((e) => e !== winner);
      bracket = formats.applyResult(bracket, id, {
        order: [winner, ...others],
      });
    }
    const html = tree(
      {},
      bracket,
      new Map(four.map((e) => [e.id, entrant(e.id, e.label)])),
    );
    /** The screen-reader notes in Match `name`'s box. */
    const notes = (name: string) =>
      [
        ...html
          .split(`aria-label="${name}"`)
          .at(-1)!
          .split('role="group"')[0]
          .matchAll(/class="sr-only">([^<]*)</g),
      ].map((m) => m[1].trim());
    expect(notes("Final")).toEqual(["wins"]);
    expect(notes("3rd place Match")).toEqual(["takes 3rd"]);
  });
});

describe("BracketTree, a Group Bracket", () => {
  const group = Array.from({ length: 11 }, (_, i) => ({
    id: `g${i + 1}`,
    seedPosition: i + 1,
    label: `P${i + 1}`,
  }));
  const groupById = new Map(group.map((e) => [e.id, entrant(e.id, e.label)]));
  const newId = (round: number, position: number) => `r${round}h${position}`;
  const eleven = () =>
    matches.generate(
      {
        kind: "group",
        entrantsPerMatch: 4,
        advancePerMatch: 2,
        thirdPlaceMatch: false,
        rounds: {},
      },
      group,
      newId,
    );

  it("offers Edit on each Round heading only to an admin of a Group Bracket", () => {
    const edit = () => {};
    expect(
      buttonNames(tree({ onEditRound: edit }, eleven(), groupById)).filter(
        (name) => name.startsWith("Edit "),
      ),
    ).toEqual(["Edit Round 1", "Edit Round 2", "Edit Final"]);
    expect(buttonNames(tree({}, eleven(), groupById))).toEqual([]);
    expect(buttonNames(tree({ onEditRound: edit }))).toEqual([]);
  });

  it("says how many go on from each Match, Matches of one Round differing", () => {
    const bracket = matches.setMatchAdvance(eleven(), "r1h2", 1, newId);
    const html = tree({}, bracket, groupById);
    const round1 = html.slice(
      html.indexOf('aria-label="Round 1"'),
      html.indexOf('aria-label="Round 2"'),
    );
    expect([...round1.matchAll(/Top \d advances?/g)].map((m) => m[0])).toEqual([
      "Top 2 advance",
      "Top 1 advances",
      "Top 2 advance",
    ]);
    // The 2-Entrant Match of Round 2 is a bye; the Final sends nobody on.
    expect(html).toContain("Bye — advances");
  });
});

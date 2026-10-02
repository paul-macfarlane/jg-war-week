import { describe, expect, it } from "vitest";

import { toAwardsResult } from "@/mcp/awards";

describe("toAwardsResult", () => {
  it("names the Team, Participants and Category of each Award", () => {
    expect(
      toAwardsResult("xi", [
        {
          id: "a",
          name: "MVP",
          description: "Most valuable",
          team: { id: "t", name: "Slytherin", color: "#1a472a" },
          category: { id: "c", name: "War Week MVP", archived: false },
          participants: [
            { id: "p1", displayName: "Dom Favata", teamColor: null },
            { id: "p2", displayName: "Lucas Fernandes", teamColor: null },
          ],
        },
        {
          id: "b",
          name: "Catan Champion",
          description: null,
          team: null,
          category: null,
          participants: [
            { id: "p3", displayName: "Anthony Conway", teamColor: null },
          ],
        },
      ]),
    ).toEqual({
      edition: "xi",
      awards: [
        {
          name: "MVP",
          description: "Most valuable",
          team: "Slytherin",
          category: "War Week MVP",
          participants: ["Dom Favata", "Lucas Fernandes"],
        },
        {
          name: "Catan Champion",
          description: null,
          team: null,
          category: null,
          participants: ["Anthony Conway"],
        },
      ],
    });
  });
});

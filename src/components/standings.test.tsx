import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Standings } from "@/lib/standings";

import { LeaderboardStandings } from "./standings";

const freeForAll: Standings = {
  main: "individual",
  team: [],
  individual: [
    { id: "p1", name: "Neo", team: null, total: 12, rank: 1 },
    { id: "p2", name: "Trinity", team: null, total: 8, rank: 2 },
  ],
};

const teams: Standings = {
  main: "team",
  team: [{ id: "t1", name: "Zion", color: "#00f", total: 12, rank: 1 }],
  individual: [
    {
      id: "p1",
      name: "Neo",
      team: { name: "Zion", color: "#00f" },
      total: 12,
      rank: 1,
    },
  ],
};

describe("LeaderboardStandings", () => {
  it("titles the main list 'Standings' and shows no Team standings heading in free-for-all mode", () => {
    const html = renderToStaticMarkup(
      <LeaderboardStandings
        standings={freeForAll}
        teamLabel="Team"
        primaryColor="#00ff41"
      />,
    );
    const text = html.replace(/<[^>]+>/g, " ");

    expect(html).toMatch(/<h2[^>]*>Standings<\/h2>/);
    expect(text).not.toContain("Team standings");
    expect(text).not.toContain("Individual leaderboard");
  });

  it("titles the team list '<Team Label> standings' in teams mode", () => {
    const html = renderToStaticMarkup(
      <LeaderboardStandings
        standings={teams}
        teamLabel="Squad"
        primaryColor="#00ff41"
      />,
    );
    const text = html.replace(/<[^>]+>/g, " ");

    expect(text).toContain("Squad standings");
    expect(text).toContain("Individual leaderboard");
  });

  it("gives each row an accessible disclosure trigger when a breakdown is given", () => {
    const html = renderToStaticMarkup(
      <LeaderboardStandings
        standings={teams}
        teamLabel="Squad"
        primaryColor="#00ff41"
        breakdown={{
          byTeam: new Map([
            [
              "t1",
              [
                {
                  id: "e1",
                  competition: "Chess",
                  points: 12,
                  when: new Date("2026-02-01"),
                },
              ],
            ],
          ]),
          byParticipant: new Map([
            [
              "p1",
              [
                {
                  id: "e1",
                  competition: "Chess",
                  points: 12,
                  when: new Date("2026-02-01"),
                },
              ],
            ],
          ]),
        }}
      />,
    );

    expect(html).toMatch(
      /aria-expanded="false"[^>]*aria-label="Show points breakdown for Zion"/,
    );
    expect(html).toMatch(
      /aria-expanded="false"[^>]*aria-label="Show points breakdown for Neo"/,
    );
  });

  it("shows each list as a results table with no Score column and no Provisional badge", () => {
    const html = renderToStaticMarkup(
      <LeaderboardStandings
        standings={teams}
        teamLabel="Squad"
        primaryColor="#00ff41"
      />,
    );
    const text = html.replace(/<[^>]+>/g, " ");

    expect(html).toMatch(/<table[^>]*aria-label="Squad standings"/);
    expect(html).toMatch(/<table[^>]*aria-label="Individual leaderboard"/);
    expect(html).toMatch(/<th[^>]*aria-sort="ascending"[^>]*>[\s\S]*?Rank/);
    expect(text).toContain("War Week points");
    expect(text).toContain("Winner");
    expect(text).not.toContain("Score");
    expect(text).not.toContain("Provisional");
  });
});

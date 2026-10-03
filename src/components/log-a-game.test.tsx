import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LogAGame } from "./log-a-game";

describe("LogAGame", () => {
  it("links each loggable Competition to its page with the form open", () => {
    const html = renderToStaticMarkup(
      <LogAGame
        edition="xii"
        competitions={[
          { id: "c1", name: "Bouncy Pong", gameFormat: "head-to-head" },
          { id: "c2", name: "Mini Golf", gameFormat: "best-score" },
        ]}
      />,
    );
    expect(html).toMatch(/<h2[^>]*>Log a Game<\/h2>/);
    expect(html).toContain('href="/xii/competitions/c1?log=1"');
    expect(html).toContain('href="/xii/competitions/c2?log=1"');
    expect(html).toContain("Bouncy Pong");
    expect(html).toContain("Best score");
  });

  it("renders nothing when there is no Competition to log in", () => {
    expect(
      renderToStaticMarkup(<LogAGame edition="xii" competitions={[]} />),
    ).toBe("");
  });
});

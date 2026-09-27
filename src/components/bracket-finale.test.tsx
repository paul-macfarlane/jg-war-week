import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BracketFinaleRow } from "@/lib/bracket/finale";

import { BracketFinaleStage } from "./bracket-finale";

// Gold beat Red in the final; Blue and Green share 3rd.
const rows: BracketFinaleRow[] = [
  { entrantId: "gold", label: "Gold", color: "#ca8a04", place: 1 },
  { entrantId: "red", label: "Red", color: "#f00", place: 2 },
  { entrantId: "blue", label: "Blue", color: "#00f", place: 3 },
  { entrantId: "green", label: "Green", color: null, place: 3 },
];

function render(
  phase: "ready" | "playing" | "done",
  finale?: { shown: boolean; progress: number }[],
) {
  const html = renderToStaticMarkup(
    <BracketFinaleStage
      phase={phase}
      rows={rows}
      finale={finale}
      competitionName="Tug of War"
      edition="xi"
      storyTheme="The Matrix"
      scoring="team"
      primaryColor="#00ff41"
      startedAt={null}
      onStart={() => {}}
    />,
  );
  return { html, text: html.replace(/<[^>]+>/g, " ") };
}

describe("BracketFinaleStage", () => {
  it("opens on a Start button with the Competition's title, spoiling no placings", () => {
    const { html, text } = render("ready");
    expect(html).toContain('data-finale="ready"');
    expect(html).toMatch(/<button[^>]*>[^<]*Start/);
    expect(text).toContain("War Week XI");
    expect(text).toContain("Tug of War");
    for (const name of ["Gold", "Red", "Blue", "Green"]) {
      expect(text).not.toContain(name);
    }
  });

  it("while playing, lists only the places shown so far and no champion", () => {
    const { html, text } = render("playing", [
      { shown: false, progress: 0 },
      { shown: false, progress: 0 },
      { shown: true, progress: 0.5 },
      { shown: true, progress: 0.5 },
    ]);
    expect(html).toContain('data-finale="playing"');
    expect(text).toContain("Blue");
    expect(text).toContain("Green");
    expect(text).not.toContain("Red");
    expect(text).not.toContain("Gold");
    expect(html).not.toContain('aria-label="Champion"');
    expect(text).not.toContain("Champion of");
  });

  it("when done, lists every place and crowns the champion", () => {
    const { html, text } = render("done");
    expect(html).toContain('data-finale="done"');
    for (const name of ["Gold", "Red", "Blue", "Green"]) {
      expect(text).toContain(name);
    }
    expect(html).toMatch(/aria-label="Champion"[\s\S]*🏆[\s\S]*Gold/);
    expect(text).toContain("Champion of Tug of War");
    expect(html).toMatch(/<button[^>]*>[^<]*Replay/);
  });
});

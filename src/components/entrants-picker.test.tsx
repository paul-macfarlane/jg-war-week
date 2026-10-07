import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EntrantsPair, EntrantsPicker } from "./entrants-picker";

const noop = () => {};

describe("EntrantsPicker", () => {
  it("labels a team kind by the Team label and shows the chosen count", () => {
    const html = renderToStaticMarkup(
      <EntrantsPicker
        description="d"
        kind="team"
        kindLabel="Cabin"
        options={[{ id: "t1", label: "Red" }]}
        selected={["t1"]}
        onChange={noop}
      />,
    );
    expect(html).toContain("Cabins (1 chosen)");
    expect(html).toContain("Red");
  });

  it("placeholders a team kind's empty picker by the Team label", () => {
    const html = renderToStaticMarkup(
      <EntrantsPicker
        description="d"
        kind="team"
        kindLabel="Cabin"
        options={[]}
        selected={[]}
        onChange={noop}
      />,
    );
    expect(html).toContain("Find a Cabin");
  });

  it("labels a participant kind by name alone", () => {
    const html = renderToStaticMarkup(
      <EntrantsPicker
        description="d"
        kind="participant"
        options={[]}
        selected={[]}
        onChange={noop}
      />,
    );
    expect(html).toContain("Pick Participants (0 chosen)");
    expect(html).toContain("Find by name");
    expect(html).not.toContain("Find by name or");
  });

  it("labels a squad kind", () => {
    const html = renderToStaticMarkup(
      <EntrantsPicker
        description="d"
        kind="squad"
        options={[]}
        selected={[]}
        onChange={noop}
      />,
    );
    expect(html).toContain("Squads (0 chosen)");
    expect(html).toContain("Find a Squad");
  });

  it("renders a caller-owned note above the picker field", () => {
    const html = renderToStaticMarkup(
      <EntrantsPicker
        description="d"
        kind="team"
        options={[]}
        selected={[]}
        onChange={noop}
        note={<p>All Teams</p>}
      />,
    );
    expect(html).toContain("All Teams");
  });

  it("has no Save button: Entrants autosave", () => {
    const html = renderToStaticMarkup(
      <EntrantsPicker
        description="d"
        kind="team"
        options={[]}
        selected={[]}
        onChange={noop}
      />,
    );
    expect(html).not.toContain("Save Entrants");
    expect(html).not.toContain("<button");
  });

  it("shows the autosave status beside the legend and a refusal under the picker", () => {
    const html = renderToStaticMarkup(
      <EntrantsPicker
        description="d"
        kind="team"
        options={[]}
        selected={[]}
        onChange={noop}
        status={<p>Saving…</p>}
        error="Locked once a Match has a result."
      />,
    );
    expect(html).toMatch(/Entrants<\/legend><p>Saving…<\/p>/);
    expect(html).toMatch(
      /role="alert"[^>]*>Locked once a Match has a result\.<\/div>/,
    );
  });
});

describe("EntrantsPair", () => {
  it("picks a Head-to-head's two Participants as A vs B", () => {
    const html = renderToStaticMarkup(
      <EntrantsPair
        description="d"
        kind="participant"
        options={[]}
        participantOptions={[]}
        value={["", ""]}
        onChange={noop}
      />,
    );
    expect(html).toContain(">Participant A</label>");
    expect(html).toContain(">vs<");
    expect(html).toContain(">Participant B</label>");
    expect(html).not.toContain("Save");
  });

  it("labels a team pair by the Team label", () => {
    const html = renderToStaticMarkup(
      <EntrantsPair
        description="d"
        kind="team"
        kindLabel="Cabin"
        options={[
          { id: "t1", label: "Red" },
          { id: "t2", label: "Blue" },
        ]}
        value={["t1", "t2"]}
        onChange={noop}
      />,
    );
    expect(html).toContain(">Cabin A</label>");
    expect(html).toContain(">Cabin B</label>");
    expect(html).toContain("Red");
    expect(html).toContain("Blue");
  });
});

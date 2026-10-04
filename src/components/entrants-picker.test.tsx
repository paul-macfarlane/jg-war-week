import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EntrantsPicker } from "./entrants-picker";

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
        onSave={noop}
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
        onSave={noop}
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
        onSave={noop}
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
        onSave={noop}
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
        onSave={noop}
        note={<p>All Teams</p>}
      />,
    );
    expect(html).toContain("All Teams");
  });

  it("disables Save when there's nothing to save", () => {
    const html = renderToStaticMarkup(
      <EntrantsPicker
        description="d"
        kind="team"
        options={[]}
        selected={[]}
        onChange={noop}
        onSave={noop}
        saveDisabled
      />,
    );
    const button = html.match(/<button[^>]*>Save Entrants<\/button>/)?.[0];
    expect(button).toContain("disabled");
  });
});

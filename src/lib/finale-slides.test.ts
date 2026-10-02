import { describe, expect, it } from "vitest";

import {
  type FinaleSlideRow,
  backFinalePosition,
  completeFinaleSlide,
  moveToIndex,
  nextFinalePosition,
  resolveFinaleSlides,
  visibleFinaleSlides,
} from "./finale-slides";

const row = (
  kind: FinaleSlideRow["kind"],
  sortOrder: number,
  extra: Partial<FinaleSlideRow> = {},
): FinaleSlideRow => ({
  id: `id-${kind}-${extra.heading ?? ""}`,
  kind,
  sortOrder,
  hidden: false,
  heading: null,
  body: null,
  backgroundColor: null,
  ...extra,
});

const names = (slides: { name: string }[]) => slides.map((s) => s.name);

describe("resolveFinaleSlides", () => {
  it("uses the default order, nothing hidden, when a War Week has no saved list", () => {
    const slides = resolveFinaleSlides([]);
    expect(names(slides)).toEqual([
      "Title",
      "By the numbers",
      "Awards",
      "Champions",
      "Standings countdown",
      "Winner",
    ]);
    expect(slides.every((s) => !s.hidden && s.id === null)).toBe(true);
    expect(slides.map((s) => s.key)).toEqual([
      "title",
      "numbers",
      "awards",
      "champions",
      "standings",
      "winner",
    ]);
  });

  it("follows a saved order by sort order", () => {
    const slides = resolveFinaleSlides([
      row("winner", 5),
      row("standings", 0),
      row("title", 1),
      row("numbers", 2),
      row("awards", 3),
      row("champions", 4),
    ]);
    expect(names(slides)).toEqual([
      "Standings countdown",
      "Title",
      "By the numbers",
      "Awards",
      "Champions",
      "Winner",
    ]);
    expect(slides[0].id).toBe("id-standings-");
  });

  it("keeps hidden slides in the list and drops them from the Finale", () => {
    const slides = resolveFinaleSlides([
      row("title", 0),
      row("numbers", 1, { hidden: true }),
      row("awards", 2),
      row("champions", 3, { hidden: true }),
      row("standings", 4),
      row("winner", 5),
    ]);
    expect(slides).toHaveLength(6);
    expect(slides.filter((s) => s.hidden).map((s) => s.name)).toEqual([
      "By the numbers",
      "Champions",
    ]);
    expect(names(visibleFinaleSlides(slides))).toEqual([
      "Title",
      "Awards",
      "Standings countdown",
      "Winner",
    ]);
  });

  it("appends a built-in missing from the saved rows, in its default order", () => {
    const slides = resolveFinaleSlides([
      row("standings", 0),
      row("title", 1),
      row("winner", 2),
    ]);
    expect(names(slides)).toEqual([
      "Standings countdown",
      "Title",
      "Winner",
      "By the numbers",
      "Awards",
      "Champions",
    ]);
    expect(slides.slice(3).every((s) => s.id === null && !s.hidden)).toBe(true);
  });

  it("keeps Custom slides where they were saved, named by heading", () => {
    const slides = resolveFinaleSlides([
      row("title", 0),
      row("custom", 1, { heading: "Welcome" }),
      row("numbers", 2),
      row("awards", 3),
      row("champions", 4),
      row("standings", 5),
      row("winner", 6),
      row("custom", 7, { heading: "Thank you", backgroundColor: "#112233" }),
    ]);
    expect(names(slides)).toEqual([
      "Title",
      "Welcome",
      "By the numbers",
      "Awards",
      "Champions",
      "Standings countdown",
      "Winner",
      "Thank you",
    ]);
    expect(slides[7]).toMatchObject({
      kind: "custom",
      key: "id-custom-Thank you",
      heading: "Thank you",
      backgroundColor: "#112233",
    });
  });
});

describe("moveToIndex", () => {
  const ids = ["a", "b", "c", "d"];

  it("moves an id later in the list", () => {
    expect(moveToIndex(ids, "a", 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an id earlier in the list", () => {
    expect(moveToIndex(ids, "d", 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("leaves the order alone when the index is where it already is", () => {
    expect(moveToIndex(ids, "b", 1)).toEqual(ids);
  });

  it("clamps an index past either end", () => {
    expect(moveToIndex(ids, "b", 99)).toEqual(["a", "c", "d", "b"]);
    expect(moveToIndex(ids, "c", -3)).toEqual(["c", "a", "b", "d"]);
  });

  it("is null for an id not in the list", () => {
    expect(moveToIndex(ids, "z", 0)).toBeNull();
  });
});

describe("stepping through the Finale", () => {
  // Title (no steps), the Standings countdown (one step), Winner (no steps).
  const steps = [0, 1, 0];

  it("moves on from a slide with no steps", () => {
    expect(nextFinalePosition({ index: 0, step: 0 }, steps)).toEqual({
      index: 1,
      step: 0,
    });
  });

  it("finishes a slide's next step before moving on", () => {
    expect(nextFinalePosition({ index: 1, step: 0 }, steps)).toEqual({
      index: 1,
      step: 1,
    });
    expect(nextFinalePosition({ index: 1, step: 1 }, steps)).toEqual({
      index: 2,
      step: 0,
    });
  });

  it("does nothing on Next at the end of the last slide", () => {
    expect(nextFinalePosition({ index: 2, step: 0 }, steps)).toEqual({
      index: 2,
      step: 0,
    });
  });

  it("goes back to the previous slide in its final state", () => {
    expect(backFinalePosition({ index: 2, step: 0 }, steps)).toEqual({
      index: 1,
      step: 1,
    });
    expect(backFinalePosition({ index: 0, step: 0 }, steps)).toEqual({
      index: 0,
      step: 0,
    });
  });

  it("marks the current slide done when it finishes by itself", () => {
    expect(completeFinaleSlide({ index: 1, step: 0 }, 1, steps)).toEqual({
      index: 1,
      step: 1,
    });
    // A slide the presenter already left changes nothing.
    expect(completeFinaleSlide({ index: 2, step: 0 }, 1, steps)).toEqual({
      index: 2,
      step: 0,
    });
  });
});

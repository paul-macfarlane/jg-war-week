import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { AwardView } from "@/lib/awards";
import type { ResultEntry, ResultTarget } from "@/lib/recent-results";
import type { Standings } from "@/lib/standings";

import {
  type FinaleSlideContext,
  type FinaleSlideRow,
  backFinalePosition,
  byTheNumbers,
  championsList,
  completeFinaleSlide,
  finaleSlideData,
  finaleSlideSteps,
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

/** The XII demo seed, read as the seed loader reads it. */
const xii = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../seeds/demo/xii.json"), "utf8"),
) as {
  participants: unknown[];
  pointsEntries: { competition: string; points: number }[];
};

describe("byTheNumbers", () => {
  it("shows the XII demo's figures, leaving out the zeros", () => {
    // What the XII demo loads: its roster and its Points Entries; no Game
    // is logged and no Heat played.
    const figures = byTheNumbers({
      competitionsRun: new Set(xii.pointsEntries.map((e) => e.competition))
        .size,
      gamesLogged: 0,
      heatsPlayed: 0,
      pointsEntries: xii.pointsEntries.length,
      pointsHandedOut: xii.pointsEntries.reduce((sum, e) => sum + e.points, 0),
      participants: xii.participants.length,
    });
    expect(figures).toEqual([
      { label: "Competitions run", value: "2" },
      { label: "Points Entries", value: "18" },
      { label: "Points handed out", value: "44.5" },
      { label: "Participants", value: "12" },
    ]);
  });

  it("shows every figure in order, grouped by thousands, one in the singular", () => {
    expect(
      byTheNumbers({
        competitionsRun: 1,
        gamesLogged: 1204,
        heatsPlayed: 31,
        pointsEntries: 2,
        pointsHandedOut: 1234.567,
        participants: 1,
      }),
    ).toEqual([
      { label: "Competition run", value: "1" },
      { label: "Games logged", value: "1,204" },
      { label: "Heats played", value: "31" },
      { label: "Points Entries", value: "2" },
      { label: "Points handed out", value: "1,234.57" },
      { label: "Participant", value: "1" },
    ]);
  });

  it("is empty when every figure is zero", () => {
    expect(
      byTheNumbers({
        competitionsRun: 0,
        gamesLogged: 0,
        heatsPlayed: 0,
        pointsEntries: 0,
        pointsHandedOut: 0,
        participants: 0,
      }),
    ).toEqual([]);
  });
});

describe("championsList", () => {
  const at = (minute: number) => new Date(Date.UTC(2027, 1, 26, 17, minute));
  const person = (id: string, name: string): ResultTarget => ({
    id,
    name,
    image: null,
    color: "#ff0000",
    kind: "participant",
  });
  const fay = person("p-fay", "Fay Falcon");
  const ada = person("p-ada", "Ada Anvil");
  const jax = person("p-jax", "Jax Jetpack");
  const red: ResultTarget = {
    id: "t-red",
    name: "Red",
    color: "#ff0000",
    kind: "team",
  };
  let n = 0;
  const generated = (
    competitionId: string,
    target: ResultTarget,
    points: number,
  ): ResultEntry => ({
    id: `e${n++}`,
    competitionId,
    points,
    enteredAt: at(0),
    generatedByBracket: true,
    target,
  });

  it("lists each finalized Bracket's champion and each closed Competition's winner, ties together, by close time", () => {
    const champions = championsList(
      [
        // Closed last: listed last.
        {
          id: "chess",
          name: "Chess Heats",
          format: "heats",
          finalizedAt: at(30),
        },
        { id: "pong", name: "Ping Pong", format: "games", finalizedAt: at(10) },
        {
          id: "workout",
          name: "Daily Workout Check-in",
          format: "participation",
          finalizedAt: at(20),
        },
        // An individual Participation Competition has no winner.
        {
          id: "steps",
          name: "Step Check-in",
          format: "participation",
          finalizedAt: at(5),
        },
        // Not closed, or a points Competition: never a champion.
        {
          id: "open",
          name: "Open Bracket",
          format: "single-elimination",
          finalizedAt: null,
        },
        { id: "mile", name: "Mile Run", format: "points", finalizedAt: at(1) },
      ],
      [
        generated("chess", ada, 5),
        generated("chess", fay, 3),
        generated("chess", jax, 1),
        generated("pong", fay, 3),
        generated("pong", jax, 3),
        generated("pong", ada, 1),
        generated("workout", red, 4),
        generated("steps", fay, 1),
        generated("steps", ada, 1),
        generated("open", fay, 9),
        { ...generated("mile", jax, 3), generatedByBracket: false },
      ],
    );
    expect(champions).toEqual([
      {
        competitionId: "pong",
        competition: "Ping Pong",
        format: "games",
        winners: [fay, jax],
      },
      {
        competitionId: "workout",
        competition: "Daily Workout Check-in",
        format: "participation",
        winners: [red],
      },
      {
        competitionId: "chess",
        competition: "Chess Heats",
        format: "heats",
        winners: [ada],
      },
    ]);
  });

  it("is empty with nothing finalized", () => {
    expect(
      championsList(
        [{ id: "mile", name: "Mile Run", format: "points", finalizedAt: null }],
        [],
      ),
    ).toEqual([]);
  });
});

describe("finaleSlideData", () => {
  const team = (name: string, total: number, rank: number) => ({
    id: `t-${name}`,
    name,
    color: "#123456",
    total,
    rank,
  });
  const award = (
    name: string,
    category: { id: string; name: string } | null,
  ): AwardView => ({
    id: `a-${name}`,
    name,
    description: null,
    team: null,
    category: category && { ...category, archived: false },
    participants: [
      { id: "p-ada", displayName: "Ada Anvil", image: null, teamColor: null },
    ],
  });
  const grind = { id: "c-grind", name: "Grind" };
  const mvp = { id: "c-mvp", name: "War Week MVP" };
  const standings: Standings = {
    main: "team",
    team: [team("Red", 40, 1), team("Blue", 40, 1), team("Green", 12, 3)],
    individual: [],
  };
  const context = (
    extra: Partial<FinaleSlideContext> = {},
  ): FinaleSlideContext => ({
    warWeek: {
      edition: "xii",
      year: 2027,
      storyTheme: "Wrapped",
      logoUrl: null,
      bannerUrl: null,
      teamLabel: "Team",
      primaryColor: "#123456",
      finaleAwardsLayout: "one-slide",
    },
    standings,
    counts: {
      competitionsRun: 2,
      gamesLogged: 0,
      heatsPlayed: 0,
      pointsEntries: 3,
      pointsHandedOut: 92,
      participants: 12,
    },
    awards: [
      award("Black Midnight", null),
      award("Hardest Worker", grind),
      award("MVP", mvp),
      award("Most Steps", grind),
    ],
    champions: [
      {
        competitionId: "pong",
        competition: "Ping Pong",
        format: "games",
        winners: [
          { id: "p-ada", name: "Ada Anvil", color: null, kind: "participant" },
        ],
      },
    ],
    ...extra,
  });
  const defaults = resolveFinaleSlides([]);
  const kinds = (slides: { kind: string; name: string }[]) =>
    slides.map((s) => `${s.kind}:${s.name}`);

  it("plays every default slide when each has something to show", () => {
    const slides = finaleSlideData(defaults, context());
    expect(kinds(slides)).toEqual([
      "title:Title",
      "numbers:By the numbers",
      "awards:Awards",
      "champions:Champions",
      "standings:Standings countdown",
      "winner:Winner",
    ]);
    expect(slides[0]).toMatchObject({
      edition: "xii",
      year: 2027,
      storyTheme: "Wrapped",
    });
    expect(slides[1]).toMatchObject({
      figures: [
        { label: "Competitions run", value: "2" },
        { label: "Points Entries", value: "3" },
        { label: "Points handed out", value: "92" },
        { label: "Participants", value: "12" },
      ],
    });
    // Ties at first place show together, as the Winner on End reads them.
    expect(slides[5]).toMatchObject({ title: "Tie: Red & Blue" });
  });

  it("puts every Award on one slide, by Category, the uncategorized last, one Award per step", () => {
    const [awards] = finaleSlideData(defaults, context()).filter(
      (s) => s.kind === "awards",
    );
    expect(awards).toMatchObject({
      kind: "awards",
      heading: "Awards",
      groups: [
        {
          name: "Grind",
          awards: [{ name: "Hardest Worker" }, { name: "Most Steps" }],
        },
        { name: "War Week MVP", awards: [{ name: "MVP" }] },
        { name: "Other Awards", awards: [{ name: "Black Midnight" }] },
      ],
    });
    expect(finaleSlideSteps(awards)).toBe(4);
  });

  it("gives each Category its own Awards slide in the per-Category layout", () => {
    const slides = finaleSlideData(
      defaults,
      context({
        warWeek: { ...context().warWeek, finaleAwardsLayout: "per-category" },
      }),
    );
    const awards = slides.filter((s) => s.kind === "awards");
    expect(kinds(awards)).toEqual([
      "awards:Awards: Grind",
      "awards:Awards: War Week MVP",
      "awards:Other Awards",
    ]);
    expect(new Set(slides.map((s) => s.key)).size).toBe(slides.length);
    expect(awards.map((s) => finaleSlideSteps(s))).toEqual([2, 1, 1]);
    expect(awards[0]).toMatchObject({
      heading: "Grind",
      groups: [
        {
          name: null,
          awards: [{ name: "Hardest Worker" }, { name: "Most Steps" }],
        },
      ],
    });
  });

  it("shows no Category headings when no Award has a Category", () => {
    const [awards] = finaleSlideData(
      defaults,
      context({ awards: [award("Black Midnight", null)] }),
    ).filter((s) => s.kind === "awards");
    expect(awards).toMatchObject({
      groups: [{ name: null, awards: [{ name: "Black Midnight" }] }],
    });
  });

  it("skips the slides with nothing to show", () => {
    const empty = context({
      counts: {
        competitionsRun: 0,
        gamesLogged: 0,
        heatsPlayed: 0,
        pointsEntries: 0,
        pointsHandedOut: 0,
        participants: 0,
      },
      awards: [],
      champions: [],
      standings: { main: "individual", team: [], individual: [] },
    });
    expect(kinds(finaleSlideData(defaults, empty))).toEqual(["title:Title"]);
  });

  it("skips the Winner while every total is zero", () => {
    const slides = finaleSlideData(
      defaults,
      context({
        standings: {
          main: "team",
          team: [team("Red", 0, 1), team("Blue", 0, 1)],
          individual: [],
        },
      }),
    );
    expect(slides.map((s) => s.kind)).not.toContain("winner");
    expect(slides.map((s) => s.kind)).toContain("standings");
  });

  it("names a single first place as the Winner, with its total", () => {
    const [winner] = finaleSlideData(
      defaults,
      context({
        standings: {
          main: "team",
          team: [team("Red", 40.5, 1), team("Blue", 12, 2)],
          individual: [],
        },
      }),
    ).filter((s) => s.kind === "winner");
    expect(winner).toMatchObject({
      title: "Red",
      tie: false,
      rows: [{ name: "Red", total: "40.5" }],
    });
  });

  it("keeps hidden slides out", () => {
    const slides = finaleSlideData(
      defaults.map((s) => (s.kind === "numbers" ? { ...s, hidden: true } : s)),
      context(),
    );
    expect(slides.map((s) => s.kind)).not.toContain("numbers");
  });
});

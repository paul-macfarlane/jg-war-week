import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { SetupCompetition } from "@/queries/setup";

import { CompetitionsEditor, NewCompetitionForm } from "./competitions-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
// Server actions can't load in a component test.
vi.mock("@/actions/setup", () => ({
  createCompetition: vi.fn(),
  deleteCompetition: vi.fn(),
}));

function competition(
  name: string,
  scoring: "team" | "individual",
): SetupCompetition {
  return {
    id: name.toLowerCase(),
    name,
    description: null,
    scoring,
    placementPoints: [],
    countsTowardTeam: false,
    competitionGroup: null,
    format: "placement",
    pointsEntryCount: 0,
    scheduleItemCount: 0,
  };
}

function list(mode: "teams" | "free-for-all") {
  return renderToStaticMarkup(
    <CompetitionsEditor
      warWeekId="ww"
      isOrganizer={false}
      competitions={[
        competition("Chess", "individual"),
        competition("Relay", "team"),
      ]}
      mode={mode}
      teamLabel="House"
    />,
  );
}

function form(mode: "teams" | "free-for-all") {
  return renderToStaticMarkup(
    <NewCompetitionForm
      warWeekId="ww"
      mode={mode}
      teamLabel="House"
      onSaved={() => {}}
    />,
  );
}

describe("CompetitionsEditor's list (spec R20, decision 12)", () => {
  it("labels each Competition Individual or by the Team Label in a teams War Week", () => {
    const html = list("teams");
    expect(html).toContain("Individual · Placement");
    expect(html).toContain("House · Placement");
  });

  it("drops Individual in a free-for-all War Week, but a Team Competition still says its Team Label", () => {
    const html = list("free-for-all");
    expect(html).not.toContain("Individual");
    expect(html).toContain("House · Placement");
  });
});

describe("NewCompetitionForm (spec R20, decision 12)", () => {
  it("asks for Scoring in a teams War Week", () => {
    expect(form("teams")).toContain(">Scoring</label>");
  });

  it("shows no Scoring choice in a free-for-all War Week (Individual is implied)", () => {
    const html = form("free-for-all");
    expect(html).not.toContain("Scoring");
    expect(html).toContain(">Format</label>");
  });
});

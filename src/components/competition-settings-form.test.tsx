import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  APPLIES_AT_NEXT_FINALIZE,
  type CompetitionLockFacts,
  LOCKED_BY_HEAT_RESULT,
  LOCKED_BY_RESULT,
  LOCKED_WHILE_FINALIZED,
} from "@/lib/competition-locks";
import {
  type CompetitionSettingsSource,
  settingsValuesOf,
} from "@/lib/competition-page";

import { CompetitionSettingsForm } from "./competition-settings-form";

vi.mock("@/actions/setup", () => ({ saveCompetitionSetting: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const SOURCE: CompetitionSettingsSource = {
  name: "Darts",
  description: null,
  competitionGroup: null,
  hosts: ["ana@jahnelgroup.com"],
  placementPoints: [10, 7, 5],
  participationPoints: null,
  format: "placement",
  scoring: "individual",
  countsTowardTeam: false,
  scoreDirection: "none",
  gameConfig: null,
  entrantsOpen: false,
  bracketConfig: null,
  selfEnroll: false,
  entrantLimit: null,
  enrollClosesAt: null,
  loggingClosesAt: null,
  selfReport: false,
  selfCheckIn: false,
  checkInClosesAt: null,
};

const OPEN: CompetitionLockFacts = {
  hasResult: false,
  hasHeatResult: false,
  finalized: false,
};

function render(
  over: Partial<CompetitionSettingsSource> = {},
  props: Partial<Parameters<typeof CompetitionSettingsForm>[0]> = {},
) {
  return renderToStaticMarkup(
    <CompetitionSettingsForm
      competitionId="c1"
      initial={settingsValuesOf({ ...SOURCE, ...over })}
      facts={OPEN}
      mode="teams"
      teamLabel="Team"
      groupSuggestions={[]}
      canAssignHosts
      hostNames={["Ana P"]}
      entrantCount={0}
      {...props}
    />,
  );
}

/** The element carrying `id`, as markup. */
function control(html: string, id: string): string {
  return html.match(new RegExp(`<(?:input|button)[^>]*id="${id}"[^>]*>`))![0];
}

const CHECKED = /\schecked=""/;
const DISABLED = /\sdisabled=""/;

describe("CompetitionSettingsForm", () => {
  it("says changes save automatically, with no Save button", () => {
    const html = render();
    expect(html).toContain("Changes save automatically");
    expect(html).not.toMatch(/>Save</);
  });

  it("offers every Format while the Competition has no result", () => {
    const html = render();
    expect(control(html, "competition-format")).not.toMatch(DISABLED);
    expect(html).not.toContain(LOCKED_BY_RESULT);
  });

  it("locks the Format, scoring and Score direction with the reason once a result exists, but never the name", () => {
    const html = render({}, { facts: { ...OPEN, hasResult: true } });
    expect(control(html, "competition-format")).toMatch(DISABLED);
    expect(control(html, "competition-scoring")).toMatch(DISABLED);
    expect(control(html, "competition-scoreDirection")).toMatch(DISABLED);
    expect(html).toContain(LOCKED_BY_RESULT);
    expect(control(html, "competition-name")).not.toMatch(DISABLED);
  });

  it("says a Placement Points change while Finalized applies at the next Finalize, and locks the rest", () => {
    const html = render(
      {},
      { facts: { hasResult: true, hasHeatResult: false, finalized: true } },
    );
    expect(html).toContain(APPLIES_AT_NEXT_FINALIZE);
    expect(html).toContain(LOCKED_BY_RESULT);
  });

  it("locks an enrollment setting only while Finalized, with the Reopen reason", () => {
    const bracket = { format: "bracket" as const, selfEnroll: true };
    const open = render(bracket, { facts: { ...OPEN, hasResult: true } });
    expect(control(open, "competition-selfEnroll")).not.toMatch(DISABLED);
    const finalized = render(bracket, {
      facts: { hasResult: true, hasHeatResult: true, finalized: true },
    });
    expect(control(finalized, "competition-selfEnroll")).toMatch(DISABLED);
    expect(finalized).toContain(LOCKED_WHILE_FINALIZED);
  });

  it("shows a Host the Hosts as names only, never an email", () => {
    const html = render(
      { hosts: [] },
      { canAssignHosts: false, hostNames: ["Ana P", "bo.k"] },
    );
    expect(html).toContain("Ana P, bo.k");
    expect(html).toContain("Only an Organizer assigns Hosts.");
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]+/i);
  });

  it("lets an Organizer pick Hosts, a current Host off the roster shown warned", () => {
    const html = render();
    expect(html).toContain("ana@jahnelgroup.com (not on the roster)");
    expect(html).not.toContain("Only an Organizer assigns Hosts.");
  });

  it("shows an Organizer a current Host by their roster name", () => {
    const html = render(
      {},
      {
        hostCandidates: [
          { id: "p1", name: "Ana P", email: "ana@jahnelgroup.com" },
        ],
      },
    );
    expect(html).toContain("Ana P");
    expect(html).not.toContain("not on the roster");
  });

  describe("a Bracket's heat settings", () => {
    const bracket = { format: "bracket" as const };

    it("offers the head-to-head preset, Heat size and how many advance", () => {
      const html = render(bracket);
      expect(html).toContain("Head-to-head (single elimination)");
      expect(html).toContain("Entrants per Heat");
      expect(html).toContain("How many advance");
      expect(html).toContain("Self-report");
      expect(html).not.toContain("Score direction");
    });

    it("shows the 3rd place game off and disabled with its reason under 4 Entrants", () => {
      const html = render(bracket);
      expect(html).toContain("A 3rd place game needs at least 4 Entrants.");
      const third = control(html, "bracket-third-place");
      expect(third).toMatch(DISABLED);
      expect(third).not.toMatch(CHECKED);
    });

    it("shows a saved 3rd place game as on under 4 Entrants, and lets it be turned off", () => {
      const html = render(
        {
          ...bracket,
          bracketConfig: {
            entrantsPerHeat: 2,
            advancePerHeat: 1,
            thirdPlaceGame: true,
          },
        },
        { entrantCount: 3 },
      );
      const third = control(html, "bracket-third-place");
      expect(third).toMatch(CHECKED);
      expect(third).not.toMatch(DISABLED);
      expect(html).toContain(
        "A 3rd place game needs at least 4 Entrants. Turn it off, or enter 4, to generate.",
      );
    });

    it("locks the heat settings once a Heat has a result", () => {
      const html = render(
        {
          ...bracket,
          bracketConfig: {
            entrantsPerHeat: 2,
            advancePerHeat: 1,
            thirdPlaceGame: true,
          },
        },
        {
          entrantCount: 4,
          facts: { hasResult: true, hasHeatResult: true, finalized: false },
        },
      );
      expect(control(html, "bracket-third-place")).toMatch(DISABLED);
      expect(html).toContain(LOCKED_BY_HEAT_RESULT);
    });

    it("offers no 3rd place game at another Heat size", () => {
      const html = render({
        ...bracket,
        bracketConfig: {
          entrantsPerHeat: 4,
          advancePerHeat: 2,
          thirdPlaceGame: false,
        },
      });
      expect(html).not.toContain("3rd place game");
    });
  });

  describe("a Games Format's settings", () => {
    it("shows Draws allowed and Best of for Head-to-head, not Best score's", () => {
      const html = render({ format: "head-to-head" });
      expect(html).toContain("Draws allowed");
      expect(html).toContain("Best of");
      expect(html).not.toContain("Better is");
      expect(html).toContain("Logging closes");
    });

    it("shows count, direction and unit for Best score, not Best of", () => {
      const html = render({ format: "best-score" });
      expect(html).toContain("Better is");
      expect(html).toContain("Unit");
      expect(html).not.toContain("Best of");
    });

    it("hides the enroll switch once a fixed list has a Best of set", () => {
      const html = render({
        format: "head-to-head",
        entrantsOpen: false,
        gameConfig: { drawsAllowed: false, bestOf: 3 },
      });
      expect(html).not.toContain("Participants can enroll");
      expect(html).toContain(
        "Best of needs a fixed list of exactly two Entrants.",
      );
    });

    it("shows the enroll switch on a fixed list with Best of off", () => {
      const html = render({ format: "head-to-head", entrantsOpen: false });
      expect(html).toContain("Participants can enroll");
    });

    it("has no Finish Points field", () => {
      expect(render({ format: "head-to-head" })).not.toContain("Finish Points");
      expect(render({ format: "best-score" })).not.toContain("Finish Points");
    });
  });

  it("gives an individual Participation Competition points per Participant and check-in", () => {
    const html = render({
      format: "participation",
      participationPoints: 2,
      placementPoints: null,
    });
    expect(html).toContain("Points per Participant");
    expect(html).toContain("Participants can check in");
    expect(html).not.toContain("1st place Placement Points");
  });
});

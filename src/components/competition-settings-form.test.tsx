import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  APPLIES_AT_NEXT_CLOSE,
  type CompetitionLockFacts,
  LOCKED_BY_MATCH,
  LOCKED_BY_MATCH_RESULT,
  LOCKED_BY_RESULT,
  LOCKED_WHILE_CLOSED,
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
  scoreUnit: null,
  seriesConfig: null,
  bestScoreConfig: null,
  bracketConfig: null,
  selfEnroll: false,
  entrantLimit: null,
  selfReport: false,
  selfCheckIn: false,
  maxAttempts: null,
};

const OPEN: CompetitionLockFacts = {
  format: "placement",
  hasResult: false,
  hasPlay: false,
  hasLogged: false,
  hasMatchResult: false,
  closed: false,
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

  it("locks the Format and scoring once a result exists, and the Score direction once play has started, with the reason as visible text, but never the name or the unit", () => {
    const html = render(
      {},
      { facts: { ...OPEN, hasResult: true, hasPlay: true } },
    );
    expect(control(html, "competition-format")).toMatch(DISABLED);
    expect(control(html, "competition-scoring")).toMatch(DISABLED);
    expect(control(html, "competition-scoreDirection")).toMatch(DISABLED);
    expect(control(html, "competition-scoreUnit")).not.toMatch(DISABLED);
    expect(html).toContain('data-slot="lock-reason"');
    expect(html).toContain(LOCKED_BY_RESULT);
    expect(control(html, "competition-name")).not.toMatch(DISABLED);
  });

  it("says a Placement Points change while Closed applies at the next Close, and locks the rest", () => {
    const html = render(
      {},
      { facts: { ...OPEN, hasResult: true, closed: true } },
    );
    expect(html).toContain(APPLIES_AT_NEXT_CLOSE);
    expect(html).toContain(LOCKED_BY_RESULT);
  });

  it("locks an enrollment setting only while Closed, with the Reopen reason", () => {
    const bracket = { format: "bracket" as const, selfEnroll: true };
    const open = render(bracket, { facts: { ...OPEN, hasResult: true } });
    expect(control(open, "competition-selfEnroll")).not.toMatch(DISABLED);
    const closed = render(bracket, {
      facts: { ...OPEN, hasResult: true, hasMatchResult: true, closed: true },
    });
    expect(control(closed, "competition-selfEnroll")).toMatch(DISABLED);
    expect(closed).toContain(LOCKED_WHILE_CLOSED);
  });

  it("leaves a Head-to-head's Best of open with Entrants, and locks it with the Match reason once it has a Match", () => {
    const headToHead = {
      format: "head-to-head" as const,
      seriesConfig: { drawsAllowed: false, bestOf: 3 },
    };
    const facts = { ...OPEN, format: "head-to-head" as const, hasResult: true };
    const withEntrants = render(headToHead, { facts });
    expect(control(withEntrants, "competition-best-of")).not.toMatch(DISABLED);
    expect(control(withEntrants, "competition-format")).toMatch(DISABLED);
    expect(withEntrants).not.toContain(LOCKED_BY_MATCH);

    const played = render(headToHead, { facts: { ...facts, hasLogged: true } });
    expect(control(played, "competition-best-of")).toMatch(DISABLED);
    expect(control(played, "competition-draws-allowed")).toMatch(DISABLED);
    expect(played).toContain(
      "Locked once the Competition has a Match or Attempt.",
    );
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

  describe("a Bracket's match settings", () => {
    const bracket = { format: "bracket" as const };

    it("toggles Head-to-head / Group: Head-to-head shows the 3rd place Match and no sizes", () => {
      const html = render(bracket);
      const kind =
        html.match(
          /<div[^>]*aria-label="Bracket kind"[^>]*>[\s\S]*?<\/div>/,
        )?.[0] ?? "";
      expect(kind).toMatch(/aria-pressed="true"[^>]*>Head-to-head</);
      expect(kind).toMatch(/aria-pressed="false"[^>]*>Group</);
      expect(html).not.toContain("Entrants per Match");
      expect(html).not.toContain("How many advance");
      expect(html).toContain("3rd place Match");
      expect(html).toContain("Participants can log their own results");
      expect(html).toContain("Score direction");
    });

    it("shows a Group's entrants per Match (3 to 8) and how many advance", () => {
      const html = render({
        ...bracket,
        bracketConfig: {
          kind: "group" as const,
          entrantsPerMatch: 4,
          advancePerMatch: 2,
          thirdPlaceMatch: false,
          rounds: {},
        },
      });
      expect(html).toMatch(/aria-pressed="true"[^>]*>Group</);
      expect(html).toContain("Entrants per Match");
      expect(html).toContain("How many advance");
    });

    it("shows the 3rd place Match off and disabled with its reason under 4 Entrants", () => {
      const html = render(bracket);
      expect(html).toContain("A 3rd place Match needs at least 4 Entrants.");
      const third = control(html, "bracket-third-place");
      expect(third).toMatch(DISABLED);
      expect(third).not.toMatch(CHECKED);
    });

    it("shows a saved 3rd place Match as on under 4 Entrants, and lets it be turned off", () => {
      const html = render(
        {
          ...bracket,
          bracketConfig: {
            kind: "head-to-head" as const,
            entrantsPerMatch: 2,
            advancePerMatch: 1,
            thirdPlaceMatch: true,
            rounds: {},
          },
        },
        { entrantCount: 3 },
      );
      const third = control(html, "bracket-third-place");
      expect(third).toMatch(CHECKED);
      expect(third).not.toMatch(DISABLED);
      expect(html).toContain(
        "A 3rd place Match needs at least 4 Entrants. Turn it off, or enter 4, to generate.",
      );
    });

    it("locks the match settings once a Match has a result", () => {
      const html = render(
        {
          ...bracket,
          bracketConfig: {
            kind: "head-to-head" as const,
            entrantsPerMatch: 2,
            advancePerMatch: 1,
            thirdPlaceMatch: true,
            rounds: {},
          },
        },
        {
          entrantCount: 4,
          facts: {
            ...OPEN,
            format: "bracket",
            hasResult: true,
            hasMatchResult: true,
          },
        },
      );
      expect(control(html, "bracket-third-place")).toMatch(DISABLED);
      expect(html).toContain(LOCKED_BY_MATCH_RESULT);
    });

    it("offers no 3rd place Match at another Match size", () => {
      const html = render({
        ...bracket,
        bracketConfig: {
          kind: "group" as const,
          entrantsPerMatch: 4,
          advancePerMatch: 2,
          thirdPlaceMatch: false,
          rounds: {},
        },
      });
      expect(html).not.toContain("3rd place Match");
    });
  });

  describe("a Head-to-head or Best score Competition's settings", () => {
    it("shows Draws allowed and a required Best of for Head-to-head, not Best score's", () => {
      const html = render({ format: "head-to-head" });
      expect(html).toContain("Draws allowed");
      expect(html).toContain("Best of");
      expect(html).not.toContain("Team score");
      expect(html).not.toContain(">Off<");
      expect(html).not.toContain("Participants can enroll");
    });

    it("shows direction and unit for Best score, Team score only in team scoring, and no Best / Total", () => {
      const html = render({ format: "best-score", scoreDirection: "higher" });
      expect(html).toContain("Score direction");
      expect(html).toContain("Unit");
      expect(html).not.toContain("Best of");
      expect(html).not.toContain("Team score");
      expect(html).not.toContain(">Count<");
      expect(html).not.toContain("Participants can enroll");
      expect(
        render({
          format: "best-score",
          scoring: "team",
          scoreDirection: "higher",
        }),
      ).toContain("Team score");
    });

    it("has no close time on any Format", () => {
      for (const format of [
        "placement",
        "bracket",
        "head-to-head",
        "best-score",
        "participation",
      ] as const) {
        const html = render({
          format,
          selfEnroll: true,
          selfCheckIn: true,
          scoreDirection: format === "best-score" ? "higher" : "none",
        });
        expect(html, format).not.toMatch(/closes/i);
        expect(html, format).not.toContain("Time (ET)");
      }
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

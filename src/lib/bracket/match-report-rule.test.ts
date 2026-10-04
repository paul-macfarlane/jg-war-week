import { describe, expect, it } from "vitest";

import {
  type MatchReportFacet,
  matchReportError,
} from "@/lib/bracket/match-report-rule";

const RED = "team-red";
const BLUE = "team-blue";
const ASHLEY = "participant-ashley";
const RED_ALPHA = "squad-red-alpha";
const RED_BRAVO = "squad-red-bravo";

/** An open Match, Red vs Blue, self-report on, Ashley (Red) signed in. */
const facet = (over: Partial<MatchReportFacet> = {}): MatchReportFacet => ({
  selfReport: true,
  match: "open",
  linked: { participantId: ASHLEY, teamId: RED, squadId: null },
  entrants: [
    { teamId: RED, participantId: null, squadId: null },
    { teamId: BLUE, participantId: null, squadId: null },
  ],
  ...over,
});

describe("matchReportError", () => {
  it("allows a linked Participant whose Team is in an open Match", () => {
    expect(matchReportError(facet())).toBeNull();
  });

  it("allows a linked Participant who is the Entrant", () => {
    expect(
      matchReportError(
        facet({
          linked: { participantId: ASHLEY, teamId: null, squadId: null },
          entrants: [
            { teamId: null, participantId: ASHLEY, squadId: null },
            { teamId: null, participantId: "someone-else", squadId: null },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("allows a linked Participant through their Squad", () => {
    expect(
      matchReportError(
        facet({
          linked: { participantId: ASHLEY, teamId: RED, squadId: RED_ALPHA },
          entrants: [
            { teamId: null, participantId: null, squadId: RED_ALPHA },
            { teamId: null, participantId: null, squadId: "squad-blue" },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("refuses when self-report is off", () => {
    expect(matchReportError(facet({ selfReport: false }))).toBe(
      "Self-report is off for this Competition.",
    );
  });

  it("refuses a sign-in that links to no Participant", () => {
    expect(matchReportError(facet({ linked: null }))).toBe(
      "Your sign-in doesn't match a Participant of this War Week.",
    );
  });

  it("refuses a Match that no longer exists", () => {
    expect(matchReportError(facet({ match: "missing", entrants: [] }))).toBe(
      "That Match no longer exists.",
    );
  });

  it("refuses a Participant on none of the Match's Entrants", () => {
    expect(
      matchReportError(
        facet({
          linked: { participantId: ASHLEY, teamId: "team-gold", squadId: null },
        }),
      ),
    ).toBe("You're not in this Match.");
  });

  it("refuses a Participant without a Team when neither Entrant has one", () => {
    expect(
      matchReportError(
        facet({
          linked: { participantId: ASHLEY, teamId: null, squadId: null },
          entrants: [
            { teamId: null, participantId: "p1", squadId: null },
            { teamId: null, participantId: "p2", squadId: null },
          ],
        }),
      ),
    ).toBe("You're not in this Match.");
  });

  it("refuses a Red Participant in neither Squad of a Red Alpha vs Red Bravo Match", () => {
    expect(
      matchReportError(
        facet({
          linked: { participantId: ASHLEY, teamId: RED, squadId: null },
          entrants: [
            { teamId: null, participantId: null, squadId: RED_ALPHA },
            { teamId: null, participantId: null, squadId: RED_BRAVO },
          ],
        }),
      ),
    ).toBe("You're not in this Match.");
  });

  it("refuses a bye", () => {
    expect(matchReportError(facet({ match: "bye" }))).toBe(
      "A bye isn't played.",
    );
  });

  it("refuses a Match still waiting for its Entrants", () => {
    expect(matchReportError(facet({ match: "unfilled" }))).toBe(
      "This Match is still waiting for its Entrants.",
    );
  });

  it("refuses a Match that already has a result", () => {
    expect(matchReportError(facet({ match: "decided" }))).toBe(
      "This Match already has a result.",
    );
  });

  it("checks self-report before the sign-in link, and the link before the Match", () => {
    expect(
      matchReportError(
        facet({ selfReport: false, linked: null, match: "missing" }),
      ),
    ).toBe("Self-report is off for this Competition.");
    expect(matchReportError(facet({ linked: null, match: "decided" }))).toBe(
      "Your sign-in doesn't match a Participant of this War Week.",
    );
  });
});

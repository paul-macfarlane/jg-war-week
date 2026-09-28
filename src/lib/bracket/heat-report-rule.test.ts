import { describe, expect, it } from "vitest";

import {
  type HeatReportFacet,
  heatReportError,
} from "@/lib/bracket/heat-report-rule";

const RED = "team-red";
const BLUE = "team-blue";
const ASHLEY = "participant-ashley";
const RED_ALPHA = "squad-red-alpha";
const RED_BRAVO = "squad-red-bravo";

/** An open Heat, Red vs Blue, self-report on, Ashley (Red) signed in. */
const facet = (over: Partial<HeatReportFacet> = {}): HeatReportFacet => ({
  selfReport: true,
  heat: "open",
  linked: { participantId: ASHLEY, teamId: RED, squadId: null },
  entrants: [
    { teamId: RED, participantId: null, squadId: null },
    { teamId: BLUE, participantId: null, squadId: null },
  ],
  ...over,
});

describe("heatReportError", () => {
  it("allows a linked Participant whose Team is in an open Heat", () => {
    expect(heatReportError(facet())).toBeNull();
  });

  it("allows a linked Participant who is the Entrant", () => {
    expect(
      heatReportError(
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
      heatReportError(
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
    expect(heatReportError(facet({ selfReport: false }))).toBe(
      "Self-report is off for this Competition.",
    );
  });

  it("refuses a sign-in that links to no Participant", () => {
    expect(heatReportError(facet({ linked: null }))).toBe(
      "Your sign-in doesn't match a Participant of this War Week.",
    );
  });

  it("refuses a Heat that no longer exists", () => {
    expect(heatReportError(facet({ heat: "missing", entrants: [] }))).toBe(
      "That Heat no longer exists.",
    );
  });

  it("refuses a Participant on none of the Heat's Entrants", () => {
    expect(
      heatReportError(
        facet({
          linked: { participantId: ASHLEY, teamId: "team-gold", squadId: null },
        }),
      ),
    ).toBe("You're not in this Heat.");
  });

  it("refuses a Participant without a Team when neither Entrant has one", () => {
    expect(
      heatReportError(
        facet({
          linked: { participantId: ASHLEY, teamId: null, squadId: null },
          entrants: [
            { teamId: null, participantId: "p1", squadId: null },
            { teamId: null, participantId: "p2", squadId: null },
          ],
        }),
      ),
    ).toBe("You're not in this Heat.");
  });

  it("refuses a Red Participant in neither Squad of a Red Alpha vs Red Bravo Heat", () => {
    expect(
      heatReportError(
        facet({
          linked: { participantId: ASHLEY, teamId: RED, squadId: null },
          entrants: [
            { teamId: null, participantId: null, squadId: RED_ALPHA },
            { teamId: null, participantId: null, squadId: RED_BRAVO },
          ],
        }),
      ),
    ).toBe("You're not in this Heat.");
  });

  it("refuses a bye", () => {
    expect(heatReportError(facet({ heat: "bye" }))).toBe("A bye isn't played.");
  });

  it("refuses a Heat still waiting for its Entrants", () => {
    expect(heatReportError(facet({ heat: "unfilled" }))).toBe(
      "This Heat is still waiting for its Entrants.",
    );
  });

  it("refuses a Heat that already has a result", () => {
    expect(heatReportError(facet({ heat: "decided" }))).toBe(
      "This Heat already has a result.",
    );
  });

  it("checks self-report before the sign-in link, and the link before the Heat", () => {
    expect(
      heatReportError(
        facet({ selfReport: false, linked: null, heat: "missing" }),
      ),
    ).toBe("Self-report is off for this Competition.");
    expect(heatReportError(facet({ linked: null, heat: "decided" }))).toBe(
      "Your sign-in doesn't match a Participant of this War Week.",
    );
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EnrollButton, type EnrollOffer } from "./enroll-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/actions/enrollment", () => ({
  enroll: vi.fn(),
  withdraw: vi.fn(),
  joinSquad: vi.fn(),
  leaveSquad: vi.fn(),
}));

const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'");

function render(offer: Partial<EnrollOffer>) {
  return renderToStaticMarkup(
    <EnrollButton
      offer={{
        competitionId: "c1",
        competitionName: "Ping Pong",
        scoring: "individual",
        entrant: null,
        squads: null,
        ...offer,
      }}
    />,
  );
}

describe("EnrollButton", () => {
  it("offers Enroll to a Participant who isn't entered", () => {
    const html = render({ entrant: { entered: false, reason: null } });
    expect(html).toMatch(/<button[^>]*>Enroll<\/button>/);
    expect(html).not.toContain("Withdraw");
  });

  it("offers Withdraw once entered", () => {
    const html = render({ entrant: { entered: true, reason: null } });
    expect(text(html)).toContain("You're entered.");
    expect(html).toMatch(/<button[^>]*>Withdraw<\/button>/);
  });

  it("says Your Team is entered in a team Competition", () => {
    const html = render({
      scoring: "team",
      entrant: { entered: true, reason: null },
    });
    expect(text(html)).toContain("Your Team is entered.");
  });

  it("shows why enrollment is unavailable, with the button disabled", () => {
    const html = render({
      entrant: {
        entered: false,
        reason: "Enrollment is closed: the Bracket is built.",
      },
    });
    expect(text(html)).toContain("Enrollment is closed: the Bracket is built.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Enroll<\/button>/);
  });

  it("offers Join and Leave per Squad of Your Team, with the Squad help line", () => {
    const html = render({
      scoring: "team",
      squads: [
        { id: "s1", name: "Red A", joined: false, reason: null },
        { id: "s2", name: "Red B", joined: false, reason: null },
      ],
    });
    expect(html).toMatch(/<button[^>]*>Join Red A<\/button>/);
    expect(html).toMatch(/<button[^>]*>Join Red B<\/button>/);
    expect(text(html)).toContain(
      "a pair or group from one Team, playing as one entrant",
    );
    expect(html).not.toMatch(/>Enroll</);
  });

  it("offers Leave for the Squad You're in and hides the other Joins", () => {
    const html = render({
      scoring: "team",
      squads: [
        { id: "s1", name: "Red A", joined: true, reason: null },
        {
          id: "s2",
          name: "Red B",
          joined: false,
          reason: "You're already in a Squad in this Competition.",
        },
      ],
    });
    expect(html).toMatch(/<button[^>]*>Leave Red A<\/button>/);
    expect(html).not.toContain("Join Red B");
  });

  it("says so when Your Team has no Squad", () => {
    expect(text(render({ scoring: "team", squads: [] }))).toContain(
      "Your Team has no Squad in this Competition yet.",
    );
  });
});

import { describe, expect, it } from "vitest";

import { moreLinks } from "@/lib/more-links";

const base = {
  surface: "phone" as const,
  edition: "xi",
  mode: "teams" as const,
  teamLabel: "House",
};

describe("moreLinks", () => {
  it("has no Admin link: Admin is in the account menu", () => {
    const links = moreLinks(base);
    expect(links.some((link) => link.href === "/admin")).toBe(false);
  });

  it("labels the roster link with rosterHeading's plural Team Label", () => {
    const links = moreLinks({ ...base, teamLabel: "Tribe" });
    const roster = links.find((link) => link.href === "/xi/teams");
    expect(roster?.label).toBe("Tribes");
  });

  it("labels the roster link Participants in a free-for-all", () => {
    const links = moreLinks({ ...base, mode: "free-for-all" });
    const roster = links.find((link) => link.href === "/xi/teams");
    expect(roster?.label).toBe("Participants");
  });

  it("leads a phone's More with Announcements and omits Competitions", () => {
    const links = moreLinks(base);
    expect(links[0]).toMatchObject({
      label: "Announcements",
      href: "/xi/announcements",
    });
    expect(links.some((link) => link.href === "/xi/competitions")).toBe(false);
  });

  it("keeps Announcements out of the desktop list (it is in the top nav)", () => {
    const links = moreLinks({ ...base, surface: "desktop" });
    expect(links.map((link) => link.href)).toEqual([
      "/xi/teams",
      "/xi/awards",
      "/xi/faq",
      "/history",
      "/install",
      "/about",
    ]);
  });
});

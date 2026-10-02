import { describe, expect, it } from "vitest";

import { type NavSurface, destinationsFor, isActive } from "@/lib/primary-nav";

function current(pathname: string, surface: NavSurface) {
  return destinationsFor("xii", surface)
    .filter((d) => isActive(pathname, d, "xii"))
    .map((d) => d.label);
}

describe("destinationsFor", () => {
  it("orders the phone tab bar with Competitions third and no Announcements", () => {
    expect(destinationsFor("xii", "phone").map((d) => d.label)).toEqual([
      "Home",
      "Schedule",
      "Competitions",
      "Leaderboard",
      "More",
    ]);
  });

  it("orders the desktop top nav with Announcements before More", () => {
    expect(destinationsFor("xii", "desktop").map((d) => d.label)).toEqual([
      "Home",
      "Schedule",
      "Competitions",
      "Leaderboard",
      "Announcements",
      "More",
    ]);
  });
});

describe("isActive", () => {
  it("highlights Competitions on the list and on a Competition page", () => {
    expect(current("/xii/competitions", "phone")).toEqual(["Competitions"]);
    expect(current("/xii/competitions/abc", "phone")).toEqual(["Competitions"]);
    expect(current("/xii/competitions/abc", "desktop")).toEqual([
      "Competitions",
    ]);
  });

  it("highlights More on a phone's Announcements page", () => {
    expect(current("/xii/announcements", "phone")).toEqual(["More"]);
  });

  it("highlights Announcements on desktop's Announcements page", () => {
    expect(current("/xii/announcements", "desktop")).toEqual(["Announcements"]);
  });

  it("highlights More on in-More pages and Home only on Home", () => {
    expect(current("/xii/teams", "phone")).toEqual(["More"]);
    expect(current("/xii", "phone")).toEqual(["Home"]);
  });
});

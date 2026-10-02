import { describe, expect, it } from "vitest";

import { adminNavFor, adminSectionsFor } from "@/lib/admin-sections";

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe("adminSectionsFor", () => {
  it("gives an Organizer the flat nav, in order", () => {
    expect(labels(adminSectionsFor(true))).toEqual([
      "Points",
      "Competitions",
      "Schedule",
      "Roster",
      "Announcements",
      "Awards",
      "FAQ",
      "Finale",
      "Settings",
      "Organizers",
      "Guide",
    ]);
    expect(adminSectionsFor(true).map((s) => s.href)).toEqual([
      "/admin/points",
      "/admin/competitions",
      "/admin/schedule",
      "/admin/roster",
      "/admin/announcements",
      "/admin/awards",
      "/admin/faq",
      "/admin/finale",
      "/admin/settings",
      "/admin/organizers",
      "/admin/guide",
    ]);
  });

  it("trims a Host's nav to Points, Competitions, Schedule, Announcements, Finale and Guide", () => {
    expect(labels(adminSectionsFor(false))).toEqual([
      "Points",
      "Competitions",
      "Schedule",
      "Announcements",
      "Finale",
      "Guide",
    ]);
  });
});

describe("adminNavFor", () => {
  it("gives an Organizer the four tabs Points, Competitions, Schedule and Announcements", () => {
    const { tabs } = adminNavFor(true, "Points");
    expect(labels(tabs)).toEqual([
      "Points",
      "Competitions",
      "Schedule",
      "Announcements",
    ]);
    expect(tabs.map((t) => t.href)).toEqual([
      "/admin/points",
      "/admin/competitions",
      "/admin/schedule",
      "/admin/announcements",
    ]);
  });

  it("puts the rest of an Organizer's sections in More, in nav order", () => {
    const { more } = adminNavFor(true, "Points");
    expect(labels(more)).toEqual([
      "Roster",
      "Awards",
      "FAQ",
      "Finale",
      "Settings",
      "Organizers",
      "Guide",
    ]);
  });

  it("gives a Host the same tabs and only Finale and Guide in More", () => {
    const { tabs, more } = adminNavFor(false, "Points");
    expect(labels(tabs)).toEqual([
      "Points",
      "Competitions",
      "Schedule",
      "Announcements",
    ]);
    expect(labels(more)).toEqual(["Finale", "Guide"]);
  });

  it("marks the current tab, and More not current, for a tab section", () => {
    const { tabs, more, moreCurrent } = adminNavFor(true, "Schedule");
    expect(tabs.filter((t) => t.current).map((t) => t.label)).toEqual([
      "Schedule",
    ]);
    expect(more.some((m) => m.current)).toBe(false);
    expect(moreCurrent).toBe(false);
  });

  it("marks More current, and the section in it, for a section inside More", () => {
    const { tabs, more, moreCurrent } = adminNavFor(true, "Settings");
    expect(moreCurrent).toBe(true);
    expect(tabs.some((t) => t.current)).toBe(false);
    expect(more.filter((m) => m.current).map((m) => m.label)).toEqual([
      "Settings",
    ]);
  });

  it("marks More current for a Host on Guide", () => {
    expect(adminNavFor(false, "Guide").moreCurrent).toBe(true);
  });
});

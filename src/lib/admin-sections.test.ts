import { describe, expect, it } from "vitest";

import { adminNavFor } from "@/lib/admin-sections";

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe("adminNavFor", () => {
  it("gives an Organizer the four tabs, with Points Entries labelled Points", () => {
    const { tabs } = adminNavFor(true, "Overview");
    expect(labels(tabs)).toEqual([
      "Overview",
      "Points",
      "Announcements",
      "Setup",
    ]);
    expect(tabs.map((t) => t.href)).toEqual([
      "/admin",
      "/admin/points",
      "/admin/announcements",
      "/admin/setup",
    ]);
  });

  it("puts Guide, Finale, Awards and Organizers in an Organizer's More", () => {
    const { more } = adminNavFor(true, "Overview");
    expect(labels(more)).toEqual(["Guide", "Finale", "Awards", "Organizers"]);
  });

  it("gives a Host the same tabs but no Awards or Organizers in More", () => {
    const { tabs, more } = adminNavFor(false, "Overview");
    expect(labels(tabs)).toEqual([
      "Overview",
      "Points",
      "Announcements",
      "Setup",
    ]);
    expect(labels(more)).toEqual(["Guide", "Finale"]);
  });

  it("marks the current tab, and More not current, for a tab section", () => {
    const { tabs, more, moreCurrent } = adminNavFor(true, "Setup");
    expect(tabs.filter((t) => t.current).map((t) => t.label)).toEqual([
      "Setup",
    ]);
    expect(more.some((m) => m.current)).toBe(false);
    expect(moreCurrent).toBe(false);
  });

  it("marks More current, and the section in it, for a section inside More", () => {
    const { tabs, more, moreCurrent } = adminNavFor(true, "Awards");
    expect(moreCurrent).toBe(true);
    expect(tabs.some((t) => t.current)).toBe(false);
    expect(more.filter((m) => m.current).map((m) => m.label)).toEqual([
      "Awards",
    ]);
  });

  it("marks More current for a Host on Guide", () => {
    expect(adminNavFor(false, "Guide").moreCurrent).toBe(true);
  });
});

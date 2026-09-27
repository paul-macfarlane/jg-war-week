import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WarWeek } from "@/db/schema";

import { AdminShell, editingBanner } from "./admin-shell";

vi.mock("@/components/auth-buttons", () => ({
  SignOutButton: () => null,
}));
vi.mock("@/components/admin-edition-switcher", () => ({
  AdminEditionSwitcher: () => null,
}));

const fakeWarWeek = {
  edition: "xi",
  storyTheme: "Test theme",
  primaryColor: "#000",
  primaryForegroundColor: "#fff",
  accentColor: "#000",
  backgroundColor: "#fff",
  foregroundColor: "#000",
  fontPreset: "sans",
} as unknown as WarWeek;

describe("AdminShell", () => {
  it("links back to the War Week, not a public site", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        warWeek={fakeWarWeek}
        email="o@jahnelgroup.com"
        isOrganizer
        current="Overview"
      >
        x
      </AdminShell>,
    );

    expect(html).toContain("Back to War Week XI");
    expect(html).not.toContain("public site");
  });

  it("links an Organizer to Awards and the Organizer list", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        warWeek={fakeWarWeek}
        email="o@jahnelgroup.com"
        isOrganizer
        current="Overview"
      >
        x
      </AdminShell>,
    );
    expect(html).toContain('href="/admin/awards"');
    expect(html).toContain('href="/admin/organizers"');
  });

  it("hides Awards and the Organizer list from a Host", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        warWeek={fakeWarWeek}
        email="host@jahnelgroup.com"
        isOrganizer={false}
        current="Overview"
      >
        x
      </AdminShell>,
    );
    expect(html).not.toContain('href="/admin/awards"');
    expect(html).not.toContain('href="/admin/organizers"');
    expect(html).toContain('href="/admin/points"');
    expect(html).toContain('href="/admin/setup"');
  });
});

describe("editingBanner", () => {
  const editions = [
    { edition: "xii", status: "upcoming" as const, current: false },
    { edition: "xi", status: "live" as const, current: true },
    { edition: "x", status: "complete" as const, current: false },
  ];

  it("is empty on the current War Week", () => {
    expect(editingBanner({ edition: "xi", status: "live" }, editions)).toBe(
      null,
    );
  });

  it("names the Archive for a complete edition", () => {
    expect(editingBanner({ edition: "x", status: "complete" }, editions)).toBe(
      "Editing the Archive: War Week X",
    );
  });

  it("names an upcoming edition", () => {
    expect(
      editingBanner({ edition: "xii", status: "upcoming" }, editions),
    ).toBe("Editing upcoming War Week XII");
  });

  it("shows the banner in the shell", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        warWeek={{ ...fakeWarWeek, edition: "x", status: "complete" }}
        email="o@jahnelgroup.com"
        isOrganizer
        editions={editions}
        current="Overview"
      >
        x
      </AdminShell>,
    );
    expect(html).toContain("Editing the Archive: War Week X");
  });
});

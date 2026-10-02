import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WarWeek } from "@/db/schema";
import type { AdminEdition } from "@/lib/access";
import type { AdminSection } from "@/lib/admin-sections";

import { AdminRefused, AdminShell, editingBanner } from "./admin-shell";

vi.mock("@/components/auth-buttons", () => ({
  SignOutButton: () => null,
}));
vi.mock("@/components/admin-account-menu", () => ({
  AdminAccountMenu: ({
    email,
    profileEdition,
  }: {
    email: string;
    profileEdition: string;
  }) => (
    <button
      aria-label="Account menu"
      data-email={email}
      data-profile-edition={profileEdition}
    />
  ),
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
        current="Points"
      >
        x
      </AdminShell>,
    );

    expect(html).toContain("Back to War Week XI");
    expect(html).not.toContain("public site");
  });

  it("puts the account menu, not the email or Sign out, in the header", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        warWeek={fakeWarWeek}
        email="o@jahnelgroup.com"
        isOrganizer
        current="Points"
      >
        x
      </AdminShell>,
    );

    expect(html).toContain('aria-label="Account menu"');
    expect(html).toContain('data-email="o@jahnelgroup.com"');
    expect(html).not.toContain("Signed in as");
  });

  it("opens the current War Week's Profile page from the account menu", () => {
    const shell = (editions: AdminEdition[]) =>
      renderToStaticMarkup(
        <AdminShell
          warWeek={fakeWarWeek}
          email="o@jahnelgroup.com"
          isOrganizer
          editions={editions}
          current="Points"
        >
          x
        </AdminShell>,
      );
    // Administering XI while XII is current.
    expect(
      shell([
        { edition: "xii", status: "live", current: true },
        { edition: "xi", status: "complete", current: false },
      ]),
    ).toContain('data-profile-edition="xii"');
    // A Host who can't open the current War Week: the one shown.
    expect(shell([])).toContain('data-profile-edition="xi"');
  });

  it("links an Organizer to Awards and the Organizer list", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        warWeek={fakeWarWeek}
        email="o@jahnelgroup.com"
        isOrganizer
        current="Points"
      >
        x
      </AdminShell>,
    );
    expect(html).toContain('href="/admin/awards"');
    expect(html).toContain('href="/admin/organizers"');
  });

  it("hides the Organizer-only sections from a Host", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        warWeek={fakeWarWeek}
        email="host@jahnelgroup.com"
        isOrganizer={false}
        current="Points"
      >
        x
      </AdminShell>,
    );
    expect(html).not.toContain('href="/admin/awards"');
    expect(html).not.toContain('href="/admin/organizers"');
    expect(html).not.toContain('href="/admin/roster"');
    expect(html).not.toContain('href="/admin/faq"');
    expect(html).not.toContain('href="/admin/settings"');
    expect(html).toContain('href="/admin/points"');
    expect(html).toContain('href="/admin/competitions"');
    expect(html).toContain('href="/admin/schedule"');
    expect(html).toContain('href="/admin/finale"');
  });
});

describe("AdminShell bottom bar (phone)", () => {
  function shell(current: AdminSection, isOrganizer = true) {
    return renderToStaticMarkup(
      <AdminShell
        warWeek={fakeWarWeek}
        email="o@jahnelgroup.com"
        isOrganizer={isOrganizer}
        current={current}
      >
        x
      </AdminShell>,
    );
  }
  /** The More tab: the bar's Sheet trigger button. */
  const moreTab = (html: string) =>
    html.match(/<button[^>]*>(?:(?!<\/button>).)*More<\/button>/)?.[0];

  it("links the header's title to Points, the first section", () => {
    expect(shell("Points")).toMatch(
      /<a[^>]*href="\/admin\/points"[^>]*>War Week (?:<!-- -->)?XI(?:<!-- -->)? admin<\/a>/,
    );
  });

  it("labels both the side column and the bar Admin sections", () => {
    const html = shell("Points");
    expect(html.match(/aria-label="Admin sections"/g)).toHaveLength(2);
  });

  it("gives the bar a Points tab and a More tab", () => {
    const html = shell("Points");
    expect(html).toMatch(
      /href="\/admin\/points"[^>]*>(?:(?!<\/a>).)*Points<\/a>/,
    );
    expect(moreTab(html)).toBeDefined();
  });

  it("marks the More tab current for a section inside More", () => {
    expect(moreTab(shell("Guide"))).toContain('aria-current="page"');
    expect(moreTab(shell("Awards"))).toContain('aria-current="page"');
  });

  it("doesn't mark the More tab current for a tab section", () => {
    const html = shell("Schedule");
    expect(moreTab(html)).not.toContain('aria-current="page"');
    expect(html).toMatch(
      /<a[^>]*href="\/admin\/schedule"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/admin\/schedule"/,
    );
  });

  it("shows a Host no Awards or Organizers in the side column or the bar", () => {
    const html = shell("Guide", false);
    expect(html).not.toContain("Awards");
    expect(html).not.toContain("Organizers");
    expect(moreTab(html)).toContain('aria-current="page"');
  });
});

describe("AdminShell footer", () => {
  it("stacks the themed root as a flex column so the footer sits at the bottom on short pages", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        warWeek={fakeWarWeek}
        email="o@jahnelgroup.com"
        isOrganizer
        current="Points"
      >
        x
      </AdminShell>,
    );

    expect(html).toMatch(/class="[^"]*\bflex\b[^"]*\bflex-col\b[^"]*"/);
  });
});

describe("AdminRefused", () => {
  it("pins the footer to the bottom of the viewport on a short page", () => {
    const html = renderToStaticMarkup(
      <AdminRefused warWeek={fakeWarWeek} email="host@jahnelgroup.com" />,
    );

    expect(html).toMatch(/<footer class="[^"]*\bmt-auto\b[^"]*"/);
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
        current="Points"
      >
        x
      </AdminShell>,
    );
    expect(html).toContain("Editing the Archive: War Week X");
  });
});

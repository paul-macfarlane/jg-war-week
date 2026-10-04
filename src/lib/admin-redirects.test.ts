import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

/** Where `pathname` goes under next.config's redirects, or null. */
async function redirectFor(pathname: string) {
  const redirects = (await nextConfig.redirects?.()) ?? [];
  for (const { source, destination, permanent } of redirects) {
    // Next's path patterns: `:name` is one segment, `:name*` zero or more.
    const names: string[] = [];
    const pattern = source.replace(
      /\/:(\w+)(\*)?/g,
      (_match, name: string, star?: string) => {
        names.push(name);
        return star ? "(?:/(.*))?" : "/([^/]+)";
      },
    );
    const match = new RegExp(`^${pattern}$`).exec(pathname);
    if (!match) continue;
    const to = names.reduce(
      (path, name, index) =>
        path.replace(
          new RegExp(`/:${name}\\*?`),
          match[index + 1] ? `/${match[index + 1]}` : "",
        ),
      destination,
    );
    return { to, permanent };
  }
  return null;
}

describe("the admin redirects (next.config)", () => {
  it.each([
    ["/admin", "/admin/competitions"],
    // Points became Discretionary points (part 91); old links still work.
    ["/admin/points", "/admin/discretionary-points"],
    ["/admin/points/abc-123", "/admin/discretionary-points"],
    ["/admin/setup", "/admin/settings"],
    ["/admin/setup/war-week", "/admin/settings"],
    ["/admin/setup/next", "/admin/settings"],
    ["/admin/setup/days", "/admin/schedule"],
    ["/admin/setup/schedule", "/admin/schedule"],
    ["/admin/setup/schedule/new", "/admin/schedule"],
    ["/admin/setup/schedule/abc-123", "/admin/schedule"],
    ["/admin/setup/teams", "/admin/roster"],
    ["/admin/setup/competitions", "/admin/competitions"],
    ["/admin/setup/competitions/abc-123", "/admin/competitions/abc-123"],
    [
      "/admin/setup/competitions/abc-123/bracket",
      "/admin/competitions/abc-123",
    ],
    ["/admin/setup/competitions/abc-123/games", "/admin/competitions/abc-123"],
    ["/admin/setup/faq", "/admin/faq"],
    ["/admin/setup/faq/new", "/admin/faq"],
    ["/admin/setup/faq/abc-123", "/admin/faq"],
    ["/admin/standings", "/admin/finale"],
    // Schedule Items, FAQ Items and Awards add and edit in a Sheet on their
    // list (ticket 58).
    ["/admin/schedule/new", "/admin/schedule"],
    ["/admin/schedule/abc-123", "/admin/schedule"],
    ["/admin/faq/new", "/admin/faq"],
    ["/admin/faq/abc-123", "/admin/faq"],
    ["/admin/awards/new", "/admin/awards"],
    ["/admin/awards/abc-123", "/admin/awards"],
  ])("sends %s to %s permanently", async (from, to) => {
    expect(await redirectFor(from)).toEqual({ to, permanent: true });
  });

  it.each([
    "/admin/discretionary-points",
    "/admin/competitions",
    "/admin/schedule",
    "/admin/roster",
    "/admin/faq",
    "/admin/finale",
    "/admin/settings",
    "/admin/awards",
    // Announcements keep their full-page editor.
    "/admin/announcements/new",
    "/admin/announcements/abc-123",
  ])("leaves the new home %s alone", async (path) => {
    expect(await redirectFor(path)).toBeNull();
  });

  it("still sends /:edition/news to Announcements", async () => {
    expect(await redirectFor("/xi/news")).toEqual({
      to: "/xi/announcements",
      permanent: true,
    });
  });
});

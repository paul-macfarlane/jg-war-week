import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // Announcements used to live at /news; keep old links working.
        source: "/:edition/news",
        destination: "/:edition/announcements",
        permanent: true,
      },
      // The flat admin nav (ticket 57) replaced the Overview and the Setup
      // hub; keep old admin links and bookmarks working.
      ...(
        [
          ["/admin", "/admin/competitions"],
          // Points became Discretionary points (part 91): Competitions are
          // recorded on their own pages.
          ["/admin/points", "/admin/discretionary-points"],
          ["/admin/points/:id", "/admin/discretionary-points"],
          ["/admin/setup", "/admin/settings"],
          ["/admin/setup/war-week", "/admin/settings"],
          ["/admin/setup/next", "/admin/settings"],
          ["/admin/setup/days", "/admin/schedule"],
          ["/admin/setup/schedule/:path*", "/admin/schedule"],
          ["/admin/setup/teams", "/admin/roster"],
          // A Competition's Bracket and Games setup are its one page now
          // (ticket 101); straight there, not through the retired routes.
          ["/admin/setup/competitions/:id/:part", "/admin/competitions/:id"],
          ["/admin/setup/competitions/:path*", "/admin/competitions/:path*"],
          ["/admin/setup/faq/:path*", "/admin/faq"],
          ["/admin/standings", "/admin/finale"],
          // Schedule Items, FAQ Items and Awards add and edit in a Sheet on
          // their list (ticket 58); their /new and /[id] pages are gone.
          ["/admin/schedule/:id", "/admin/schedule"],
          ["/admin/faq/:id", "/admin/faq"],
          ["/admin/awards/:id", "/admin/awards"],
        ] as const
      ).map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),
    ];
  },
  async headers() {
    return [
      {
        // Browsers must always fetch the latest service worker.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;

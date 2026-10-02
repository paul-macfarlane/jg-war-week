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
          ["/admin", "/admin/points"],
          ["/admin/setup", "/admin/settings"],
          ["/admin/setup/war-week", "/admin/settings"],
          ["/admin/setup/next", "/admin/settings"],
          ["/admin/setup/days", "/admin/schedule"],
          ["/admin/setup/schedule/:path*", "/admin/schedule"],
          ["/admin/setup/teams", "/admin/roster"],
          ["/admin/setup/competitions/:path*", "/admin/competitions/:path*"],
          ["/admin/setup/faq/:path*", "/admin/faq"],
          ["/admin/standings", "/admin/finale"],
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

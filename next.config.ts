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

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnnouncementCard } from "./announcement-card";

describe("AnnouncementCard", () => {
  it("titles the body's video after the Announcement, so each card's is unique", () => {
    const html = renderToStaticMarkup(
      <AnnouncementCard
        announcement={{
          id: "00000000-0000-4000-8000-000000000001",
          title: "Kickoff recap",
          authorName: "Pat",
          pinned: false,
          publishedAt: new Date("2027-02-22T15:00:00Z"),
          body: {
            type: "doc",
            content: [
              { type: "video", attrs: { src: "https://youtu.be/abc123" } },
            ],
          },
        }}
      />,
    );

    expect(html).toContain('title="Video: Kickoff recap"');
  });
});

import { describe, expect, it } from "vitest";

import type { Content } from "@/lib/rich-text/content";
import { toAnnouncementsResult } from "@/mcp/announcements";

const welcomeBody: Content = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Let's go." }],
    },
  ],
};

describe("toAnnouncementsResult", () => {
  it("serializes title, resolved author name (never the email), published-at, plain-text body and video links", () => {
    // As `getAnnouncementsWithAuthors` returns them: the author's email too.
    const rows = [
      {
        title: "Welcome",
        pinned: true,
        authorName: "Olivia Organizer",
        authorEmail: "olivia@jahnelgroup.com",
        publishedAt: new Date("2026-02-23T18:00:00.000Z"),
        body: welcomeBody,
        videoUrls: ["https://www.youtube.com/watch?v=abc123"],
      },
      {
        title: "Reminder",
        pinned: false,
        authorName: "b",
        authorEmail: "b@jahnelgroup.com",
        publishedAt: new Date("2026-02-24T12:00:00.000Z"),
        body: { type: "doc", content: [] } satisfies Content,
        videoUrls: [],
      },
    ];

    expect(JSON.stringify(toAnnouncementsResult("xi", rows))).not.toContain(
      "@",
    );
    expect(toAnnouncementsResult("xi", rows)).toEqual({
      edition: "xi",
      announcements: [
        {
          title: "Welcome",
          pinned: true,
          author: "Olivia Organizer",
          publishedAt: "2026-02-23T18:00:00.000Z",
          body: "Let's go.",
          videoUrls: ["https://www.youtube.com/watch?v=abc123"],
        },
        {
          title: "Reminder",
          pinned: false,
          author: "b",
          publishedAt: "2026-02-24T12:00:00.000Z",
          body: null,
          videoUrls: [] as string[],
        },
      ],
    });
  });
});

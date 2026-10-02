import { describe, expect, it } from "vitest";

import type { ScheduleDay } from "@/lib/schedule";
import { toScheduleResult } from "@/mcp/schedule";

const days: ScheduleDay[] = [
  {
    id: "d1",
    date: "2026-02-23",
    dayTheme: "Competition Day",
    items: [
      {
        id: "i1",
        startTime: "18:00:00",
        endTime: "22:00:00",
        title: "Game Night",
        host: "Jesse",
        location: "JGHQ",
        virtualLink: "https://meet.example.com/t",
        description: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Major " },
                { type: "text", text: "team", marks: [{ type: "bold" }] },
                { type: "text", text: " points." },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Pool" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "image",
              attrs: { src: "https://x.test/a.png", alt: "", caption: "" },
            },
          ],
        },
        category: "competition",
        competition: { id: "c1", name: "Game Night Cup" },
      },
    ],
  },
  {
    id: "d2",
    date: "2026-02-24",
    dayTheme: "Red vs. Blue",
    items: [
      {
        id: "i2",
        startTime: "08:30:00",
        endTime: null,
        title: "Breakfast",
        host: null,
        location: null,
        virtualLink: null,
        description: null,
        category: "meal",
        competition: null,
      },
    ],
  },
];

describe("toScheduleResult", () => {
  it("returns the full schedule in ET when no date is given", () => {
    expect(toScheduleResult("xi", days)).toEqual({
      edition: "xi",
      timeZone: "America/New_York",
      date: null,
      days: [
        {
          date: "2026-02-23",
          dayTheme: "Competition Day",
          items: [
            {
              startTime: "18:00",
              endTime: "22:00",
              title: "Game Night",
              host: "Jesse",
              location: "JGHQ",
              virtualLink: "https://meet.example.com/t",
              category: "competition",
              competition: "Game Night Cup",
              description: "Major team points.\n- Pool",
            },
          ],
        },
        {
          date: "2026-02-24",
          dayTheme: "Red vs. Blue",
          items: [
            {
              startTime: "08:30",
              endTime: null,
              title: "Breakfast",
              host: null,
              location: null,
              virtualLink: null,
              category: "meal",
              competition: null,
              description: null,
            },
          ],
        },
      ],
    });
  });

  it("echoes the requested date", () => {
    expect(toScheduleResult("xi", days.slice(1), "2026-02-24").date).toBe(
      "2026-02-24",
    );
  });
});

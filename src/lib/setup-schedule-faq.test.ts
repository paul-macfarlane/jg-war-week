import { describe, expect, it } from "vitest";

import {
  type FaqItemInput,
  type ScheduleItemInput,
  faqItemGuardError,
  moveInOrder,
  parseFaqItemInput,
  parseScheduleItemInput,
  scheduleItemGuardError,
  scheduleItemInputFrom,
} from "@/lib/setup-schedule-faq";

const DAY = "3f0c1f0e-8a1b-4c43-9a4e-3c6a5b0e1d21";
const HOST = "5d8a2b64-0c1e-4f7a-9b3d-7e6f1a2c8d90";
const COMPETITION = "9b2d7c1e-5f3a-4b8e-8c6d-2a1e0f9b7c34";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const input: ScheduleItemInput = {
  dayId: DAY,
  startTime: "09:00",
  endTime: "10:30",
  title: "  Kickoff ",
  hostIds: [],
  location: "",
  virtualLink: "https://meet.google.com/abc-defg-hij",
  category: "competition",
  competitionId: COMPETITION,
  description: doc("Welcome"),
};

function parsedItem(overrides: Partial<ScheduleItemInput> = {}) {
  return parseScheduleItemInput({ ...input, ...overrides });
}

describe("parseScheduleItemInput", () => {
  it("trims text, blanks optional fields to null and sanitizes the description", () => {
    expect(parsedItem()).toEqual({
      ok: true,
      value: {
        dayId: DAY,
        startTime: "09:00",
        endTime: "10:30",
        title: "Kickoff",
        hostIds: [],
        location: null,
        virtualLink: "https://meet.google.com/abc-defg-hij",
        category: "competition",
        competitionId: COMPETITION,
        description: doc("Welcome"),
      },
    });
  });

  it("keeps a blank end time, Competition and description as null", () => {
    const result = parsedItem({
      endTime: "",
      competitionId: "",
      description: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(result.ok && result.value).toMatchObject({
      endTime: null,
      competitionId: null,
      description: null,
    });
  });

  it("refuses an end time before or equal to the start time", () => {
    const error = {
      ok: false,
      error: "End time must be after the start time.",
      fieldErrors: { endTime: "End time must be after the start time." },
    };
    expect(parsedItem({ endTime: "08:59" })).toEqual(error);
    expect(parsedItem({ endTime: "09:00" })).toEqual(error);
  });

  it("keeps a blank start time as null: an untimed item", () => {
    const result = parsedItem({ startTime: " ", endTime: "" });
    expect(result.ok && result.value).toMatchObject({
      startTime: null,
      endTime: null,
    });
  });

  it('refuses an end time without a start time: "Add a start time first."', () => {
    expect(parsedItem({ startTime: "", endTime: "10:00" })).toEqual({
      ok: false,
      error: "Add a start time first.",
      fieldErrors: { endTime: "Add a start time first." },
    });
  });

  it("refuses a Competition on any category but Competition", () => {
    for (const category of ["education", "social", "meal", "work", "other"]) {
      expect(parsedItem({ category })).toEqual({
        ok: false,
        error: "Only a Competition item can link a Competition.",
        fieldErrors: {
          competitionId: "Only a Competition item can link a Competition.",
        },
      });
    }
    // The Competition category may link none.
    expect(parsedItem({ competitionId: "" })).toMatchObject({ ok: true });
  });

  it("takes Host ids, each once", () => {
    const ANA = "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9";
    const result = parsedItem({
      category: "social",
      competitionId: "",
      hostIds: [ANA, ANA],
    });
    expect(result.ok && result.value.hostIds).toEqual([ANA]);
    expect(parsedItem({ hostIds: ["not-an-id"] })).toMatchObject({
      ok: false,
    });
  });

  it("words field errors with the field's label", () => {
    expect(parsedItem({ title: "  " })).toMatchObject({
      ok: false,
      error: "Title must not be empty.",
    });
    expect(parsedItem({ startTime: "9am" })).toMatchObject({
      ok: false,
      error: "Start time must be a 24-hour HH:MM time.",
    });
    expect(parsedItem({ virtualLink: "http://example.com" })).toMatchObject({
      ok: false,
      error: "Virtual link must be an https URL.",
    });
    expect(parsedItem({ category: "nap" })).toMatchObject({
      ok: false,
      error:
        "Category must be one of competition, education, social, meal, work, other.",
    });
    expect(parsedItem({ dayId: "" })).toMatchObject({
      ok: false,
      error: "Pick a Day.",
    });
    expect(parsedItem({ description: "<p>hi</p>" })).toMatchObject({
      ok: false,
      error: "Description must be valid rich text.",
    });
  });

  it("accepts an `other` category", () => {
    expect(parsedItem({ category: "other", competitionId: "" })).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });
});

describe("scheduleItemGuardError", () => {
  const values = {
    dayId: DAY,
    startTime: "09:00" as string | null,
    title: "Kickoff",
    category: "competition" as const,
    competitionId: COMPETITION,
  };
  const ctx = {
    dayIds: [DAY],
    competitionIds: [COMPETITION],
    otherItems: [{ dayId: DAY, startTime: "13:00:00", title: "Kickoff" }],
  };

  it("allows an item on a Day of this War Week with a free key", () => {
    expect(scheduleItemGuardError(values, ctx)).toBeNull();
    expect(
      scheduleItemGuardError({ ...values, competitionId: null }, ctx),
    ).toBeNull();
  });

  it("refuses a duplicate Day, start time and title", () => {
    expect(
      scheduleItemGuardError(
        { ...values, startTime: "13:00" },
        { ...ctx, otherItems: ctx.otherItems },
      ),
    ).toBe(
      'There\'s already a Schedule Item "Kickoff" at 1:00 PM on that Day.',
    );
  });

  it("refuses a second untimed item with the same title on the Day", () => {
    expect(
      scheduleItemGuardError(
        { ...values, startTime: null },
        {
          ...ctx,
          otherItems: [
            ...ctx.otherItems,
            { dayId: DAY, startTime: null, title: "Kickoff" },
          ],
        },
      ),
    ).toBe(
      'There\'s already a Schedule Item "Kickoff" with no start time on that Day.',
    );
    // A timed "Kickoff" is a different key.
    expect(
      scheduleItemGuardError({ ...values, startTime: null }, ctx),
    ).toBeNull();
  });

  it("refuses a Day or Competition of another War Week", () => {
    expect(scheduleItemGuardError(values, { ...ctx, dayIds: [] })).toBe(
      "That Day no longer exists.",
    );
    expect(scheduleItemGuardError(values, { ...ctx, competitionIds: [] })).toBe(
      "That Competition no longer exists.",
    );
  });
});

describe("scheduleItemInputFrom", () => {
  it("fills the form from a stored item, trimming seconds off times", () => {
    expect(
      scheduleItemInputFrom({
        dayId: DAY,
        startTime: "09:00:00",
        endTime: null,
        title: "Kickoff",
        hostIds: [HOST],
        location: "Lobby",
        virtualLink: null,
        category: "social",
        competitionId: null,
        description: null,
      }),
    ).toEqual({
      dayId: DAY,
      startTime: "09:00",
      endTime: "",
      title: "Kickoff",
      hostIds: [HOST],
      location: "Lobby",
      virtualLink: "",
      category: "social",
      competitionId: "",
      description: { type: "doc", content: [] },
    });
  });
});

describe("scheduleItemInputFrom an untimed item", () => {
  it("leaves the start time blank", () => {
    expect(
      scheduleItemInputFrom({
        dayId: DAY,
        startTime: null,
        endTime: null,
        title: "Step Challenge",
        hostIds: [],
        location: null,
        virtualLink: null,
        category: "other",
        competitionId: null,
        description: null,
      }).startTime,
    ).toBe("");
  });
});

describe("parseFaqItemInput", () => {
  const faq: FaqItemInput = {
    question: " Where do I park? ",
    answer: doc("Lot B"),
  };

  it("trims the question and sanitizes the answer", () => {
    expect(parseFaqItemInput(faq)).toEqual({
      ok: true,
      value: { question: "Where do I park?", answer: doc("Lot B") },
    });
  });

  it("refuses a blank question or answer", () => {
    expect(parseFaqItemInput({ ...faq, question: " " })).toMatchObject({
      ok: false,
      error: "Question must not be empty.",
    });
    expect(
      parseFaqItemInput({ ...faq, answer: { type: "doc", content: [] } }),
    ).toMatchObject({ ok: false, error: "Answer must not be empty." });
    expect(parseFaqItemInput({ ...faq, answer: null })).toMatchObject({
      ok: false,
      error: "Answer must be valid rich text.",
    });
  });
});

describe("faqItemGuardError", () => {
  it("refuses a question already asked", () => {
    expect(faqItemGuardError("Where do I park?", ["Lunch?"])).toBeNull();
    expect(faqItemGuardError("Where do I park?", ["Where do I park?"])).toBe(
      'There\'s already an FAQ Item "Where do I park?".',
    );
  });
});

describe("moveInOrder", () => {
  it("swaps an id with its neighbor", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("returns null at either end or for an unknown id", () => {
    expect(moveInOrder(["a", "b"], "a", "up")).toBeNull();
    expect(moveInOrder(["a", "b"], "b", "down")).toBeNull();
    expect(moveInOrder(["a", "b"], "z", "up")).toBeNull();
  });
});

describe("Schedule and FAQ parsers given a malformed call", () => {
  const MALFORMED: [string, unknown][] = [
    ["{}", {}],
    ["null", null],
    ["undefined", undefined],
    ["a string", "x"],
    ["a number", 5],
  ];

  it.each(MALFORMED)(
    "parseScheduleItemInput returns an error for %s",
    (_label, value) => {
      expect(parseScheduleItemInput(value as never)).toMatchObject({
        ok: false,
      });
    },
  );

  it.each(MALFORMED)(
    "parseFaqItemInput returns an error for %s",
    (_label, value) => {
      expect(parseFaqItemInput(value as never)).toMatchObject({ ok: false });
    },
  );

  it.each<[string, Record<string, unknown>]>([
    ["question: 5", { question: 5, answer: "x" }],
    ["answer: 5", { question: "Why?", answer: 5 }],
  ])("parseFaqItemInput returns an error for %s", (_label, value) => {
    expect(parseFaqItemInput(value as never)).toMatchObject({ ok: false });
  });
});

describe("Schedule and FAQ parsers' field errors", () => {
  it("names each refused Schedule Item field", () => {
    expect(parsedItem({ title: " ", dayId: "" })).toEqual({
      ok: false,
      error: "Pick a Day.",
      fieldErrors: { dayId: "Pick a Day.", title: "Title must not be empty." },
    });
  });

  it("names the refused FAQ field", () => {
    expect(parseFaqItemInput({ question: " ", answer: null })).toEqual({
      ok: false,
      error: "Question must not be empty.",
      fieldErrors: {
        question: "Question must not be empty.",
        answer: "Answer must be valid rich text.",
      },
    });
  });
});

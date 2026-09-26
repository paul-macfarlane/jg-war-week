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
  host: " Jason ",
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
        host: "Jason",
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
    };
    expect(parsedItem({ endTime: "08:59" })).toEqual(error);
    expect(parsedItem({ endTime: "09:00" })).toEqual(error);
  });

  it("words field errors with the field's label", () => {
    expect(parsedItem({ title: "  " })).toEqual({
      ok: false,
      error: "Title must not be empty.",
    });
    expect(parsedItem({ startTime: "9am" })).toEqual({
      ok: false,
      error: "Start time must be a 24-hour HH:MM time.",
    });
    expect(parsedItem({ virtualLink: "http://example.com" })).toEqual({
      ok: false,
      error: "Virtual link must be an https URL.",
    });
    expect(parsedItem({ category: "nap" })).toEqual({
      ok: false,
      error:
        "Category must be one of competition, education, social, meal, work, other.",
    });
    expect(parsedItem({ dayId: "" })).toEqual({
      ok: false,
      error: "Pick a Day.",
    });
    expect(parsedItem({ description: "<p>hi</p>" })).toEqual({
      ok: false,
      error: "Description must be valid rich text.",
    });
  });

  it("accepts an `other` category", () => {
    expect(parsedItem({ category: "other" })).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });
});

describe("scheduleItemGuardError", () => {
  const values = {
    dayId: DAY,
    startTime: "09:00",
    title: "Kickoff",
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
        host: null,
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
      host: "",
      location: "Lobby",
      virtualLink: "",
      category: "social",
      competitionId: "",
      description: { type: "doc", content: [] },
    });
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
    expect(parseFaqItemInput({ ...faq, question: " " })).toEqual({
      ok: false,
      error: "Question must not be empty.",
    });
    expect(
      parseFaqItemInput({ ...faq, answer: { type: "doc", content: [] } }),
    ).toEqual({ ok: false, error: "Answer must not be empty." });
    expect(parseFaqItemInput({ ...faq, answer: null })).toEqual({
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

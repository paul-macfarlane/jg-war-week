import { z } from "zod";

import type { ScheduleItem } from "@/db/schema";
import { SCHEDULE_ITEM_CATEGORIES } from "@/lib/enums";
import type { Parsed } from "@/lib/result";
import {
  type Content,
  contentInputSchema,
  isBlankContent,
} from "@/lib/rich-text/content";
import { formatEtTime } from "@/lib/schedule";
import { optional, parseWith, trimmed } from "@/lib/setup";

// Field rules the seed file (`src/seed/schema.ts`) and the setup forms share,
// so seed and setup can't drift.

const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

export const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be a 24-hour HH:MM time");

// Strict: a Schedule Item carries no Host in a seed (`host` or `hosts` is
// refused, not ignored); an Organizer adds them (CONTEXT.md, Seed).
export const scheduleItemSeedSchema = z
  .strictObject({
    /** Omitted for an "Any time" item. */
    startTime: clockTime.nullish(),
    endTime: clockTime.nullish(),
    title: z.string().min(1).max(200),
    location: z.string().max(200).nullish(),
    virtualLink: httpsUrl.nullish(),
    description: contentInputSchema.nullish(),
    category: z.enum(SCHEDULE_ITEM_CATEGORIES),
    /** A Competition name from this seed. */
    competition: z.string().min(1).max(120).nullish(),
  })
  .refine((item) => !item.endTime || item.startTime, {
    message: "endTime needs a startTime",
    path: ["endTime"],
  })
  .refine(
    (item) => !item.endTime || !item.startTime || item.endTime > item.startTime,
    { message: "endTime must be after startTime", path: ["endTime"] },
  )
  .refine((item) => !item.competition || item.category === "competition", {
    message: "only a competition-category item can link a Competition",
    path: ["competition"],
  });

export const faqItemSeedSchema = z.object({
  question: z.string().min(1).max(300),
  answer: contentInputSchema,
});

/** The Schedule Item form's raw fields, all as the inputs hold them. */
export type ScheduleItemInput = {
  dayId: string;
  /** Blank for an "Any time" item. */
  startTime: string;
  endTime: string;
  title: string;
  /** The item's own Hosts (roster Participant ids); none with a Competition. */
  hostIds: string[];
  location: string;
  virtualLink: string;
  category: string;
  /** Blank for no linked Competition. */
  competitionId: string;
  description: unknown;
};

/** The `schedule_item` columns the form writes, and the item's own Hosts. */
type ScheduleItemColumns = Pick<
  ScheduleItem,
  | "dayId"
  | "startTime"
  | "endTime"
  | "title"
  | "location"
  | "virtualLink"
  | "category"
  | "competitionId"
  | "description"
> & { hostIds: string[] };

const EMPTY_DOC: Content = { type: "doc", content: [] };

/** The form's starting fields from a stored item (times come back HH:MM:SS). */
export function scheduleItemInputFrom(
  item: ScheduleItemColumns,
): ScheduleItemInput {
  return {
    dayId: item.dayId,
    startTime: item.startTime?.slice(0, 5) ?? "",
    endTime: item.endTime?.slice(0, 5) ?? "",
    title: item.title,
    hostIds: item.hostIds,
    location: item.location ?? "",
    virtualLink: item.virtualLink ?? "",
    category: item.category,
    competitionId: item.competitionId ?? "",
    description: item.description ?? EMPTY_DOC,
  };
}

/** Rich text that is blank or only empty paragraphs is no content at all. */
function optionalContent<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (isBlankContent(value) ? null : value), schema)
    .transform((value) => value ?? null);
}

const COMPETITION_ON_OTHER_CATEGORY =
  "Only a Competition item can link a Competition.";

const item = scheduleItemSeedSchema.shape;
const scheduleItemSchema = z
  .object({
    dayId: z.uuid({ error: "Pick a Day." }),
    startTime: optional(item.startTime),
    endTime: optional(item.endTime),
    title: trimmed(item.title),
    hostIds: z
      .array(z.uuid({ error: "Pick each Host from the list." }))
      .transform((ids) => [...new Set(ids)]),
    location: optional(item.location),
    virtualLink: optional(item.virtualLink),
    category: item.category,
    competitionId: optional(
      z.uuid({ error: "Pick a Competition from the list." }).nullish(),
    ),
    description: optionalContent(item.description),
  })
  .refine((s) => !s.endTime || s.startTime, {
    error: "Add a start time first.",
    path: ["endTime"],
  })
  .refine((s) => !s.endTime || !s.startTime || s.endTime > s.startTime, {
    error: "End time must be after the start time.",
    path: ["endTime"],
  })
  .refine((s) => s.competitionId === null || s.category === "competition", {
    error: COMPETITION_ON_OTHER_CATEGORY,
    path: ["competitionId"],
  });

export type ScheduleItemValues = z.infer<typeof scheduleItemSchema>;

const faq = faqItemSeedSchema.shape;
const faqItemSchema = z.object({
  question: trimmed(faq.question),
  answer: faq.answer.refine((answer) => !isBlankContent(answer), {
    error: "Answer must not be empty.",
  }),
});

export type FaqItemInput = { question: string; answer: unknown };
export type FaqItemValues = z.infer<typeof faqItemSchema>;

const LABELS: Record<string, string> = {
  startTime: "Start time",
  endTime: "End time",
  title: "Title",
  hostIds: "Hosts",
  location: "Location",
  virtualLink: "Virtual link",
  category: "Category",
  description: "Description",
  question: "Question",
  answer: "Answer",
};

/** A rich-text field that isn't a document at all (only a direct POST). */
function invalidRichText(issue: z.core.$ZodIssue): string | null {
  const field = String(issue.path[0]);
  return (field === "description" || field === "answer") &&
    issue.message.startsWith("Content must")
    ? `${LABELS[field]} must be valid rich text.`
    : null;
}

/** Validates the Schedule Item form. Never throws; returns the first error. */
export function parseScheduleItemInput(
  input: ScheduleItemInput,
): Parsed<ScheduleItemValues> {
  return parseWith(scheduleItemSchema, input, invalidRichText, LABELS);
}

/** Validates the FAQ Item form. Never throws; returns the first error. */
export function parseFaqItemInput(input: FaqItemInput): Parsed<FaqItemValues> {
  return parseWith(faqItemSchema, input, invalidRichText, LABELS);
}

/**
 * Refuses a Schedule Item on a Day or Competition outside the War Week, or
 * one whose Day, start time and title (its natural key; no start time is a
 * value like any other) are taken.
 */
export function scheduleItemGuardError(
  values: Pick<
    ScheduleItemValues,
    "dayId" | "startTime" | "title" | "category" | "competitionId"
  >,
  ctx: {
    dayIds: string[];
    competitionIds: string[];
    otherItems: Pick<ScheduleItem, "dayId" | "startTime" | "title">[];
  },
): string | null {
  if (!ctx.dayIds.includes(values.dayId)) return "That Day no longer exists.";
  if (values.competitionId !== null) {
    if (!ctx.competitionIds.includes(values.competitionId)) {
      return "That Competition no longer exists.";
    }
    if (values.category !== "competition") return COMPETITION_ON_OTHER_CATEGORY;
  }
  const taken = ctx.otherItems.some(
    (other) =>
      other.dayId === values.dayId &&
      (other.startTime?.slice(0, 5) ?? null) === values.startTime &&
      other.title === values.title,
  );
  return taken ? duplicateScheduleItemError(values) : null;
}

export function duplicateScheduleItemError(
  values: Pick<ScheduleItemValues, "startTime" | "title">,
): string {
  return values.startTime === null
    ? `There's already a Schedule Item "${values.title}" with no start time on that Day.`
    : `There's already a Schedule Item "${values.title}" at ${formatEtTime(values.startTime)} on that Day.`;
}

/** Refuses a question the War Week's FAQ already asks (its natural key). */
export function faqItemGuardError(
  question: string,
  otherQuestions: string[],
): string | null {
  return otherQuestions.includes(question)
    ? duplicateFaqItemError(question)
    : null;
}

export function duplicateFaqItemError(question: string): string {
  return `There's already an FAQ Item "${question}".`;
}

/** `ids` with `id` swapped with its neighbor, or null when it can't move. */
export function moveInOrder(
  ids: string[],
  id: string,
  direction: "up" | "down",
): string[] | null {
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const moved = [...ids];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved;
}

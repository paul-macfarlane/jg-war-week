import { z } from "zod";

import { type ScheduleItem, scheduleItemCategory } from "@/db/schema";
import {
  type Content,
  contentInputSchema,
  isBlankContent,
} from "@/lib/rich-text/content";
import { formatEtTime } from "@/lib/schedule";
import { type Parsed, optional, parseWith, trimmed } from "@/lib/setup";

// Field rules the seed file (`src/seed/schema.ts`) and the setup forms share,
// so seed and setup can't drift.

const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be a 24-hour HH:MM time");

export const scheduleItemSeedSchema = z
  .object({
    startTime: clockTime,
    endTime: clockTime.nullish(),
    title: z.string().min(1).max(200),
    host: z.string().max(200).nullish(),
    location: z.string().max(200).nullish(),
    virtualLink: httpsUrl.nullish(),
    description: contentInputSchema.nullish(),
    category: z.enum(scheduleItemCategory.enumValues),
    /** A Competition name from this seed. */
    competition: z.string().min(1).max(120).nullish(),
  })
  .refine((item) => !item.endTime || item.endTime > item.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export type ScheduleItemSeed = z.infer<typeof scheduleItemSeedSchema>;

export const faqItemSeedSchema = z.object({
  question: z.string().min(1).max(300),
  answer: contentInputSchema,
});

export type FaqItemSeed = z.infer<typeof faqItemSeedSchema>;

/** The Schedule Item form's raw fields, all as the inputs hold them. */
export type ScheduleItemInput = {
  dayId: string;
  startTime: string;
  endTime: string;
  title: string;
  host: string;
  location: string;
  virtualLink: string;
  category: string;
  /** Blank for no linked Competition. */
  competitionId: string;
  description: unknown;
};

/** The `schedule_item` columns the form writes. */
type ScheduleItemColumns = Pick<
  ScheduleItem,
  | "dayId"
  | "startTime"
  | "endTime"
  | "title"
  | "host"
  | "location"
  | "virtualLink"
  | "category"
  | "competitionId"
  | "description"
>;

const EMPTY_DOC: Content = { type: "doc", content: [] };

/** The form's starting fields from a stored item (times come back HH:MM:SS). */
export function scheduleItemInputFrom(
  item: ScheduleItemColumns,
): ScheduleItemInput {
  return {
    dayId: item.dayId,
    startTime: item.startTime.slice(0, 5),
    endTime: item.endTime?.slice(0, 5) ?? "",
    title: item.title,
    host: item.host ?? "",
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

const item = scheduleItemSeedSchema.shape;
const scheduleItemSchema = z
  .object({
    dayId: z.uuid({ error: "Pick a Day." }),
    startTime: trimmed(item.startTime),
    endTime: optional(item.endTime),
    title: trimmed(item.title),
    host: optional(item.host),
    location: optional(item.location),
    virtualLink: optional(item.virtualLink),
    category: item.category,
    competitionId: optional(
      z.uuid({ error: "Pick a Competition from the list." }).nullish(),
    ),
    description: optionalContent(item.description),
  })
  .refine((s) => !s.endTime || s.endTime > s.startTime, {
    error: "End time must be after the start time.",
    path: ["endTime"],
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
  host: "Host",
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
 * one whose Day, start time and title (its natural key) are taken.
 */
export function scheduleItemGuardError(
  values: Pick<
    ScheduleItemValues,
    "dayId" | "startTime" | "title" | "competitionId"
  >,
  ctx: {
    dayIds: string[];
    competitionIds: string[];
    otherItems: Pick<ScheduleItem, "dayId" | "startTime" | "title">[];
  },
): string | null {
  if (!ctx.dayIds.includes(values.dayId)) return "That Day no longer exists.";
  if (
    values.competitionId !== null &&
    !ctx.competitionIds.includes(values.competitionId)
  ) {
    return "That Competition no longer exists.";
  }
  const taken = ctx.otherItems.some(
    (other) =>
      other.dayId === values.dayId &&
      other.startTime.slice(0, 5) === values.startTime &&
      other.title === values.title,
  );
  return taken ? duplicateScheduleItemError(values) : null;
}

export function duplicateScheduleItemError(
  values: Pick<ScheduleItemValues, "startTime" | "title">,
): string {
  return `There's already a Schedule Item "${values.title}" at ${formatEtTime(values.startTime)} on that Day.`;
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

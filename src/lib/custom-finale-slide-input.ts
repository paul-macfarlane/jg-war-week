import { z } from "zod";

import { FINALE_SLIDE_HEADING_MAX } from "@/lib/finale-slides";
import type { Parsed } from "@/lib/result";
import { type Content, contentInputSchema } from "@/lib/rich-text/content";
import { parseWith, trimmed } from "@/lib/setup";

const customSlideSchema = z.object({
  heading: trimmed(z.string().min(1).max(FINALE_SLIDE_HEADING_MAX)),
  // Sanitized on write; a document with nothing in it is fine (a slide
  // can be just its heading).
  body: contentInputSchema,
  // `#rrggbb` lower-cased, or null for the theme's background.
  backgroundColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb color")
    .transform((color) => color.toLowerCase())
    .nullable(),
});

/** What the Custom slide form posts. */
export type CustomSlideInput = {
  heading: string;
  body: unknown;
  backgroundColor: string | null;
};

/** A Custom slide's values, as stored. */
export type CustomSlideValues = {
  heading: string;
  body: Content;
  backgroundColor: string | null;
};

const LABELS: Record<string, string> = {
  heading: "Heading",
  body: "Body",
  backgroundColor: "Background",
};

/** Validates the Custom slide form. Never throws; returns the first error. */
export function parseCustomSlideInput(
  input: CustomSlideInput,
): Parsed<CustomSlideValues> {
  return parseWith(
    customSlideSchema,
    input,
    (issue) =>
      issue.path[0] === "body" && issue.message.startsWith("Content must")
        ? "Body must be valid rich text."
        : null,
    LABELS,
  );
}

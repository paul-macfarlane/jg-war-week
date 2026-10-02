/**
 * The Finale's slides (CONTEXT.md, "Finale rules"): which slides a War Week
 * shows, in what order, and what each one needs to render. Pure: the page
 * loads the rows and the data; the slideshow steps through them.
 */
import { z } from "zod";

import { FINALE_SLIDE_KINDS, type FinaleSlideKind } from "@/lib/enums";
import { type Content, contentInputSchema } from "@/lib/rich-text/content";
import type { Standings } from "@/lib/standings";

/** The built-in slides, in their default order. */
export const BUILT_IN_FINALE_SLIDE_KINDS = FINALE_SLIDE_KINDS.filter(
  (kind): kind is Exclude<FinaleSlideKind, "custom"> => kind !== "custom",
);

export type BuiltInFinaleSlideKind =
  (typeof BUILT_IN_FINALE_SLIDE_KINDS)[number];

/** What the admin list and the slideshow call each built-in slide. */
export const BUILT_IN_FINALE_SLIDE_NAMES: Record<
  BuiltInFinaleSlideKind,
  string
> = {
  title: "Title",
  numbers: "By the numbers",
  awards: "Awards",
  champions: "Champions",
  standings: "Standings countdown",
  winner: "Winner",
};

/** The longest Custom slide heading. */
export const FINALE_SLIDE_HEADING_MAX = 120;

/**
 * One slide in a seed file's `finaleSlides` list (its place is its order):
 * a built-in by kind, or a Custom slide with a heading, an optional body
 * (sanitized) and an optional `#rrggbb` background (lower-cased).
 */
export const finaleSlideSeedSchema = z
  .object({
    kind: z.enum(FINALE_SLIDE_KINDS),
    hidden: z.boolean().default(false),
    heading: z.string().trim().min(1).max(FINALE_SLIDE_HEADING_MAX).optional(),
    body: contentInputSchema.optional(),
    backgroundColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb color")
      .transform((color) => color.toLowerCase())
      .optional(),
  })
  .superRefine((slide, ctx) => {
    if (slide.kind === "custom") {
      if (slide.heading === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["heading"],
          message: "a Custom slide needs a heading",
        });
      }
      return;
    }
    for (const field of ["heading", "body", "backgroundColor"] as const) {
      if (slide[field] !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `only a Custom slide has a ${field}`,
        });
      }
    }
  });

export type FinaleSlideSeed = z.infer<typeof finaleSlideSeedSchema>;

/** A saved `finale_slide` row, as the resolution reads it. */
export type FinaleSlideRow = {
  id: string;
  kind: FinaleSlideKind;
  sortOrder: number;
  hidden: boolean;
  heading: string | null;
  body: Content | null;
  backgroundColor: string | null;
};

/**
 * One slide in a War Week's list: a saved row, or (`id` null) a built-in
 * not saved yet. `key` is the kind for a built-in and the id for a Custom
 * slide, unique within the list.
 */
export type ResolvedFinaleSlide = {
  key: string;
  id: string | null;
  kind: FinaleSlideKind;
  name: string;
  hidden: boolean;
  heading: string | null;
  body: Content | null;
  backgroundColor: string | null;
};

/** How an action names a slide: a built-in by kind, a Custom slide by id. */
export type FinaleSlideRef = { kind: BuiltInFinaleSlideKind } | { id: string };

function builtIn(kind: BuiltInFinaleSlideKind): ResolvedFinaleSlide {
  return {
    key: kind,
    id: null,
    kind,
    name: BUILT_IN_FINALE_SLIDE_NAMES[kind],
    hidden: false,
    heading: null,
    body: null,
    backgroundColor: null,
  };
}

/**
 * A War Week's slide list. No rows: the default order, nothing hidden.
 * Otherwise the rows by `sortOrder` (then id), with any built-in missing
 * from them appended in its default relative order, so a new built-in
 * shows up without a migration. Hidden slides stay in the list (the admin
 * list shows them); `visibleFinaleSlides` drops them.
 */
export function resolveFinaleSlides(
  rows: FinaleSlideRow[],
): ResolvedFinaleSlide[] {
  const saved = [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((row): ResolvedFinaleSlide => {
      const isBuiltIn = row.kind !== "custom";
      return {
        key: isBuiltIn ? row.kind : row.id,
        id: row.id,
        kind: row.kind,
        name:
          row.kind === "custom"
            ? (row.heading ?? "Custom slide")
            : BUILT_IN_FINALE_SLIDE_NAMES[row.kind],
        hidden: row.hidden,
        heading: row.heading,
        body: row.body,
        backgroundColor: row.backgroundColor,
      };
    });
  const savedKinds = new Set(saved.map((slide) => slide.kind));
  const missing = BUILT_IN_FINALE_SLIDE_KINDS.filter(
    (kind) => !savedKinds.has(kind),
  ).map(builtIn);
  return [...saved, ...missing];
}

/** The slides the Finale plays: the list without its hidden slides. */
export function visibleFinaleSlides<T extends { hidden: boolean }>(
  slides: T[],
): T[] {
  return slides.filter((slide) => !slide.hidden);
}

/** Whether `slide` is the one `ref` names. */
export function isFinaleSlide(
  slide: Pick<ResolvedFinaleSlide, "id" | "kind">,
  ref: FinaleSlideRef,
): boolean {
  return "kind" in ref
    ? slide.kind === ref.kind
    : slide.kind === "custom" && slide.id === ref.id;
}

/** How the admin list names a slide in a request. */
export function finaleSlideRef(
  slide: Pick<ResolvedFinaleSlide, "id" | "kind">,
): FinaleSlideRef {
  return slide.kind === "custom"
    ? { id: slide.id ?? "" }
    : { kind: slide.kind };
}

/**
 * `ids` with `id` moved to `index` (clamped to the list), or null when
 * `id` isn't in the list.
 */
export function moveToIndex(
  ids: string[],
  id: string,
  index: number,
): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = Math.max(0, Math.min(ids.length - 1, Math.trunc(index)));
  const moved = ids.filter((other) => other !== id);
  moved.splice(to, 0, id);
  return moved;
}

/** What every slide carries, whatever its kind. */
type SlideBase = { key: string; name: string };

/**
 * What one Finale slide needs to render, by kind (the slideshow's `kind →
 * component` switch reads it). Built-ins other than the Standings countdown
 * are placeholders until their slides land (tickets 73 and 74).
 */
export type FinaleSlideData =
  | (SlideBase & { kind: "title" })
  | (SlideBase & { kind: "numbers" })
  | (SlideBase & { kind: "awards" })
  | (SlideBase & { kind: "champions" })
  | (SlideBase & {
      kind: "standings";
      /** The page's one `getStandings` result, shown as is. */
      standings: Standings;
      teamLabel: string;
      /** The Appearance Theme primary color, for Avatars with no Team. */
      primaryColor: string;
    })
  | (SlideBase & { kind: "winner" })
  | (SlideBase & {
      kind: "custom";
      heading: string;
      body: Content | null;
      backgroundColor: string | null;
    });

/**
 * How many steps a slide reveals before Next moves on (the step protocol):
 * 0 shows everything on arrival; the Standings countdown is one step (its
 * countdown, finished by Next or by itself).
 */
export function finaleSlideSteps(data: FinaleSlideData): number {
  switch (data.kind) {
    case "standings":
      return 1;
    default:
      return 0;
  }
}

/** Where the presenter is: a slide, and how many of its steps are shown. */
export type FinalePosition = { index: number; step: number };

/**
 * Next (`→`, `Space`, `PageDown`, a click on the stage): the current
 * slide's next step, else the next slide on arrival (step 0). At the end
 * of the last slide it does nothing; nothing auto-advances. `steps` holds
 * each slide's `finaleSlideSteps`.
 */
export function nextFinalePosition(
  position: FinalePosition,
  steps: number[],
): FinalePosition {
  const { index, step } = position;
  if (step < (steps[index] ?? 0)) return { index, step: step + 1 };
  if (index < steps.length - 1) return { index: index + 1, step: 0 };
  return position;
}

/** Back (`←`, `PageUp`): the previous slide, every step shown. */
export function backFinalePosition(
  position: FinalePosition,
  steps: number[],
): FinalePosition {
  const index = position.index - 1;
  return index < 0 ? position : { index, step: steps[index] ?? 0 };
}

/**
 * A slide that finished by itself (the countdown landing): every step
 * shown, so Next moves on. Only while the presenter is still on it.
 */
export function completeFinaleSlide(
  position: FinalePosition,
  index: number,
  steps: number[],
): FinalePosition {
  if (position.index !== index) return position;
  const last = steps[index] ?? 0;
  return position.step === last ? position : { index, step: last };
}

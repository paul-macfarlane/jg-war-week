/**
 * Validation for the Bracket server actions' input. Never throws; each
 * parser returns the first error, worded for the Organizer.
 */
import { z } from "zod";

import { type HeatsConfig, bracketConfigSchema } from "@/lib/bracket/config";
import type { Format, HeatResult } from "@/lib/bracket/types";
import { COMPETITION_FORMATS } from "@/lib/enums";
import type { Parsed } from "@/lib/result";

function parse<T>(schema: z.ZodType<T, unknown>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.issues[0].message };
}

const id = (error: string) => z.uuid({ error });

/** The most Entrants a Bracket takes. */
export const MAX_ENTRANTS = 64;

export type FormatInput = {
  format: Format;
  /** The heats Format's config; omitted keeps (or defaults) the saved one. */
  config?: HeatsConfig | null;
  /** Clears Heat Results when a different config clears the Heats. */
  force?: boolean;
};

const formatSchema = z
  .object({
    format: z.enum(COMPETITION_FORMATS, {
      error: "Choose a Format.",
    }),
    config: z.unknown().optional(),
    force: z.boolean().optional(),
  })
  .transform((value, ctx): FormatInput => {
    const out: FormatInput = { format: value.format };
    if (value.config !== undefined) {
      const config = bracketConfigSchema(value.format).safeParse(value.config);
      if (!config.success) {
        ctx.addIssue({
          code: "custom",
          message:
            value.format === "heats"
              ? config.error.issues[0].message
              : "Only the heats Format takes Heat settings.",
          path: ["config"],
        });
        return z.NEVER;
      }
      if (config.data !== undefined) out.config = config.data;
    }
    if (value.force !== undefined) out.force = value.force;
    return out;
  });

export function parseFormatInput(input: unknown): Parsed<FormatInput> {
  return parse(formatSchema, input);
}

const entrantsSchema = z.object({
  targetIds: z.array(id("Choose Teams or Participants.")).max(MAX_ENTRANTS, {
    error: `A Bracket takes at most ${MAX_ENTRANTS} Entrants.`,
  }),
  force: z.boolean().optional(),
});

export type EntrantsInput = z.infer<typeof entrantsSchema>;

export function parseEntrantsInput(input: unknown): Parsed<EntrantsInput> {
  return parse(entrantsSchema, input);
}

const generateSchema = z.object({
  /** Random Seed Positions, or by the current Standings; default random. */
  seeding: z.enum(["random", "standings"]).optional(),
  force: z.boolean().optional(),
});

export type GenerateInput = z.infer<typeof generateSchema>;

export function parseGenerateInput(input: unknown): Parsed<GenerateInput> {
  return parse(generateSchema, input);
}

const entrantId = id("Choose the Heat's Entrants.");

const heatResultSchema = z.object({
  order: z.array(entrantId).min(1, {
    error: "Put the Heat's Entrants in finishing order.",
  }),
  scores: z
    .record(
      entrantId,
      z.string().trim().max(40, { error: "Scores are at most 40 characters." }),
    )
    .optional(),
  forfeits: z.array(entrantId).optional(),
});

export function parseHeatResultInput(input: unknown): Parsed<HeatResult> {
  return parse(heatResultSchema, input);
}

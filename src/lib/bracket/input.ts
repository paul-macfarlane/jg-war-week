/**
 * Validation for the Bracket server actions' input. Never throws; each
 * parser returns the first error, worded for the Organizer.
 */
import { z } from "zod";

import { competitionFormat } from "@/db/schema";
import type { HeatResult } from "@/lib/bracket/types";

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parse<T>(schema: z.ZodType<T>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.issues[0].message };
}

const id = (error: string) => z.uuid({ error });

/** The most Entrants a Bracket takes. */
export const MAX_ENTRANTS = 64;

const formatSchema = z.object({
  format: z.enum(competitionFormat.enumValues, {
    error: "Choose a Format.",
  }),
  bracketPoints: z
    // Only placings is built; per-heat and both are deferred.
    .enum(["placings"], {
      error: "Choose how the Bracket awards points.",
    })
    .optional(),
});

export type FormatInput = z.infer<typeof formatSchema>;

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

const generateSchema = z.object({ force: z.boolean().optional() });

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

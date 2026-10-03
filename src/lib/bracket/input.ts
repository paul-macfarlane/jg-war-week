/**
 * Validation for the Bracket server actions' input. Never throws; each
 * parser returns the first error, worded for the Organizer.
 */
import { z } from "zod";

import { type BracketConfig, bracketConfigSchema } from "@/lib/bracket/config";
import { SQUAD_PARTICIPANTS_MAX } from "@/lib/bracket/squads";
import type { Format, HeatResult } from "@/lib/bracket/types";
import {
  COMPETITION_FORMATS,
  type GameFormat,
  isGameFormat,
} from "@/lib/enums";
import type { Parsed } from "@/lib/result";

function parse<T>(schema: z.ZodType<T, unknown>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.issues[0].message };
}

const id = (error: string) => z.uuid({ error });

/** The most Entrants a Bracket takes. */
export const MAX_ENTRANTS = 64;

/** A Format chosen only at create: a Competition keeps it. */
type FixedFormat = GameFormat | "participation";

export type FormatInput = {
  /**
   * Never a Games Format or `participation`: a Competition is one of those from
   * creation, and stays so.
   */
  format: Exclude<Format, FixedFormat>;
  /** A Bracket's config; omitted keeps (or defaults) the saved one. */
  config?: BracketConfig;
  /** Clears Heat Results when a different config clears the Heats. */
  force?: boolean;
};

const formatSchema = z
  .object({
    format: z.enum(
      COMPETITION_FORMATS.filter(
        (format): format is Exclude<Format, FixedFormat> =>
          !isGameFormat(format) && format !== "participation",
      ),
      { error: "Choose a Format." },
    ),
    config: z.unknown().optional(),
    force: z.boolean().optional(),
  })
  .transform((value, ctx): FormatInput => {
    const out: FormatInput = { format: value.format };
    if (value.config !== undefined) {
      const config =
        value.format === "bracket"
          ? bracketConfigSchema.safeParse(value.config)
          : null;
      if (!config?.success) {
        ctx.addIssue({
          code: "custom",
          message: config
            ? config.error.issues[0].message
            : "Only a Bracket takes Heat settings.",
          path: ["config"],
        });
        return z.NEVER;
      }
      out.config = config.data;
    }
    if (value.force !== undefined) out.force = value.force;
    return out;
  });

export function parseFormatInput(input: unknown): Parsed<FormatInput> {
  return parse(formatSchema, input);
}

const entrantsSchema = z.object({
  /** Teams, Participants or Squads; omitted means the scoring's kind. */
  kind: z
    .enum(["team", "participant", "squad"], {
      error: "Choose Teams, Participants or Squads.",
    })
    .optional(),
  targetIds: z.array(id("Choose Teams or Participants.")).max(MAX_ENTRANTS, {
    error: `A Bracket takes at most ${MAX_ENTRANTS} Entrants.`,
  }),
  force: z.boolean().optional(),
});

export type EntrantsInput = z.infer<typeof entrantsSchema>;

export function parseEntrantsInput(input: unknown): Parsed<EntrantsInput> {
  return parse(entrantsSchema, input);
}

const squadSchema = z.object({
  name: z.string({ error: "Enter the Squad's name." }).trim(),
  /** None chosen (`""` or null) is left to the Squad rules to refuse. */
  teamId: z
    .union([id("Choose a Team."), z.literal(""), z.null()], {
      error: "Choose a Team.",
    })
    .transform((value) => value || null),
  participantIds: z
    .array(id("Choose Participants."), { error: "Choose Participants." })
    .max(SQUAD_PARTICIPANTS_MAX, {
      error: `A Squad has at most ${SQUAD_PARTICIPANTS_MAX} Participants.`,
    })
    .transform((ids) => [...new Set(ids)]),
});

export type SquadInput = z.infer<typeof squadSchema>;

/**
 * A Squad's name, Team and Participants, posted as JSON. Checks their shape
 * only, naming the field; `squadError` (in the mutation) owns the rules.
 */
export function parseSquadInput(input: unknown): Parsed<SquadInput> {
  const result = squadSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const issue = result.error.issues[0];
  const field = typeof issue.path[0] === "string" ? issue.path[0] : null;
  return {
    ok: false,
    error: issue.message,
    ...(field ? { fieldErrors: { [field]: issue.message } } : {}),
  };
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

/**
 * Validation for the Bracket server actions' input. Never throws; each
 * parser returns the first error, worded for the Organizer.
 */
import { z } from "zod";

import { SQUAD_PARTICIPANTS_MAX } from "@/lib/bracket/squads";
import type { MatchResult } from "@/lib/bracket/types";
import type { Parsed } from "@/lib/result";

function parse<T>(schema: z.ZodType<T, unknown>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.issues[0].message };
}

const id = (error: string) => z.uuid({ error });

/** The most Entrants a Bracket takes. */
export const MAX_ENTRANTS = 64;

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

const entrantId = id("Choose the Match's Entrants.");

const matchResultSchema = z.object({
  order: z.array(entrantId).min(1, {
    error: "Put the Match's Entrants in finishing order.",
  }),
  // A Score is a number (numeric(12,3)); blank is none.
  scores: z
    .record(
      entrantId,
      z
        .string()
        .trim()
        .regex(/^(-?\d{1,9}(\.\d{1,3})?)?$/, {
          error: "A Score is a number, like 21 or 9.5.",
        }),
    )
    .optional(),
});

export function parseMatchResultInput(input: unknown): Parsed<MatchResult> {
  return parse(matchResultSchema, input);
}

const advanceSchema = z.object({
  advanceCount: z
    .number({ error: "Choose how many advance." })
    .int({ error: "Choose how many advance." }),
});

/** A Group Match's advancing count; the engine checks it against the Match. */
export function parseMatchAdvanceInput(
  input: unknown,
): Parsed<{ advanceCount: number }> {
  return parse(advanceSchema, input);
}

const moveSchema = z.object({
  entrantId: id("Choose the Entrant to move."),
  toMatchId: id("Choose the Match to move them to."),
});

/** An Entrant and the Match of its Round it moves to. */
export function parseMoveEntrantInput(
  input: unknown,
): Parsed<{ entrantId: string; toMatchId: string }> {
  return parse(moveSchema, input);
}

const roundDefaultsInputSchema = z.object({
  round: z
    .number({ error: "That Round isn't in this Bracket." })
    .int({ error: "That Round isn't in this Bracket." })
    .min(1, { error: "That Round isn't in this Bracket." }),
  entrantsPerMatch: z
    .number({ error: "Choose the entrants per Match." })
    .int({ error: "Choose the entrants per Match." }),
  advancePerMatch: z
    .number({ error: "Choose how many advance." })
    .int({ error: "Choose how many advance." }),
});

/** A Round and its new defaults; the engine checks the sizes. */
export function parseRoundDefaultsInput(input: unknown): Parsed<{
  round: number;
  entrantsPerMatch: number;
  advancePerMatch: number;
}> {
  return parse(roundDefaultsInputSchema, input);
}

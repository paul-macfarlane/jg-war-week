/**
 * Validation for recording a League Match's result (spec R23, decision 3;
 * reading R2): an optional Score per Entrant and the result, A won, B won
 * or a draw. With a Score direction and both Scores in, the Scores decide
 * (equal Scores a draw) and a posted result against them is refused; with
 * direction none or a Score missing, the recorder picks. Never throws;
 * returns the first error, worded for the person filling in the form.
 */
import { z } from "zod";

import { LEAGUE_RESULTS, type LeagueResult } from "@/lib/enums";
import type { ScoreDirection } from "@/lib/enums";
import { firstError, scoreSchema } from "@/lib/logged-input";
import type { Parsed } from "@/lib/result";
import { computedOutcome } from "@/lib/series/input";

export type LeagueResultInput = {
  result: LeagueResult;
  scoreA: number | null;
  scoreB: number | null;
};

export const SCORES_DECIDE = "The Scores decide this result: change a Score.";
export const CHOOSE_RESULT = "Choose the result.";

/** A blank Score is none; anything else must be a Score. */
const optionalScore = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === "" || value === null || value === undefined) return null;
    const score = scoreSchema.safeParse(value);
    if (score.success) return score.data;
    ctx.addIssue({ code: "custom", message: score.error.issues[0].message });
    return z.NEVER;
  });

const schema = z.object(
  {
    scoreA: optionalScore,
    scoreB: optionalScore,
    result: z.string().optional().default(""),
  },
  { error: CHOOSE_RESULT },
);

const isResult = (value: string): value is LeagueResult =>
  (LEAGUE_RESULTS as readonly string[]).includes(value);

/** The Match's result and Scores, or why they can't be recorded. */
export function parseLeagueResult(
  direction: ScoreDirection,
  raw: unknown,
): Parsed<LeagueResultInput> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return firstError(parsed);
  const { scoreA, scoreB, result: posted } = parsed.data;
  const refuse = (error: string): Parsed<LeagueResultInput> => ({
    ok: false,
    error,
    fieldErrors: { result: error },
  });
  if (posted !== "" && !isResult(posted)) return refuse(CHOOSE_RESULT);

  const computed = computedOutcome(direction, { drawsAllowed: true }, [
    scoreA,
    scoreB,
  ]);
  // Draws are always allowed, so equal Scores are a draw, never a tie.
  const decided: LeagueResult | null =
    computed === 0
      ? "a"
      : computed === 1
        ? "b"
        : computed === "draw"
          ? "draw"
          : null;
  if (decided !== null) {
    if (posted !== "" && posted !== decided) return refuse(SCORES_DECIDE);
    return { ok: true, value: { result: decided, scoreA, scoreB } };
  }
  if (posted === "") return refuse(CHOOSE_RESULT);
  return { ok: true, value: { result: posted, scoreA, scoreB } };
}

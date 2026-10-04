/**
 * Validation for logging or editing a Head-to-head Match (spec R21,
 * decisions 7 and 12): the series' two Entrants as fixed sides, each with
 * an optional Score, and the Winner. With a Score direction and both
 * Scores in, the Winner is worked out (equal Scores a Draw when draws are
 * allowed, else the recorder picks); a Winner picked by hand wins over the
 * Scores. Never throws; returns the first error, worded for the person
 * filling in the form.
 */
import { z } from "zod";

import type { ScoreDirection } from "@/lib/enums";
import { firstError, scoreSchema } from "@/lib/logged-input";
import type { ResultPlayerFact } from "@/lib/logged-results";
import type { Parsed } from "@/lib/result";
import { orderByScore, ranksByScore } from "@/lib/scoring";
import type { SeriesConfig } from "@/lib/series/config";

export type MatchInput = { players: ResultPlayerFact[] };

/** Equal Scores where draws aren't allowed. */
export const EQUAL_SCORES_PICK = "The Scores are equal: pick the Winner.";
const CHOOSE_WINNER = "Choose the Winner.";
const NO_DRAWS = "Draws aren't allowed in this Competition.";

/**
 * Who the Scores make the Winner: side 0 or 1, a Draw (equal Scores with
 * draws allowed), a tie the recorder must settle, or null when nothing can
 * be worked out (direction none, or a Score missing).
 */
export function computedOutcome(
  direction: ScoreDirection,
  config: Pick<SeriesConfig, "drawsAllowed">,
  scores: [number | null, number | null],
): 0 | 1 | "draw" | "tie" | null {
  if (!ranksByScore(direction) || scores.some((s) => s === null)) return null;
  const places = orderByScore(
    scores.map((score, i) => ({ id: String(i), score })),
    direction,
  );
  const [a, b] = [places.get("0"), places.get("1")];
  if (a === b) return config.drawsAllowed ? "draw" : "tie";
  return a === 1 ? 0 : 1;
}

const optionalScore = z
  .union([z.literal(""), z.null(), z.undefined(), scoreSchema])
  .transform((value) =>
    value === "" || value === null || value === undefined ? null : value,
  );

const schema = z.object({
  sides: z
    .array(
      z.object({
        id: z.uuid({ error: "Choose the Match's Entrants." }),
        score: optionalScore,
      }),
      { error: "Choose the Match's Entrants." },
    )
    .length(2, { error: "A Head-to-head Match has exactly 2 players." }),
  winner: z.string().optional().default(""),
});

/**
 * The Match's two sides with their places (1 / 2, or 1 / 1 for a Draw)
 * and Scores. `winner` is a side's id, "draw", or blank to work it out
 * from the Scores.
 */
export function parseMatchInput(
  config: SeriesConfig,
  direction: ScoreDirection,
  raw: unknown,
): Parsed<MatchInput> {
  const result = schema.safeParse(raw);
  if (!result.success) return firstError(result);
  const { sides, winner } = result.data;
  const [a, b] = sides;
  if (a.id === b.id) {
    return { ok: false, error: "Each Entrant plays once." };
  }
  const refuse = (error: string): Parsed<MatchInput> => ({
    ok: false,
    error,
    fieldErrors: { winner: error },
  });

  let outcome: 0 | 1 | "draw";
  if (winner === "draw") {
    if (!config.drawsAllowed) return refuse(NO_DRAWS);
    outcome = "draw";
  } else if (winner === a.id || winner === b.id) {
    outcome = winner === a.id ? 0 : 1;
  } else if (winner !== "") {
    return refuse(CHOOSE_WINNER);
  } else {
    const computed = computedOutcome(direction, config, [a.score, b.score]);
    if (computed === "tie") return refuse(EQUAL_SCORES_PICK);
    if (computed === null) return refuse(CHOOSE_WINNER);
    outcome = computed;
  }
  const places: Record<0 | 1 | "draw", [number, number]> = {
    0: [1, 2],
    1: [2, 1],
    draw: [1, 1],
  };
  const [placeA, placeB] = places[outcome];
  return {
    ok: true,
    value: {
      players: [
        { id: a.id, place: placeA, score: a.score },
        { id: b.id, place: placeB, score: b.score },
      ],
    },
  };
}

/**
 * The side ids a Match request posts (`sides[].id`), read before the input
 * is parsed so the authorize step can check them. Anything else is
 * ignored; the parser owns the shape.
 */
export function postedMatchPlayerIds(input: unknown): string[] {
  if (typeof input !== "object" || input === null) return [];
  const sides = (input as Record<string, unknown>).sides;
  if (!Array.isArray(sides)) return [];
  return sides.flatMap((side) => {
    const id =
      typeof side === "object" && side !== null
        ? (side as Record<string, unknown>).id
        : null;
    return typeof id === "string" && id !== "" ? [id] : [];
  });
}

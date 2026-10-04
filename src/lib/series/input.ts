/**
 * Validation for logging or editing a Head-to-head Match: the two players
 * (Team or Participant ids, by scoring) and who won. Never throws; returns
 * the first error, worded for the person filling in the form.
 */
import { z } from "zod";

import { firstError } from "@/lib/logged-input";
import type { ResultPlayerFact } from "@/lib/logged-results";
import type { Parsed } from "@/lib/result";
import type { SeriesConfig } from "@/lib/series/config";

export type MatchInput = { players: ResultPlayerFact[] };

const uuid = (error: string) => z.uuid({ error });

/** A Match's two players and its outcome: player A won, B won, or a Draw. */
export function parseMatchInput(
  config: SeriesConfig,
  raw: Record<string, unknown>,
): Parsed<MatchInput> {
  const schema = z.object({
    playerA: uuid("Choose two different players."),
    playerB: uuid("Choose two different players."),
    outcome: z.enum(["a", "b", "draw"], { error: "Choose a winner." }),
  });
  const result = schema.safeParse(raw);
  if (!result.success) return firstError(result);

  const { playerA, playerB, outcome } = result.data;
  if (playerA === playerB) {
    return {
      ok: false,
      error: "Choose two different players.",
      fieldErrors: { playerB: "Choose two different players." },
    };
  }
  if (outcome === "draw" && !config.drawsAllowed) {
    const message = "Draws aren't allowed in this Competition.";
    return { ok: false, error: message, fieldErrors: { outcome: message } };
  }
  const places: Record<"a" | "b" | "draw", [number, number]> = {
    a: [1, 2],
    b: [2, 1],
    draw: [1, 1],
  };
  const [placeA, placeB] = places[outcome];
  return {
    ok: true,
    value: {
      players: [
        { id: playerA, place: placeA, score: null },
        { id: playerB, place: placeB, score: null },
      ],
    },
  };
}

/**
 * The player ids a Match request posts (`playerA`, `playerB`), read before
 * the input is parsed so the authorize step can check them. Anything else
 * is ignored; the parser owns the shape.
 */
export function postedMatchPlayerIds(input: unknown): string[] {
  if (typeof input !== "object" || input === null) return [];
  const raw = input as Record<string, unknown>;
  return [raw.playerA, raw.playerB].filter(
    (id): id is string => typeof id === "string" && id !== "",
  );
}

/**
 * Validation for the Games server actions' input. Never throws; each parser
 * returns the first error, worded for the person filling in the form.
 */
import { z } from "zod";

import type { GameFormat } from "@/lib/enums";
import {
  type BestScoreConfig,
  type GamesConfig,
  type GamesConfigFor,
  type HeadToHeadConfig,
} from "@/lib/games/config";
import type { Parsed } from "@/lib/result";

function firstError<T>(result: z.ZodSafeParseResult<T>): Parsed<never> & {
  ok: false;
} {
  const issue = result.error!.issues[0];
  const field = typeof issue.path[0] === "string" ? issue.path[0] : null;
  return {
    ok: false,
    error: issue.message,
    ...(field ? { fieldErrors: { [field]: issue.message } } : {}),
  };
}

export type GameInputPlayer = {
  id: string;
  place: number | null;
  score: number | null;
};

export type GameInput = { players: GameInputPlayer[] };

const uuid = (error: string) => z.uuid({ error });

function parseHeadToHeadInput(
  config: HeadToHeadConfig,
  raw: Record<string, unknown>,
): Parsed<GameInput> {
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

/** A score numeric(10,2): at most 8 integer digits and 2 decimal places. */
const scoreSchema = z
  .union([z.number(), z.string().trim()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (value === "" || Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Enter a score." });
      return z.NEVER;
    }
    return n;
  })
  .refine((n) => Math.abs(n) < 10 ** 8, { error: "That score is too large." })
  .refine((n) => Math.round(n * 100) / 100 === n, {
    error: "A score has at most 2 decimal places.",
  });

function parseBestScoreInput(
  _config: BestScoreConfig,
  raw: Record<string, unknown>,
): Parsed<GameInput> {
  const schema = z.object({
    player: uuid("Choose a player."),
    score: scoreSchema,
  });
  const result = schema.safeParse(raw);
  if (!result.success) return firstError(result);
  return {
    ok: true,
    value: {
      players: [
        { id: result.data.player, place: null, score: result.data.score },
      ],
    },
  };
}

/** A logged Game's players, per Games Format (CONTEXT.md). */
export function parseGameInput<T extends GameFormat>(
  gameFormat: T,
  config: GamesConfigFor<T>,
  raw: Record<string, unknown>,
): Parsed<GameInput> {
  if (gameFormat === "head-to-head") {
    return parseHeadToHeadInput(config as HeadToHeadConfig, raw);
  }
  return parseBestScoreInput(config as BestScoreConfig, raw);
}

export type GamesSettingsInput = {
  gameConfig: GamesConfig;
  entrantsOpen: boolean;
  loggingClosesAt: Date | null;
  selfEnroll: boolean;
  entrantLimit: number | null;
  enrollClosesAt: Date | null;
};

/**
 * The player ids a Game request posts for this Games Format, read before the
 * input is parsed so the authorize step can check the posted player set
 * (like `postedCompetitionId`): head-to-head's `playerA` and `playerB`,
 * best-score's `player`. Another Format's keys and anything else are
 * ignored; the parser owns the shape.
 */
export function postedGamePlayerIds(
  gameFormat: GameFormat,
  input: unknown,
): string[] {
  if (typeof input !== "object" || input === null) return [];
  const raw = input as Record<string, unknown>;
  const ids: unknown[] = [];
  if (gameFormat === "head-to-head") ids.push(raw.playerA, raw.playerB);
  if (gameFormat === "best-score") ids.push(raw.player);
  return ids.filter((id): id is string => typeof id === "string" && id !== "");
}

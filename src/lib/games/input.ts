/**
 * Validation for the Games server actions' input. Never throws; each parser
 * returns the first error, worded for the person filling in the form.
 */
import { z } from "zod";

import { GAME_TYPES, type GameType } from "@/lib/enums";
import {
  type BestScoreConfig,
  type GamesConfig,
  type GamesConfigFor,
  type HeadToHeadConfig,
  type RankedConfig,
  bestScoreConfigSchema,
  headToHeadConfigSchema,
  rankedConfigSchema,
} from "@/lib/games/config";
import {
  ENTRANT_LIMIT_TOO_LOW,
  closesAtOf,
  limitOf,
} from "@/lib/games/enroll-input";
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

/**
 * Raw shape for a ranked Game: `order`, an array of `{ id, place }`
 * (chosen over a bare id list so the caller can express ties directly).
 * Places are normalized to standard competition ranking (1, 1, 3) by their
 * relative order, not taken as already-correct.
 */
const rankedOrderSchema = z.object({
  order: z
    .array(
      z.object({
        id: uuid("List at least two players."),
        place: z.number({ error: "List at least two players." }).int().min(1),
      }),
    )
    .min(2, { error: "List at least two players." }),
});

function normalizeRanking(
  entries: { id: string; place: number }[],
): { id: string; place: number }[] {
  const sorted = [...entries].sort(
    (a, b) => a.place - b.place || a.id.localeCompare(b.id),
  );
  const out: { id: string; place: number }[] = [];
  let rank = 0;
  let prevInput: number | null = null;
  sorted.forEach((entry, i) => {
    if (entry.place !== prevInput) rank = i + 1;
    out.push({ id: entry.id, place: rank });
    prevInput = entry.place;
  });
  return out;
}

function parseRankedInput(
  _config: RankedConfig,
  raw: Record<string, unknown>,
): Parsed<GameInput> {
  const result = rankedOrderSchema.safeParse(raw);
  if (!result.success) return firstError(result);
  const { order } = result.data;
  const ids = new Set(order.map((o) => o.id));
  if (ids.size !== order.length) {
    return { ok: false, error: "List at least two players." };
  }
  const normalized = normalizeRanking(order);
  return {
    ok: true,
    value: {
      players: normalized.map((o) => ({
        id: o.id,
        place: o.place,
        score: null,
      })),
    },
  };
}

/** A logged Game's players, per Game Type (CONTEXT.md, Game Type). */
export function parseGameInput<T extends GameType>(
  gameType: T,
  config: GamesConfigFor<T>,
  raw: Record<string, unknown>,
): Parsed<GameInput> {
  if (gameType === "head-to-head") {
    return parseHeadToHeadInput(config as HeadToHeadConfig, raw);
  }
  if (gameType === "best-score") {
    return parseBestScoreInput(config as BestScoreConfig, raw);
  }
  return parseRankedInput(config as RankedConfig, raw);
}

export type GamesSettingsInput = {
  gameConfig: GamesConfig;
  entrantsOpen: boolean;
  loggingClosesAt: Date | null;
  selfEnroll: boolean;
  entrantLimit: number | null;
  enrollClosesAt: Date | null;
};

const BEST_OF_RAW = ["off", "3", "5", "7"] as const;

function parseGameConfig(
  gameType: GameType,
  raw: Record<string, unknown>,
): Parsed<GamesConfig> {
  if (gameType === "head-to-head") {
    const bestOfRaw = raw.bestOf ?? "off";
    const bestOfResult = z
      .enum(BEST_OF_RAW, { error: "Best of is off, 3, 5 or 7." })
      .safeParse(bestOfRaw);
    if (!bestOfResult.success) return firstError(bestOfResult);
    const bestOf =
      bestOfResult.data === "off"
        ? null
        : (Number(bestOfResult.data) as 3 | 5 | 7);
    const drawsAllowed =
      raw.drawsAllowed === true || raw.drawsAllowed === "true";
    const parsed = headToHeadConfigSchema.safeParse({ drawsAllowed, bestOf });
    if (!parsed.success) return firstError(parsed);
    return { ok: true, value: parsed.data };
  }
  if (gameType === "best-score") {
    const parsed = bestScoreConfigSchema.safeParse({
      count: raw.count,
      betterIs: raw.betterIs,
      unit: raw.unit ?? "",
    });
    if (!parsed.success) return firstError(parsed);
    return { ok: true, value: parsed.data };
  }
  const rawFinishPoints = raw.finishPoints;
  const finishPointsText =
    typeof rawFinishPoints === "string" ? rawFinishPoints.trim() : "";
  const finishPoints =
    finishPointsText === ""
      ? []
      : finishPointsText.split(/[\s,]+/).map((s) => Number(s));
  if (finishPoints.some((n) => Number.isNaN(n))) {
    const message = "Finish Points are numbers.";
    return {
      ok: false,
      error: message,
      fieldErrors: { finishPoints: message },
    };
  }
  const parsed = rankedConfigSchema.safeParse({ finishPoints });
  if (!parsed.success) return firstError(parsed);
  return { ok: true, value: parsed.data };
}

/** An optional close time (`closesAtOf`), refused with `error`. */
function parseOptionalDateTime(
  value: unknown,
  error: string,
): Parsed<Date | null> {
  const parsed = closesAtOf(value);
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, error };
}

/** An optional Entrant limit (`limitOf`), as the enroll switch reads it. */
function parseOptionalEntrantLimit(value: unknown): Parsed<number | null> {
  const parsed = limitOf(value);
  return parsed.ok
    ? { ok: true, value: parsed.value }
    : {
        ok: false,
        error: ENTRANT_LIMIT_TOO_LOW,
        fieldErrors: { entrantLimit: ENTRANT_LIMIT_TOO_LOW },
      };
}

/**
 * A `games` Competition's settings: its Game Type config (per the posted
 * `gameType`), Entrants open or fixed, the logging close time, and
 * self-enrollment.
 */
export function parseGamesSettingsInput(
  raw: Record<string, unknown>,
): Parsed<GamesSettingsInput> {
  const gameTypeResult = z
    .enum(GAME_TYPES, { error: "Choose a Game Type." })
    .safeParse(raw.gameType);
  if (!gameTypeResult.success) return firstError(gameTypeResult);
  const gameType = gameTypeResult.data;

  const gameConfig = parseGameConfig(gameType, raw);
  if (!gameConfig.ok) return gameConfig;

  const entrantsOpenResult = z
    .boolean({ error: "Choose whether Entrants are open." })
    .safeParse(raw.entrantsOpen);
  if (!entrantsOpenResult.success) return firstError(entrantsOpenResult);

  const loggingClosesAt = parseOptionalDateTime(
    raw.loggingClosesAt,
    "Enter a valid logging close time.",
  );
  if (!loggingClosesAt.ok) return loggingClosesAt;

  const selfEnrollResult = z
    .boolean({ error: "Choose whether Participants can enroll." })
    .safeParse(raw.selfEnroll);
  if (!selfEnrollResult.success) return firstError(selfEnrollResult);

  const entrantLimit = parseOptionalEntrantLimit(raw.entrantLimit);
  if (!entrantLimit.ok) return entrantLimit;

  const enrollClosesAt = parseOptionalDateTime(
    raw.enrollClosesAt,
    "Enter a valid enrollment close time.",
  );
  if (!enrollClosesAt.ok) return enrollClosesAt;

  return {
    ok: true,
    value: {
      gameConfig: gameConfig.value,
      entrantsOpen: entrantsOpenResult.data,
      loggingClosesAt: loggingClosesAt.value,
      selfEnroll: selfEnrollResult.data,
      entrantLimit: entrantLimit.value,
      enrollClosesAt: enrollClosesAt.value,
    },
  };
}

/**
 * The player ids a Game request posts for this Game Type, read before the
 * input is parsed so the authorize step can check the posted player set
 * (like `postedCompetitionId`): head-to-head's `playerA` and `playerB`,
 * best-score's `player`, ranked's `order[].id`. Another type's keys and
 * anything else are ignored; the parser owns the shape.
 */
export function postedGamePlayerIds(
  gameType: GameType,
  input: unknown,
): string[] {
  if (typeof input !== "object" || input === null) return [];
  const raw = input as Record<string, unknown>;
  const ids: unknown[] = [];
  if (gameType === "head-to-head") ids.push(raw.playerA, raw.playerB);
  if (gameType === "best-score") ids.push(raw.player);
  if (gameType === "ranked" && Array.isArray(raw.order)) {
    for (const entry of raw.order) {
      if (typeof entry === "object" && entry !== null) {
        ids.push((entry as { id?: unknown }).id);
      }
    }
  }
  return ids.filter((id): id is string => typeof id === "string" && id !== "");
}

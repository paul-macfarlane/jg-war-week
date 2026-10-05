/**
 * The zod rule for a League's config (`config.ts`), for the settings save
 * and the seed format. Kept apart from `config.ts` so the client-reachable
 * rules never pull zod in.
 */
import { z } from "zod";

import {
  LEAGUE_MAX_ROUNDS,
  LEAGUE_PAIRINGS,
  type LeagueConfig,
} from "@/lib/league/config";

export const leagueConfigSchema = z
  .strictObject({
    pairing: z.enum(LEAGUE_PAIRINGS, {
      error: "Choose Round robin or Swiss.",
    }),
    rounds: z
      .number({ error: "Rounds is a whole number, or blank." })
      .int({ error: "Rounds is a whole number, or blank." })
      .min(1, { error: "A League plays at least 1 round." })
      .max(LEAGUE_MAX_ROUNDS, {
        error: `A League plays at most ${LEAGUE_MAX_ROUNDS} rounds.`,
      })
      .nullable(),
  })
  .refine((config) => config.pairing === "swiss" || config.rounds === null, {
    error: "Only a Swiss League sets its rounds.",
    path: ["rounds"],
  }) satisfies z.ZodType<LeagueConfig>;

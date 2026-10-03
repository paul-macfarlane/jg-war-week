/**
 * Whether logging is open in a Head-to-head or Best score Competition for a Participant: the
 * logging close time and a decided Best of (ADR 0006). Pure; the queries
 * load the Competition and its Games and pass them here with the time.
 * Kept apart from `log-rule.ts` because the Best of count pulls in the
 * leaderboard, which `src/lib/access.ts` must not.
 */
import type { HeadToHeadConfig } from "@/lib/games/config";
import { type GameFact, bestOfWinner } from "@/lib/games/leaderboard";

export type LoggingState = {
  loggingOpen: boolean;
  bestOfDecided: boolean;
  /** The decided Best of's winner (a Team or Participant id), or null. */
  winnerId: string | null;
};

/**
 * Logging is closed for a Participant from the close time on (at the
 * instant, like enrollment) and once a Best of is decided. `bestOf` is the
 * head-to-head config when Best of is on, else null.
 */
export function loggingStateOf({
  loggingClosesAt,
  bestOf,
  games,
  now,
}: {
  loggingClosesAt: Date | null;
  bestOf: HeadToHeadConfig | null;
  games: GameFact[];
  now: Date;
}): LoggingState {
  const winnerId = bestOf ? bestOfWinner(bestOf, games) : null;
  const bestOfDecided = winnerId !== null;
  const pastClose =
    loggingClosesAt !== null && now.getTime() >= loggingClosesAt.getTime();
  return { loggingOpen: !pastClose && !bestOfDecided, bestOfDecided, winnerId };
}

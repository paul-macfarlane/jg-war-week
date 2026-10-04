import type { DiscretionaryLedgerEntry } from "@/lib/discretionary-points";

export type DiscretionaryPointsResult = {
  edition: string;
  discretionaryPoints: {
    target: string;
    points: number;
    reason: string;
    /** ISO time the entry was given. */
    enteredAt: string;
  }[];
};

/**
 * Serializes a War Week's Discretionary points (points with no Competition
 * behind them), newest first, into the `get_discretionary_points` MCP tool
 * payload: who got them, how many, why and when. Never the Organizer's email.
 */
export function toDiscretionaryPointsResult(
  edition: string,
  entries: DiscretionaryLedgerEntry[],
): DiscretionaryPointsResult {
  return {
    edition,
    discretionaryPoints: entries.map(
      ({ target, points, reason, enteredAt }) => ({
        target,
        points,
        reason,
        enteredAt: enteredAt.toISOString(),
      }),
    ),
  };
}

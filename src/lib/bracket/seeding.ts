import type { Standings } from "@/lib/standings";

/**
 * Random Seed Positions (1…N) for the Entrants, by a Fisher–Yates shuffle
 * using `rng` (a Math.random-like source, injectable for tests).
 */
export function shuffleSeedPositions(
  entrantIds: string[],
  rng: () => number,
): { entrantId: string; seedPosition: number }[] {
  const shuffled = [...entrantIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((entrantId, i) => ({ entrantId, seedPosition: i + 1 }));
}

/** An Entrant as seeding by Standings needs it: which Team or Participant it is. */
export type StandingsSeedEntrant = {
  id: string;
  teamId: string | null;
  participantId: string | null;
};

/**
 * Seed Positions (1…N) ordered by the Entrants' rank in the Team Standings
 * (a team Competition) or individual Standings (an individual one), best
 * rank first. Entrants sharing a rank — ties, and every Entrant with no
 * Points Entries, who all tie at zero — are shuffled among themselves with
 * `rng` (Fisher–Yates, `shuffleSeedPositions`); an Entrant with no matching
 * Team or Participant row in the Standings goes last, shuffled the same way.
 */
export function standingsSeedPositions(
  entrants: StandingsSeedEntrant[],
  standings: Standings,
  scoring: "team" | "individual",
  rng: () => number,
): { entrantId: string; seedPosition: number }[] {
  const rows = scoring === "team" ? standings.team : standings.individual;
  const rankById = new Map(rows.map((row) => [row.id, row.rank]));
  const keyOf = (entrant: StandingsSeedEntrant) =>
    scoring === "team" ? entrant.teamId : entrant.participantId;

  const byRank = new Map<number, string[]>();
  const missing: string[] = [];
  for (const entrant of entrants) {
    const key = keyOf(entrant);
    const rank = key !== null ? rankById.get(key) : undefined;
    if (rank === undefined) {
      missing.push(entrant.id);
      continue;
    }
    const group = byRank.get(rank);
    if (group) group.push(entrant.id);
    else byRank.set(rank, [entrant.id]);
  }

  const ordered = [...byRank.keys()]
    .sort((a, b) => a - b)
    .flatMap((rank) =>
      shuffleSeedPositions(byRank.get(rank)!, rng).map((p) => p.entrantId),
    );
  ordered.push(...shuffleSeedPositions(missing, rng).map((p) => p.entrantId));

  return ordered.map((entrantId, i) => ({ entrantId, seedPosition: i + 1 }));
}

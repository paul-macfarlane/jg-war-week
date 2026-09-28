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
 * Seed Positions (1…N) ordered by the Entrants' total in the Team Standings
 * (a team Competition) or individual Standings (an individual one), highest
 * total first. Entrants sharing a total — ties — are shuffled among
 * themselves with `rng` (Fisher–Yates, `shuffleSeedPositions`). The
 * individual Standings list only Participants with a Points Entry, so a
 * Participant Entrant with none isn't "missing": it scores 0, tying with any
 * row whose total is also 0. A Team Standing lists every Team, so a Team
 * Entrant missing here means the Team itself is gone; that (and a genuinely
 * unmatched Participant) goes last, shuffled the same way.
 */
export function standingsSeedPositions(
  entrants: StandingsSeedEntrant[],
  standings: Standings,
  scoring: "team" | "individual",
  rng: () => number,
): { entrantId: string; seedPosition: number }[] {
  const rows = scoring === "team" ? standings.team : standings.individual;
  const totalById = new Map(rows.map((row) => [row.id, row.total]));
  const keyOf = (entrant: StandingsSeedEntrant) =>
    scoring === "team" ? entrant.teamId : entrant.participantId;

  const byTotal = new Map<number, string[]>();
  const missing: string[] = [];
  for (const entrant of entrants) {
    const key = keyOf(entrant);
    const total = key !== null ? totalById.get(key) : undefined;
    const zeroed =
      total === undefined && scoring === "individual" && key !== null;
    if (total === undefined && !zeroed) {
      missing.push(entrant.id);
      continue;
    }
    const group = byTotal.get(zeroed ? 0 : total!);
    if (group) group.push(entrant.id);
    else byTotal.set(zeroed ? 0 : total!, [entrant.id]);
  }

  const ordered = [...byTotal.keys()]
    .sort((a, b) => b - a)
    .flatMap((total) =>
      shuffleSeedPositions(byTotal.get(total)!, rng).map((p) => p.entrantId),
    );
  ordered.push(...shuffleSeedPositions(missing, rng).map((p) => p.entrantId));

  return ordered.map((entrantId, i) => ({ entrantId, seedPosition: i + 1 }));
}

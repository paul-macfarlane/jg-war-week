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

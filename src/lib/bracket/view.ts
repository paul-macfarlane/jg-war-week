/**
 * Display helpers for a Bracket: Round and Heat names, Rounds in order, and
 * the Heat an Entrant plays next. Pure, like the engine.
 */
import { isBye, isDecided } from "@/lib/bracket/engine";
import type { Bracket, Format, Heat } from "@/lib/bracket/types";

export type { Format } from "@/lib/bracket/types";

const FORMAT_LABELS: Record<Format, string> = {
  points: "Points",
  "single-elimination": "Single elimination",
  heats: "Heats",
};

/** A Format as Organizers read it. */
export function formatLabel(format: Format): string {
  return FORMAT_LABELS[format];
}

/** "Final", "Semifinal", or "Round N", by distance from the final Round. */
export function roundName(round: number, finalRound: number): string {
  if (round === finalRound) return "Final";
  if (round === finalRound - 1) return "Semifinal";
  return `Round ${round}`;
}

/** "Final", "Semifinal 2", or "Round 1 Heat 4". */
export function heatName(
  heat: Pick<Heat, "round" | "position">,
  finalRound: number,
): string {
  if (heat.round === finalRound) return "Final";
  if (heat.round === finalRound - 1) return `Semifinal ${heat.position}`;
  return `Round ${heat.round} Heat ${heat.position}`;
}

/** The final's Round number; 0 before Generate. */
export function finalRoundOf(bracket: Bracket): number {
  return bracket.heats.reduce((max, h) => Math.max(max, h.round), 0);
}

export type BracketRound = { round: number; name: string; heats: Heat[] };

/** The Bracket's Rounds, first to final, each with its Heats top to bottom. */
export function groupRounds(bracket: Bracket): BracketRound[] {
  const finalRound = finalRoundOf(bracket);
  const rounds: BracketRound[] = [];
  for (let round = 1; round <= finalRound; round++) {
    rounds.push({
      round,
      name: roundName(round, finalRound),
      heats: bracket.heats
        .filter((h) => h.round === round)
        .sort((a, b) => a.position - b.position),
    });
  }
  return rounds;
}

export type NextHeat = {
  heat: Heat;
  /** The other Entrant, or null while the Heat waits for one. */
  opponentId: string | null;
  /** The Heat whose winner fills the empty slot, while there is one. */
  waitingFor: Heat | null;
};

/**
 * The unplayed Heat an Entrant is in, with the opponent or the Heat still
 * to decide one. Null when they're out, the Bracket is over, or they aren't
 * an Entrant.
 */
export function nextHeatFor(
  bracket: Bracket,
  entrantId: string,
): NextHeat | null {
  const heat = bracket.heats.find(
    (h) =>
      !isDecided(h) &&
      !isBye(h) &&
      h.slots.some((s) => s.entrantId === entrantId),
  );
  if (!heat) return null;
  const emptySlot = heat.slots.findIndex((s) => s.entrantId === null);
  const opponent = heat.slots.find(
    (s) => s.entrantId !== null && s.entrantId !== entrantId,
  );
  return {
    heat,
    opponentId: opponent?.entrantId ?? null,
    waitingFor:
      emptySlot === -1
        ? null
        : (bracket.heats.find(
            (h) =>
              h.winnerTo?.heatId === heat.id && h.winnerTo.slot === emptySlot,
          ) ?? null),
  };
}

/**
 * Your Entrant under the You rules: the Participant themselves in an
 * individual Competition, their Team in a team one.
 */
export function entrantForYou(
  entrants: {
    id: string;
    teamId: string | null;
    participantId: string | null;
  }[],
  you: { participantId: string; teamId: string | null } | null,
  scoring: "team" | "individual",
): string | null {
  if (!you) return null;
  const found =
    scoring === "team"
      ? you.teamId && entrants.find((e) => e.teamId === you.teamId)
      : entrants.find((e) => e.participantId === you.participantId);
  return found ? found.id : null;
}

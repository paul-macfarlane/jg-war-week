/**
 * Display helpers for a Bracket: Round and Heat names, Rounds in order, and
 * the Heat an Entrant plays next. Pure, like the engine.
 */
import { heatsConfig } from "@/lib/bracket/config";
import { isBye } from "@/lib/bracket/formats";
import { isDecided } from "@/lib/bracket/heat-status";
import type { Bracket, Format, Heat } from "@/lib/bracket/types";

export type { Format } from "@/lib/bracket/types";
export { isDecided };

const FORMAT_LABELS: Record<Format, string> = {
  points: "Points",
  "single-elimination": "Single elimination",
  heats: "Heats",
};

/** A Format as Organizers read it. */
export function formatLabel(format: Format): string {
  return FORMAT_LABELS[format];
}

/** The final's Round number; 0 before Generate. */
export function finalRoundOf(bracket: Bracket): number {
  return bracket.heats.reduce((max, h) => Math.max(max, h.round), 0);
}

/** Whether `round` is the one before the Final of a single-elimination Bracket. */
function isSemifinal(bracket: Bracket, round: number): boolean {
  return (
    bracket.format === "single-elimination" &&
    round === finalRoundOf(bracket) - 1
  );
}

/**
 * "Final", "Round N", or (single elimination only) "Semifinal", by distance
 * from the final Round.
 */
export function roundName(bracket: Bracket, round: number): string {
  if (round === finalRoundOf(bracket)) return "Final";
  if (isSemifinal(bracket, round)) return "Semifinal";
  return `Round ${round}`;
}

/** "Final", "Round 1 Heat 4", or (single elimination only) "Semifinal 2". */
export function heatName(
  bracket: Bracket,
  heat: Pick<Heat, "round" | "position">,
): string {
  if (heat.round === finalRoundOf(bracket)) return "Final";
  if (isSemifinal(bracket, heat.round)) return `Semifinal ${heat.position}`;
  return `Round ${heat.round} Heat ${heat.position}`;
}

export type BracketRound = { round: number; name: string; heats: Heat[] };

/** The Bracket's Rounds, first to final, each with its Heats top to bottom. */
export function groupRounds(bracket: Bracket): BracketRound[] {
  const finalRound = finalRoundOf(bracket);
  const rounds: BracketRound[] = [];
  for (let round = 1; round <= finalRound; round++) {
    rounds.push({
      round,
      name: roundName(bracket, round),
      heats: bracket.heats
        .filter((h) => h.round === round)
        .sort((a, b) => a.position - b.position),
    });
  }
  return rounds;
}

export type NextHeat =
  | {
      kind: "heat";
      heat: Heat;
      /** The other Entrants already in the Heat. */
      opponentIds: string[];
      /**
       * Single elimination: the Heat whose winner fills the empty slot,
       * while there is one.
       */
      waitingFor: Heat | null;
    }
  | {
      /** Through to `round` of a Heats Bracket, which isn't filled yet. */
      kind: "advanced";
      round: number;
    };

/**
 * What's next for an Entrant: the unplayed Heat they're in, with their
 * opponents (or, in single elimination, the Heat still to decide one); or,
 * in a Heats Bracket, the Round they've advanced to while the rest of their
 * Round finishes. Null when they're out, the Bracket is over, or they
 * aren't an Entrant.
 */
export function nextHeatFor(
  bracket: Bracket,
  entrantId: string,
): NextHeat | null {
  const inHeat = (h: Heat) => h.slots.some((s) => s.entrantId === entrantId);
  const heat = bracket.heats.find(
    (h) => !isDecided(h) && !isBye(bracket, h) && inHeat(h),
  );
  if (heat) {
    const emptySlot = heat.slots.findIndex((s) => s.entrantId === null);
    return {
      kind: "heat",
      heat,
      opponentIds: heat.slots
        .map((s) => s.entrantId)
        .filter((id): id is string => id !== null && id !== entrantId),
      waitingFor:
        emptySlot === -1
          ? null
          : (bracket.heats.find(
              (h) =>
                h.winnerTo?.heatId === heat.id && h.winnerTo.slot === emptySlot,
            ) ?? null),
    };
  }
  if (bracket.format !== "heats") return null;
  // Their latest Heat is decided: did they finish in an advancing place?
  const last = bracket.heats
    .filter(inHeat)
    .reduce<Heat | null>((a, h) => (a && a.round > h.round ? a : h), null);
  if (!last || last.round >= finalRoundOf(bracket)) return null;
  const { advancePerHeat } = heatsConfig(bracket.config);
  const place = last.slots.find((s) => s.entrantId === entrantId)?.place;
  if (place == null || place > advancePerHeat) return null;
  return { kind: "advanced", round: last.round + 1 };
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

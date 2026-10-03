/**
 * The tree view of a Bracket: its Rounds as columns, first to final, each
 * Heat's slots as they read in the tree, and (single elimination) the
 * connector from each Heat to the slot its winner fills. Pure, like the
 * engine; `src/components/bracket-tree.tsx` draws it.
 */
import { heatsConfig } from "@/lib/bracket/config";
import { isBye } from "@/lib/bracket/formats";
import type { Bracket, BracketFormat, Heat } from "@/lib/bracket/types";
import {
  finalRoundOf,
  groupRounds,
  heatName,
  isDecided,
  roundName,
} from "@/lib/bracket/view";

/** One line of a Heat in the tree. */
export type TreeSlot =
  | {
      kind: "entrant";
      entrantId: string;
      /** The finishing place once the Heat is decided; null before. */
      place: number | null;
      score: string | null;
      forfeited: boolean;
      /**
       * Through to the next Round (a bye's Entrant too), or, in the Final,
       * the winner: the tree highlights it.
       */
      advances: boolean;
    }
  /** Single elimination: the empty side of a first-Round bye. */
  | { kind: "bye" }
  /**
   * Waiting for an Entrant: the feeding Heat's name (single elimination),
   * or the previous Round's (a Heats Round not filled yet, shown as one
   * line for the whole Heat).
   */
  | { kind: "waiting"; waitingFor: string };

export type TreeHeat = {
  id: string;
  name: string;
  round: number;
  position: number;
  decided: boolean;
  /** Never played: its Entrants advance as they are. */
  bye: boolean;
  /**
   * Single elimination: in slot order, so connectors meet the right slot.
   * Heats: by finishing place once decided.
   */
  slots: TreeSlot[];
};

export type TreeRound = { round: number; name: string; heats: TreeHeat[] };

/** A single-elimination Heat's winner goes to `toSlot` of `toHeatId`. */
export type TreeConnector = {
  fromHeatId: string;
  toHeatId: string;
  toSlot: number;
};

export type BracketTree = {
  format: BracketFormat;
  rounds: TreeRound[];
  /** Single elimination only; Heats Brackets advance by place, not a line. */
  connectors: TreeConnector[];
};

/** How many of a decided Heat's places go through (the Final: 1, the winner). */
export function advancingPlaces(bracket: Bracket, heat: Heat): number {
  if (bracket.format === "single-elimination") return 1;
  if (heat.round >= finalRoundOf(bracket)) return 1;
  return heatsConfig(bracket.config).advancePerHeat;
}

/** Whether `place` is among the places that go through from `heat`. */
export function advancesAtPlace(
  bracket: Bracket,
  heat: Heat,
  place: number,
): boolean {
  return place <= advancingPlaces(bracket, heat);
}

/** Whether a slot at `place` in a decided Heat goes through: the one rule. */
export function advancesFromPlace(
  bracket: Bracket,
  heat: Heat,
  place: number | null,
): boolean {
  return (
    isDecided(heat) && place !== null && advancesAtPlace(bracket, heat, place)
  );
}

function treeSlots(bracket: Bracket, heat: Heat, bye: boolean): TreeSlot[] {
  if (
    bracket.format === "heats" &&
    heat.slots.every((s) => s.entrantId === null)
  ) {
    return [
      { kind: "waiting", waitingFor: roundName(bracket, heat.round - 1) },
    ];
  }
  const decided = isDecided(heat);
  const slots: TreeSlot[] = heat.slots.map((slot, i) => {
    if (slot.entrantId === null) {
      if (bye) return { kind: "bye" };
      const feeder = bracket.heats.find(
        (h) => h.winnerTo?.heatId === heat.id && h.winnerTo.slot === i,
      );
      return {
        kind: "waiting",
        waitingFor: feeder ? heatName(bracket, feeder) : "an Entrant",
      };
    }
    return {
      kind: "entrant",
      entrantId: slot.entrantId,
      place: slot.place,
      score: slot.score,
      forfeited: slot.forfeited,
      advances: advancesFromPlace(bracket, heat, slot.place),
    };
  });
  if (bracket.format === "heats" && decided) {
    const placeOf = (s: TreeSlot) =>
      s.kind === "entrant" ? (s.place ?? Infinity) : Infinity;
    slots.sort((a, b) => placeOf(a) - placeOf(b));
  }
  return slots;
}

/** The Bracket as a tree: Rounds, their Heats' slots, and connectors. */
export function bracketTree(bracket: Bracket): BracketTree {
  const rounds = groupRounds(bracket).map((round) => ({
    round: round.round,
    name: round.name,
    heats: round.heats.map((heat) => {
      const bye = isBye(bracket, heat);
      return {
        id: heat.id,
        name: heatName(bracket, heat),
        round: heat.round,
        position: heat.position,
        decided: isDecided(heat),
        bye,
        slots: treeSlots(bracket, heat, bye),
      };
    }),
  }));
  const connectors =
    bracket.format === "single-elimination"
      ? groupRounds(bracket).flatMap((round) =>
          round.heats.flatMap((heat) =>
            heat.winnerTo
              ? [
                  {
                    fromHeatId: heat.id,
                    toHeatId: heat.winnerTo.heatId,
                    toSlot: heat.winnerTo.slot,
                  },
                ]
              : [],
          ),
        )
      : [];
  return { format: bracket.format, rounds, connectors };
}

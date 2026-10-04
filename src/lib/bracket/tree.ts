/**
 * The tree view of a Bracket: its Rounds as columns, first to final, each
 * Match's slots as they read in the tree, and (head-to-head) the connector
 * from each Match to the slot its winner fills. Pure, like the engine;
 * `src/components/bracket-tree.tsx` draws it.
 */
import { isHeadToHead } from "@/lib/bracket/config";
import { finalMatchOf } from "@/lib/bracket/final";
import { isBye } from "@/lib/bracket/formats";
import type { Bracket, Match } from "@/lib/bracket/types";
import {
  groupRounds,
  isDecided,
  matchName,
  roundName,
} from "@/lib/bracket/view";

/** One line of a Match in the tree. */
export type TreeSlot =
  | {
      kind: "entrant";
      entrantId: string;
      /** The finishing place once the Match is decided; null before. */
      place: number | null;
      score: string | null;
      /**
       * Through to the next Round (a bye's Entrant too), or, in the final,
       * the winner, or, in the 3rd place Match, who takes 3rd: the tree
       * highlights it.
       */
      advances: boolean;
    }
  /** Head-to-head: the empty side of a first-Round bye. */
  | { kind: "bye" }
  /**
   * Waiting for an Entrant: the feeding Match's name (head-to-head), or the
   * previous Round's (a Round of more than 2 per Match not filled yet, shown
   * as one line for the whole Match).
   */
  | { kind: "waiting"; waitingFor: string };

export type TreeMatch = {
  id: string;
  name: string;
  round: number;
  position: number;
  decided: boolean;
  /** Never played: its Entrants advance as they are. */
  bye: boolean;
  /** The final (`finalMatchOf`): its winner wins the Bracket. */
  final: boolean;
  /** The 3rd place Match, beside the final and drawn secondary to it. */
  thirdPlace: boolean;
  /**
   * Head-to-head: in slot order, so connectors meet the right slot. More
   * than 2 per Match: by finishing place once decided.
   */
  slots: TreeSlot[];
};

export type TreeRound = { round: number; name: string; matches: TreeMatch[] };

/** A head-to-head Match's winner goes to `toSlot` of `toMatchId`. */
export type TreeConnector = {
  fromMatchId: string;
  toMatchId: string;
  toSlot: number;
};

export type BracketTree = {
  /** Head-to-head Brackets draw winner lines; others advance by place. */
  headToHead: boolean;
  rounds: TreeRound[];
  /** Head-to-head only; other Brackets advance by place, not a line. */
  connectors: TreeConnector[];
};

/**
 * How many of a decided Match's places go through: head-to-head, 1 (in the
 * 3rd place Match, who takes 3rd); the final, 1, the winner.
 */
export function advancingPlaces(bracket: Bracket, match: Match): number {
  if (isHeadToHead(bracket.config)) return 1;
  if (match.id === finalMatchOf(bracket)?.id) return 1;
  return bracket.config.advancePerHeat;
}

/** Whether `place` is among the places that go through from `match`. */
export function advancesAtPlace(
  bracket: Bracket,
  match: Match,
  place: number,
): boolean {
  return place <= advancingPlaces(bracket, match);
}

/** Whether a slot at `place` in a decided Match goes through: the one rule. */
export function advancesFromPlace(
  bracket: Bracket,
  match: Match,
  place: number | null,
): boolean {
  return (
    isDecided(match) && place !== null && advancesAtPlace(bracket, match, place)
  );
}

function treeSlots(bracket: Bracket, match: Match, bye: boolean): TreeSlot[] {
  if (
    !isHeadToHead(bracket.config) &&
    match.slots.every((s) => s.entrantId === null)
  ) {
    return [
      { kind: "waiting", waitingFor: roundName(bracket, match.round - 1) },
    ];
  }
  const decided = isDecided(match);
  const slots: TreeSlot[] = match.slots.map((slot, i) => {
    if (slot.entrantId === null) {
      if (bye) return { kind: "bye" };
      const feeder = bracket.matches.find(
        (h) => h.winnerTo?.matchId === match.id && h.winnerTo.slot === i,
      );
      const loserFeeder = bracket.matches.find(
        (h) => h.loserTo?.matchId === match.id && h.loserTo.slot === i,
      );
      return {
        kind: "waiting",
        waitingFor: feeder
          ? matchName(bracket, feeder)
          : loserFeeder
            ? `${matchName(bracket, loserFeeder)}'s loser`
            : "an Entrant",
      };
    }
    return {
      kind: "entrant",
      entrantId: slot.entrantId,
      place: slot.place,
      score: slot.score,
      advances: advancesFromPlace(bracket, match, slot.place),
    };
  });
  if (!isHeadToHead(bracket.config) && decided) {
    const placeOf = (s: TreeSlot) =>
      s.kind === "entrant" ? (s.place ?? Infinity) : Infinity;
    slots.sort((a, b) => placeOf(a) - placeOf(b));
  }
  return slots;
}

/** The Bracket as a tree: Rounds, their Matches' slots, and connectors. */
export function bracketTree(bracket: Bracket): BracketTree {
  const final = finalMatchOf(bracket);
  const rounds = groupRounds(bracket).map((round) => ({
    round: round.round,
    name: round.name,
    matches: round.matches.map((match) => {
      const bye = isBye(bracket, match);
      return {
        id: match.id,
        name: matchName(bracket, match),
        round: match.round,
        position: match.position,
        decided: isDecided(match),
        bye,
        final: match.id === final?.id,
        thirdPlace: match.thirdPlace,
        slots: treeSlots(bracket, match, bye),
      };
    }),
  }));
  const connectors = isHeadToHead(bracket.config)
    ? groupRounds(bracket).flatMap((round) =>
        round.matches.flatMap((match) =>
          match.winnerTo
            ? [
                {
                  fromMatchId: match.id,
                  toMatchId: match.winnerTo.matchId,
                  toSlot: match.winnerTo.slot,
                },
              ]
            : [],
        ),
      )
    : [];
  return { headToHead: isHeadToHead(bracket.config), rounds, connectors };
}

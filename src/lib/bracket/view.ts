/**
 * Display helpers for a Bracket: Round and Heat names, Rounds in order, and
 * the Heat an Entrant plays next. Pure, like the engine.
 */
import { isHeadToHead } from "@/lib/bracket/config";
import { finalRoundOf } from "@/lib/bracket/final";
import { isBye } from "@/lib/bracket/formats";
import { isDecided } from "@/lib/bracket/heat-status";
import type { Bracket, BracketFormat, Format, Heat } from "@/lib/bracket/types";
import { WAR_WEEK_TIME_ZONE } from "@/lib/schedule";

export type { Format } from "@/lib/bracket/types";
export { finalRoundOf, isDecided };

const FORMAT_LABELS: Record<Format, string> = {
  placement: "Placement",
  bracket: "Bracket",
  "head-to-head": "Head-to-head",
  "best-score": "Best score",
  participation: "Participation",
};

/** A Format as Organizers read it. */
export function formatLabel(format: Format): string {
  return FORMAT_LABELS[format];
}

/** Whether a Format is the Bracket Format. */
export function isBracketFormat(
  format: string | null | undefined,
): format is BracketFormat {
  return format === "bracket";
}

/** Every Format that runs as a Bracket. */
export const BRACKET_FORMATS: BracketFormat[] = ["bracket"];

/** The 3rd place Match's name, beside the final. */
export const THIRD_PLACE_MATCH = "3rd place Match";

/**
 * "Final", "Round N", or (head-to-head only) "Semifinal", by distance
 * from the final Round; with a `position`, "Round N Heat P" or
 * "Semifinal P" instead of the bare Round name. The 3rd place Match is
 * "3rd place Match".
 */
export function matchNameAt({
  headToHead,
  finalRound,
  round,
  position,
  thirdPlace = false,
}: {
  headToHead: boolean;
  finalRound: number;
  round: number;
  position?: number;
  thirdPlace?: boolean;
}): string {
  if (thirdPlace) return THIRD_PLACE_MATCH;
  if (round === finalRound) return "Final";
  const isSemifinal = headToHead && round === finalRound - 1;
  if (isSemifinal) {
    return position === undefined ? "Semifinal" : `Semifinal ${position}`;
  }
  return position === undefined
    ? `Round ${round}`
    : `Round ${round} Match ${position}`;
}

/**
 * "Final", "Round N", or (head-to-head only) "Semifinal", by distance
 * from the final Round.
 */
export function roundName(bracket: Bracket, round: number): string {
  return matchNameAt({
    headToHead: isHeadToHead(bracket.config),
    finalRound: finalRoundOf(bracket),
    round,
  });
}

/**
 * "Final", "3rd place Match", "Round 1 Heat 4", or (head-to-head only)
 * "Semifinal 2".
 */
export function matchName(
  bracket: Bracket,
  heat: Pick<Heat, "round" | "position"> & { thirdPlace?: boolean },
): string {
  return matchNameAt({
    headToHead: isHeadToHead(bracket.config),
    finalRound: finalRoundOf(bracket),
    round: heat.round,
    position: heat.position,
    thirdPlace: heat.thirdPlace,
  });
}

/**
 * When a Heat's Result was recorded, like "Recorded Sun 7:05 PM ET": the
 * ET wall clock, whatever the viewer's timezone.
 */
export function formatRecordedAt(recordedAt: Date): string {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: WAR_WEEK_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(recordedAt);
  return `Recorded ${when} ET`;
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

export type NextMatch =
  | {
      kind: "heat";
      heat: Heat;
      /** The other Entrants already in the Match. */
      opponentIds: string[];
      /**
       * Single elimination: the Match whose Winner (or, for the 3rd place
       * Match, loser) fills the empty slot, while there is one.
       */
      waitingFor: Heat | null;
    }
  | {
      /** Through to `round` of a Heats Bracket, which isn't filled yet. */
      kind: "advanced";
      round: number;
    };

/**
 * What's next for an Entrant: the unplayed Match they're in, with their
 * opponents (or, in single elimination, the Match still to decide one); or,
 * in a Heats Bracket, the Round they've advanced to while the rest of their
 * Round finishes. Null when they're out, the Bracket is over, or they
 * aren't an Entrant.
 */
export function nextMatchFor(
  bracket: Bracket,
  entrantId: string,
): NextMatch | null {
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
                (h.winnerTo?.heatId === heat.id &&
                  h.winnerTo.slot === emptySlot) ||
                (h.loserTo?.heatId === heat.id && h.loserTo.slot === emptySlot),
            ) ?? null),
    };
  }
  if (isHeadToHead(bracket.config)) return null;
  // Their latest Heat is decided: did they finish in an advancing place?
  const last = bracket.heats
    .filter(inHeat)
    .reduce<Heat | null>((a, h) => (a && a.round > h.round ? a : h), null);
  if (!last || last.round >= finalRoundOf(bracket)) return null;
  const { advancePerHeat } = bracket.config;
  const place = last.slots.find((s) => s.entrantId === entrantId)?.place;
  if (place == null || place > advancePerHeat) return null;
  return { kind: "advanced", round: last.round + 1 };
}

/**
 * Your Entrant under the You rules: Your Squad's Entrant when it's entered;
 * none when the Entrants are Squads and Yours isn't one of them (Your Team
 * isn't entered as such); otherwise the Participant themselves in an
 * individual Competition, their Team in a team one.
 */
export function entrantForYou(
  entrants: {
    id: string;
    teamId: string | null;
    participantId: string | null;
    squadId?: string | null;
  }[],
  you: {
    participantId: string;
    teamId: string | null;
    squadId?: string | null;
  } | null,
  scoring: "team" | "individual",
): string | null {
  if (!you) return null;
  if (you.squadId) {
    const squad = entrants.find((e) => e.squadId === you.squadId);
    if (squad) return squad.id;
  }
  if (entrants.some((e) => e.squadId)) return null;
  const found =
    scoring === "team"
      ? you.teamId && entrants.find((e) => e.teamId === you.teamId)
      : entrants.find((e) => e.participantId === you.participantId);
  return found ? found.id : null;
}

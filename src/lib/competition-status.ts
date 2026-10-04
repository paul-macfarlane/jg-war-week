/**
 * A Competition's status on the Participant Competitions list (ticket 105):
 * Not started, Underway (a Bracket adds its Round in play), Closed, or
 * Done · Winner. Pure: the list query loads the facts.
 */
import { finalRoundOf } from "@/lib/bracket/final";
import { isBye } from "@/lib/bracket/formats";
import { isDecided } from "@/lib/bracket/heat-status";
import type { Bracket, Format } from "@/lib/bracket/types";
import type { COMPETITION_SCORINGS } from "@/lib/enums";

/** The Round a Bracket is playing, out of its Rounds; the last is the final. */
export type BracketRoundInPlay = { round: number; of: number };

/** What the status reads about a Competition. */
export type CompetitionStatusFacts = {
  format: Format;
  scoring: (typeof COMPETITION_SCORINGS)[number];
  /** Finalized (Placement, Bracket) or Closed (the others). */
  finalized: boolean;
  /** `hasResult` (`src/lib/competition-locks.ts`): the one definition. */
  hasResult: boolean;
  /** A generated Bracket's Round in play (`bracketRoundInPlay`); else null. */
  bracketRound: BracketRoundInPlay | null;
  /**
   * The 1st place's names (`finalWinners`, the rule Recent results uses);
   * more than one on a tie, none before Finalize or Close.
   */
  winners: string[];
};

export type CompetitionStatus =
  | { kind: "not-started"; label: "Not started"; detail: null }
  /** `detail` is a Bracket's Round: "Round 2 of 4" or "Final". */
  | { kind: "underway"; label: "Underway"; detail: string | null }
  | { kind: "closed"; label: "Closed"; detail: null }
  /** `detail` names the winner(s); null when no Placement Points named one. */
  | { kind: "done"; label: "Done"; detail: string | null };

/**
 * - Finalized or Closed with a 1st place: Done · Winner (every tied winner).
 *   An individual Participation Competition names none, so it is Closed.
 * - Closed Head-to-head, Best score or Participation without one: Closed. A
 *   Finalized Placement or Bracket without one is still Done.
 * - Else Underway once it has a result, Not started before.
 */
export function competitionStatus(
  facts: CompetitionStatusFacts,
): CompetitionStatus {
  if (facts.finalized) {
    const individualParticipation =
      facts.format === "participation" && facts.scoring === "individual";
    const winners = individualParticipation ? [] : facts.winners;
    if (winners.length > 0) {
      return {
        kind: "done",
        label: "Done",
        detail: `${winners.length > 1 ? "Winners" : "Winner"}: ${winners.join(", ")}`,
      };
    }
    return facts.format === "placement" || facts.format === "bracket"
      ? { kind: "done", label: "Done", detail: null }
      : { kind: "closed", label: "Closed", detail: null };
  }
  if (!facts.hasResult) {
    return { kind: "not-started", label: "Not started", detail: null };
  }
  const round = facts.bracketRound;
  return {
    kind: "underway",
    label: "Underway",
    detail: round
      ? round.round === round.of
        ? "Final"
        : `Round ${round.round} of ${round.of}`
      : null,
  };
}

/** "Underway · Round 2 of 4", "Done · Winner: Zion", "Not started". */
export function competitionStatusText(status: CompetitionStatus): string {
  return status.detail ? `${status.label} · ${status.detail}` : status.label;
}

/**
 * The first Round with a Heat still to play (a bye never is one), out of
 * the Bracket's Rounds; the final's Round once only the 3rd place Match, or
 * nothing, is left before Finalize. Null before Generate.
 */
export function bracketRoundInPlay(
  bracket: Bracket,
): BracketRoundInPlay | null {
  const of = finalRoundOf(bracket);
  if (of === 0) return null;
  const unplayed = bracket.heats.filter(
    (h) => !isDecided(h) && !isBye(bracket, h),
  );
  const round = Math.min(of, ...unplayed.map((h) => h.round));
  return { round, of };
}

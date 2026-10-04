/**
 * The pure Bracket model: no database, no framework. The mutations load a
 * Bracket from its rows, run one of the engine functions, and save the
 * result.
 */
import type { BracketConfig } from "@/lib/bracket/config";
import type { COMPETITION_FORMATS, LoggedFormat } from "@/lib/enums";

/** How a Competition is run; see CONTEXT.md. */
export type Format = (typeof COMPETITION_FORMATS)[number];

/**
 * The Format that runs as a Bracket, `bracket`: what's left once
 * `placement`, the logged Formats (a Head-to-head or Best score
 * Competition is decided by logged Matches or Attempts, never a Bracket)
 * and `participation` (decided by
 * who took part) are excluded.
 */
export type BracketFormat = Exclude<
  Format,
  "placement" | LoggedFormat | "participation"
>;

/** A Team or Participant entered in a Bracket, at its Seed Position. */
export type Entrant = { id: string; seedPosition: number; label: string };

export type MatchStatus = "pending" | "ready" | "played";

/** One place in a Match. An empty slot is waiting for an Entrant (or a bye). */
export type MatchSlot = {
  entrantId: string | null;
  /** The finishing place, 1…n (1 is the winner); null until decided. */
  place: number | null;
  score: string | null;
};

/** Where a Match's winner (or loser) goes: a later Match and its slot index. */
export type WinnerTo = { matchId: string; slot: number };

export type Match = {
  id: string;
  /**
   * 1 is the first Round; the last Round holds the final (and, beside it,
   * the 3rd place Match).
   */
  round: number;
  /** 1-based, top to bottom within the Round; the final is 1. */
  position: number;
  /** One per place in the Match: its length is the Match's slot count. */
  slots: MatchSlot[];
  winnerTo: WinnerTo | null;
  /** A semifinal with a 3rd place Match: where its loser goes. */
  loserTo: WinnerTo | null;
  /**
   * The 3rd place Match: in the final's Round, beside the final. The final
   * is the Match of the last Round that isn't this.
   */
  thirdPlace: boolean;
  status: MatchStatus;
  /**
   * When the Match's Result was last saved; null until it is played. The
   * engines never set it: the mutation stamps it when it saves a Result.
   */
  recordedAt: Date | null;
};

export type Bracket = {
  /** The Bracket's settings; never null. */
  config: BracketConfig;
  matches: Match[];
};

/**
 * A Match Result: every Entrant of the Match in finishing order, with optional
 * scores (a no-show just loses: it is last in the order).
 */
export type MatchResult = {
  order: string[];
  scores?: Record<string, string>;
};

export type Placing = { entrantId: string; place: number };

/**
 * What every Format's engine provides. Each function is pure: it takes a
 * Bracket and returns a new one (or a fact about it), never changing it.
 */
export type FormatEngine = {
  /** Why Generate is refused for this config and count, or null. */
  validateConfig(config: BracketConfig, entrantCount: number): string | null;
  /** Every Match of every Round; Match ids come from `newId`. */
  generate(
    config: BracketConfig,
    entrants: Entrant[],
    newId: (round: number, position: number) => string,
  ): Bracket;
  applyResult(bracket: Bracket, matchId: string, result: MatchResult): Bracket;
  /** The later Matches with a Match Result that this result would clear. */
  resetByResult(
    bracket: Bracket,
    matchId: string,
    result: MatchResult,
  ): string[];
  /** Whether the Match can take a Match Result now. */
  isRecordable(bracket: Bracket, matchId: string): boolean;
  /** Each Format's own rule for a Match that is never played. */
  isBye(bracket: Bracket, match: Match): boolean;
  /** Whether any Match has a Match Result; byes and empty Matches don't count. */
  hasResults(bracket: Bracket): boolean;
  isComplete(bracket: Bracket): boolean;
  /** The Entrant 1st in the final, or null while it is undecided. */
  winner(bracket: Bracket): string | null;
  finalPlacings(bracket: Bracket, entrants: Entrant[]): Placing[];
};

/** A refused engine operation; the message is shown to the Organizer. */
export class BracketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BracketError";
  }
}

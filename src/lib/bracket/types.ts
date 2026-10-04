/**
 * The pure Bracket model: no database, no framework. The mutations load a
 * Bracket from its rows, run one of the engine functions, and save the
 * result.
 */
import type { BracketConfig } from "@/lib/bracket/config";
import type { COMPETITION_FORMATS, GameFormat } from "@/lib/enums";

/** How a Competition is run; see CONTEXT.md. */
export type Format = (typeof COMPETITION_FORMATS)[number];

/**
 * The Format that runs as a Bracket, `bracket`: what's left once
 * `placement`, the Games Formats (a Head-to-head or Best score Competition
 * is decided by logged Games, never Heats) and `participation` (decided by
 * who took part) are excluded.
 */
export type BracketFormat = Exclude<
  Format,
  "placement" | GameFormat | "participation"
>;

/** A Team or Participant entered in a Bracket, at its Seed Position. */
export type Entrant = { id: string; seedPosition: number; label: string };

export type HeatStatus = "pending" | "ready" | "played";

/** One place in a Heat. An empty slot is waiting for an Entrant (or a bye). */
export type HeatSlot = {
  entrantId: string | null;
  /** The finishing place, 1…n (1 is the winner); null until decided. */
  place: number | null;
  score: string | null;
};

/** Where a Heat's winner (or loser) goes: a later Heat and its slot index. */
export type WinnerTo = { heatId: string; slot: number };

export type Heat = {
  id: string;
  /**
   * 1 is the first Round; the last Round holds the final (and, beside it,
   * the 3rd place game).
   */
  round: number;
  /** 1-based, top to bottom within the Round; the final is 1. */
  position: number;
  /** One per place in the Heat: its length is the Heat's slot count. */
  slots: HeatSlot[];
  winnerTo: WinnerTo | null;
  /** A semifinal with a 3rd place game: where its loser goes. */
  loserTo: WinnerTo | null;
  /**
   * The 3rd place game: in the final's Round, beside the final. The final
   * is the Heat of the last Round that isn't this.
   */
  thirdPlace: boolean;
  status: HeatStatus;
  /**
   * When the Heat's Result was last saved; null until it is played. The
   * engines never set it: the mutation stamps it when it saves a Result.
   */
  recordedAt: Date | null;
};

export type Bracket = {
  /** The Bracket's settings; never null. */
  config: BracketConfig;
  heats: Heat[];
};

/**
 * A Heat Result: every Entrant of the Heat in finishing order, with optional
 * scores (a no-show just loses: it is last in the order).
 */
export type HeatResult = {
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
  /** Every Heat of every Round; Heat ids come from `newId`. */
  generate(
    config: BracketConfig,
    entrants: Entrant[],
    newId: (round: number, position: number) => string,
  ): Bracket;
  applyResult(bracket: Bracket, heatId: string, result: HeatResult): Bracket;
  /** The later Heats with a Heat Result that this result would clear. */
  resetByResult(bracket: Bracket, heatId: string, result: HeatResult): string[];
  /** Whether the Heat can take a Heat Result now. */
  isRecordable(bracket: Bracket, heatId: string): boolean;
  /** Each Format's own rule for a Heat that is never played. */
  isBye(bracket: Bracket, heat: Heat): boolean;
  /** Whether any Heat has a Heat Result; byes and empty Heats don't count. */
  hasResults(bracket: Bracket): boolean;
  isComplete(bracket: Bracket): boolean;
  champion(bracket: Bracket): string | null;
  finalPlacings(bracket: Bracket, entrants: Entrant[]): Placing[];
};

/** A refused engine operation; the message is shown to the Organizer. */
export class BracketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BracketError";
  }
}

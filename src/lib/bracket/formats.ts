/**
 * The one place the Bracket's engine is chosen: each function hands the
 * Bracket (or, for `generate` and `validateConfig`, its config) to that
 * engine. Match size 2 with 1 advancing runs the single-elimination engine;
 * any other config runs the Matches engine. Nothing else picks one.
 */
import { type BracketConfig, isHeadToHead } from "@/lib/bracket/config";
import { singleElimination } from "@/lib/bracket/engine";
import { matches } from "@/lib/bracket/groups";
import {
  type Bracket,
  type Entrant,
  type FormatEngine,
  type Match,
  type MatchResult,
  type Placing,
} from "@/lib/bracket/types";

export function engineFor(config: BracketConfig): FormatEngine {
  return isHeadToHead(config) ? singleElimination : matches;
}

export function validateConfig(
  config: BracketConfig,
  entrantCount: number,
): string | null {
  return engineFor(config).validateConfig(config, entrantCount);
}

export function generate(
  config: BracketConfig,
  entrants: Entrant[],
  newId: (round: number, position: number) => string,
): Bracket {
  return engineFor(config).generate(config, entrants, newId);
}

export function applyResult(
  bracket: Bracket,
  matchId: string,
  result: MatchResult,
): Bracket {
  return engineFor(bracket.config).applyResult(bracket, matchId, result);
}

export function resetByResult(
  bracket: Bracket,
  matchId: string,
  result: MatchResult,
): string[] {
  return engineFor(bracket.config).resetByResult(bracket, matchId, result);
}

export function isRecordable(bracket: Bracket, matchId: string): boolean {
  return engineFor(bracket.config).isRecordable(bracket, matchId);
}

export function isBye(bracket: Bracket, match: Match): boolean {
  return engineFor(bracket.config).isBye(bracket, match);
}

export function hasResults(bracket: Bracket): boolean {
  return engineFor(bracket.config).hasResults(bracket);
}

export function isComplete(bracket: Bracket): boolean {
  return engineFor(bracket.config).isComplete(bracket);
}

export function bracketWinner(bracket: Bracket): string | null {
  return engineFor(bracket.config).winner(bracket);
}

export function finalPlacings(
  bracket: Bracket,
  entrants: Entrant[],
): Placing[] {
  return engineFor(bracket.config).finalPlacings(bracket, entrants);
}

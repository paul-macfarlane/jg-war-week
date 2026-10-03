/**
 * The one place the Bracket's engine is chosen: each function hands the
 * Bracket (or, for `generate` and `validateConfig`, its config) to that
 * engine. Heat size 2 with 1 advancing runs the single-elimination engine;
 * any other config runs the Heats engine. Nothing else picks one.
 */
import { type BracketConfig, isHeadToHead } from "@/lib/bracket/config";
import { singleElimination } from "@/lib/bracket/engine";
import { heats } from "@/lib/bracket/heats";
import {
  type Bracket,
  type Entrant,
  type FormatEngine,
  type Heat,
  type HeatResult,
  type Placing,
} from "@/lib/bracket/types";

export function engineFor(config: BracketConfig): FormatEngine {
  return isHeadToHead(config) ? singleElimination : heats;
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
  heatId: string,
  result: HeatResult,
): Bracket {
  return engineFor(bracket.config).applyResult(bracket, heatId, result);
}

export function resetByResult(
  bracket: Bracket,
  heatId: string,
  result: HeatResult,
): string[] {
  return engineFor(bracket.config).resetByResult(bracket, heatId, result);
}

export function isRecordable(bracket: Bracket, heatId: string): boolean {
  return engineFor(bracket.config).isRecordable(bracket, heatId);
}

export function isBye(bracket: Bracket, heat: Heat): boolean {
  return engineFor(bracket.config).isBye(bracket, heat);
}

export function hasResults(bracket: Bracket): boolean {
  return engineFor(bracket.config).hasResults(bracket);
}

export function isComplete(bracket: Bracket): boolean {
  return engineFor(bracket.config).isComplete(bracket);
}

export function champion(bracket: Bracket): string | null {
  return engineFor(bracket.config).champion(bracket);
}

export function finalPlacings(
  bracket: Bracket,
  entrants: Entrant[],
): Placing[] {
  return engineFor(bracket.config).finalPlacings(bracket, entrants);
}

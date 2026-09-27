/**
 * The one place Format-dependent Bracket behavior is chosen: each function
 * hands the Bracket (or, for `generate` and `validateConfig`, the Format) to
 * that Format's engine.
 */
import type { BracketConfig } from "@/lib/bracket/config";
import { singleElimination } from "@/lib/bracket/engine";
import {
  type Bracket,
  BracketError,
  type BracketFormat,
  type Entrant,
  type FormatEngine,
  type Heat,
  type HeatResult,
  type Placing,
} from "@/lib/bracket/types";

export function engineFor(format: BracketFormat): FormatEngine {
  switch (format) {
    case "single-elimination":
      return singleElimination;
    case "heats":
      // Coming in a later slice: the heats engine (`heats.ts`).
      throw new BracketError("Heats aren't built yet.");
  }
}

export function validateConfig(
  format: BracketFormat,
  config: BracketConfig,
  entrantCount: number,
): string | null {
  return engineFor(format).validateConfig(config, entrantCount);
}

export function generate(
  format: BracketFormat,
  config: BracketConfig,
  entrants: Entrant[],
  newId: (round: number, position: number) => string,
): Bracket {
  return engineFor(format).generate(config, entrants, newId);
}

export function applyResult(
  bracket: Bracket,
  heatId: string,
  result: HeatResult,
): Bracket {
  return engineFor(bracket.format).applyResult(bracket, heatId, result);
}

export function resetByResult(
  bracket: Bracket,
  heatId: string,
  result: HeatResult,
): string[] {
  return engineFor(bracket.format).resetByResult(bracket, heatId, result);
}

export function isRecordable(bracket: Bracket, heatId: string): boolean {
  return engineFor(bracket.format).isRecordable(bracket, heatId);
}

export function isBye(bracket: Bracket, heat: Heat): boolean {
  return engineFor(bracket.format).isBye(bracket, heat);
}

export function hasResults(bracket: Bracket): boolean {
  return engineFor(bracket.format).hasResults(bracket);
}

export function isComplete(bracket: Bracket): boolean {
  return engineFor(bracket.format).isComplete(bracket);
}

export function champion(bracket: Bracket): string | null {
  return engineFor(bracket.format).champion(bracket);
}

export function finalPlacings(
  bracket: Bracket,
  entrants: Entrant[],
): Placing[] {
  return engineFor(bracket.format).finalPlacings(bracket, entrants);
}

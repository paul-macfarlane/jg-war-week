import type { ScoreDirection } from "@/lib/enums";

/** A Score direction as the tools say it. */
const DIRECTIONS = {
  none: "none",
  higher: "higher wins",
  lower: "lower wins",
} as const satisfies Record<ScoreDirection, string>;

export type ScoreDirectionLabel = (typeof DIRECTIONS)[ScoreDirection];

export function scoreDirectionLabel(
  direction: ScoreDirection,
): ScoreDirectionLabel {
  return DIRECTIONS[direction];
}

/** The Score unit label, null when there is none. */
export function scoreUnitLabel(unit: string | null | undefined): string | null {
  return unit?.trim() ? unit.trim() : null;
}

/** Facts about a Match's status that every Format shares. Pure. */
import type { Match } from "@/lib/bracket/types";

/** Whether a Match has a Match Result (a bye's counts as one). */
export function isDecided(match: Match): boolean {
  return match.status === "played";
}

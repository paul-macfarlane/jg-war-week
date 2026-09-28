/** Facts about a Heat's status that every Format shares. Pure. */
import type { Heat } from "@/lib/bracket/types";

/** Whether a Heat has a Heat Result (a bye's counts as one). */
export function isDecided(heat: Heat): boolean {
  return heat.status === "played" || heat.status === "forfeit";
}

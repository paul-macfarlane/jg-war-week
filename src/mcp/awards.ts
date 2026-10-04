import type { ArchiveAward } from "@/lib/archive";
import { type AwardView, namedAward } from "@/lib/awards";

/** An Award as `get_awards` shows it: `get_history`'s shape. */
export type McpAward = ArchiveAward;

export type AwardsResult = { edition: string; awards: McpAward[] };

/**
 * Serializes a War Week's Awards into the `get_awards` MCP tool payload:
 * recipients by name, the same shape `get_history` uses.
 */
export function toAwardsResult(
  edition: string,
  awards: AwardView[],
): AwardsResult {
  return {
    edition,
    awards: awards.map(namedAward),
  };
}

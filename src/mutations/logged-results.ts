import type { DBOrTx } from "@/db";
import { type LoggedFormat, isLoggedFormat } from "@/lib/enums";
import { NOT_LOGGED_FORMAT } from "@/lib/logged-results";
import {
  type BracketCompetition,
  COMPETITION_NOT_FOUND,
  lockedCompetition,
} from "@/mutations/brackets";
import type { MutationContext } from "@/mutations/types";

export type LoggedRun = BracketCompetition & { format: LoggedFormat };

/**
 * Locks a Head-to-head or Best score Competition of this War Week for a
 * write; a refusal when it's gone or another Format.
 */
export async function lockedLogged(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
): Promise<LoggedRun | string> {
  const found = await lockedCompetition(tx, competitionId, ctx);
  if (!found) return COMPETITION_NOT_FOUND;
  if (!isLoggedFormat(found.format)) return NOT_LOGGED_FORMAT;
  return found as LoggedRun;
}

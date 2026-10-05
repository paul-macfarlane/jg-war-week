import { and, eq, sql } from "drizzle-orm";

import type { DBTx } from "@/db";
import { competition, competitionHost, participant } from "@/db/schema";

/**
 * Test helper: makes each `email` a Host of its Competition the way the
 * app now stores one (ADR 0012), a roster Participant of the Competition's
 * War Week carrying that email, created when the War Week has none yet.
 * Returns the Participant ids by lowercase email.
 */
export async function insertHosts(
  tx: DBTx,
  rows: { competitionId: string; email: string }[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const { competitionId, email } of rows) {
    const key = email.trim().toLowerCase();
    const [found] = await tx
      .select({ warWeekId: competition.warWeekId })
      .from(competition)
      .where(eq(competition.id, competitionId));
    const warWeekKey = `${found.warWeekId}:${key}`;
    let participantId = ids.get(warWeekKey);
    if (!participantId) {
      const [existing] = await tx
        .select({ id: participant.id })
        .from(participant)
        .where(
          and(
            eq(participant.warWeekId, found.warWeekId),
            eq(sql`lower(${participant.email})`, key),
          ),
        );
      participantId =
        existing?.id ??
        (
          await tx
            .insert(participant)
            .values({
              warWeekId: found.warWeekId,
              displayName: key.split("@")[0],
              email: key,
            })
            .returning({ id: participant.id })
        )[0].id;
      ids.set(warWeekKey, participantId);
      ids.set(key, participantId);
    }
    await tx
      .insert(competitionHost)
      .values({ competitionId, participantId })
      .onConflictDoNothing();
  }
  return ids;
}

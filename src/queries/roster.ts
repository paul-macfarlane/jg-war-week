import { eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { WarWeek, participant, team } from "@/db/schema";
import { type Roster, buildRoster } from "@/lib/roster";
import type { YouCandidate } from "@/lib/you";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

/** Loads a War Week's Teams and Participants, arranged by `buildRoster`. */
export async function getRoster(
  warWeek: Pick<WarWeek, "id" | "mode">,
  dbOrTx: DBOrTx = db,
): Promise<Roster> {
  const [teams, participants] = await Promise.all([
    dbOrTx
      .select({
        id: team.id,
        name: team.name,
        color: team.color,
        logoUrl: team.logoUrl,
      })
      .from(team)
      .where(eq(team.warWeekId, warWeek.id)),
    withProfile(
      dbOrTx
        .select({
          id: participant.id,
          displayName: participantNameSql(),
          image: participantImageSql(),
          companyTag: participant.companyTag,
          teamId: participant.teamId,
          isLeader: participant.isLeader,
        })
        .from(participant)
        .$dynamic(),
    ).where(eq(participant.warWeekId, warWeek.id)),
  ]);

  return buildRoster({ mode: warWeek.mode, teams, participants });
}

/**
 * A War Week's Participants with their emails, for account linking. Stays
 * on the server: only the matched id reaches the client. `displayName` is
 * the roster name as typed (the Profile page's hint); `name` is the shown
 * one (Profile name, else roster name).
 */
export async function getYouCandidates(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<YouCandidate[]> {
  return withProfile(
    dbOrTx
      .select({
        id: participant.id,
        email: participant.email,
        displayName: participant.displayName,
        name: participantNameSql(),
      })
      .from(participant)
      .$dynamic(),
  ).where(eq(participant.warWeekId, warWeek.id));
}

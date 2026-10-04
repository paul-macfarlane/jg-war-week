import { eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { WarWeek, participant, team } from "@/db/schema";
import { isJahnelGroupEmail } from "@/lib/access";
import type { HostCandidate } from "@/lib/host-options";
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
 * the roster name as typed (the Profile page's hint).
 */
export async function getYouCandidates(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<YouCandidate[]> {
  return dbOrTx
    .select({
      id: participant.id,
      email: participant.email,
      displayName: participant.displayName,
    })
    .from(participant)
    .where(eq(participant.warWeekId, warWeek.id));
}

/**
 * A War Week's Participants for the Hosts picker: shown name (the Profile
 * name, else the roster name) and whether their roster email can never sign
 * in. The email is read here and dropped: it never reaches a page.
 */
export async function getHostCandidates(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<HostCandidate[]> {
  const rows = await withProfile(
    dbOrTx
      .select({
        id: participant.id,
        name: participantNameSql(),
        email: participant.email,
      })
      .from(participant)
      .$dynamic(),
  )
    .where(eq(participant.warWeekId, warWeek.id))
    .orderBy(participantNameSql(), participant.id);
  return rows.map(({ id, name, email }) => ({
    id,
    name,
    cantSignIn: !!email?.trim() && !isJahnelGroupEmail(email),
  }));
}

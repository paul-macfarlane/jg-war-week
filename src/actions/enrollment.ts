"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorizeEnroll } from "@/auth/authorize";
import * as mutations from "@/mutations/enrollment";
import type { MutationResult } from "@/mutations/types";

/**
 * A linked Participant enters themselves or their Team (ADR 0006). The
 * facts are checked here first and again under the Competition's lock.
 */
export async function enroll(competitionId: string): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeEnroll(
      "competition.enroll",
      competitionId,
    );
    if (!authorized.ok) return authorized;
    const result = await mutations.enroll(competitionId, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** A linked Participant withdraws themselves or their Team before close. */
export async function withdraw(competitionId: string): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeEnroll(
      "competition.withdraw",
      competitionId,
    );
    if (!authorized.ok) return authorized;
    const result = await mutations.withdraw(competitionId, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** A linked Participant joins their Team's Squad in a Squads Bracket. */
export async function joinSquad(
  competitionId: string,
  squadId: string,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeEnroll(
      "competition.enroll",
      competitionId,
      squadId,
    );
    if (!authorized.ok) return authorized;
    const result = await mutations.joinSquad(
      competitionId,
      squadId,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** A linked Participant leaves their Squad before close (not the last). */
export async function leaveSquad(
  competitionId: string,
  squadId: string,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeEnroll(
      "competition.withdraw",
      competitionId,
      squadId,
    );
    if (!authorized.ok) return authorized;
    const result = await mutations.leaveSquad(
      competitionId,
      squadId,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

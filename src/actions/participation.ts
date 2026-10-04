"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize, authorizeCheckIn } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import { parseMarkInput } from "@/lib/participation/input";
import * as mutations from "@/mutations/participation";
import type { MutationContext, MutationResult } from "@/mutations/types";

/**
 * Runs a Host or Organizer write on a `participation` Competition, in its
 * own War Week (loaded from the row), then revalidates the War Week's
 * pages. `write` parses its input, after authorize.
 */
async function hostWrite(
  action: WarWeekAction,
  competitionId: string,
  write: (ctx: MutationContext) => Promise<MutationResult>,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorize(action, "competition", competitionId);
    if (!authorized.ok) return authorized;
    const result = await write(authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Ticks a Participant as having taken part; `input` is `{ participantId }`. */
export async function markParticipant(
  competitionId: string,
  input: unknown,
): Promise<MutationResult> {
  return hostWrite("participation.mark", competitionId, async (ctx) => {
    const parsed = parseMarkInput(input);
    if (!parsed.ok) return parsed;
    return mutations.markParticipant(
      competitionId,
      parsed.value.participantId,
      ctx,
    );
  });
}

/** Unticks a Participant, a check-in included; `input` is `{ participantId }`. */
export async function unmarkParticipant(
  competitionId: string,
  input: unknown,
): Promise<MutationResult> {
  return hostWrite("participation.mark", competitionId, async (ctx) => {
    const parsed = parseMarkInput(input);
    if (!parsed.ok) return parsed;
    return mutations.unmarkParticipant(
      competitionId,
      parsed.value.participantId,
      ctx,
    );
  });
}

/** Closes a `participation` Competition, scoring who took part. */
export async function closeParticipation(
  competitionId: string,
): Promise<MutationResult> {
  return hostWrite("participation.close", competitionId, (ctx) =>
    mutations.closeParticipation(competitionId, ctx),
  );
}

/** Reopens a closed `participation` Competition, withdrawing its points. */
export async function reopenParticipation(
  competitionId: string,
): Promise<MutationResult> {
  return hostWrite("participation.reopen", competitionId, (ctx) =>
    mutations.reopenParticipation(competitionId, ctx),
  );
}

/**
 * A linked Participant checks themselves in (ADR 0009). The facts are
 * checked here first and again under the Competition's lock.
 */
export async function checkIn(competitionId: string): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeCheckIn(
      "participation.check-in",
      competitionId,
    );
    if (!authorized.ok) return authorized;
    const result = await mutations.checkIn(competitionId, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** A linked Participant removes their own check-in, before close. */
export async function checkOut(competitionId: string): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeCheckIn(
      "participation.check-out",
      competitionId,
    );
    if (!authorized.ok) return authorized;
    const result = await mutations.checkOut(competitionId, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

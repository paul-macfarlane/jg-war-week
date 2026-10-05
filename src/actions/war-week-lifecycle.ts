"use server";

import { guarded } from "@/actions/result";
import { revalidateAdmin, revalidateSite } from "@/actions/revalidate";
import { getActor, setAdminEditionCookie } from "@/auth/actor";
import { authorize } from "@/auth/authorize";
import { getSessionEmail } from "@/auth/server";
import { SIGN_IN_REFUSAL, can } from "@/lib/access";
import type { FieldErrors } from "@/lib/result";
import {
  type ClosingInput,
  type LifecycleAction,
  type NextWarWeekInput,
  lifecycleActionError,
  parseClosingInput,
  parseNextWarWeekInput,
} from "@/lib/war-week-lifecycle";
import type { MutationContext, MutationResult } from "@/mutations/types";
import * as mutations from "@/mutations/war-week-lifecycle";
import { getScoredCounts } from "@/queries/scored-counts";
import type { TargetWarWeek } from "@/queries/targets";
import {
  getCurrentWarWeek,
  getWarWeekByEdition,
  getWarWeeks,
} from "@/queries/war-weeks";

export type LifecycleActionResult = MutationResult;

/** Create next War Week's result: the new edition, or a refusal. */
export type NextWarWeekActionResult =
  | { ok: true; edition: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/**
 * The War Week named by the id in the request, when the caller may run
 * `action` on it: `can` first (Organizers only, on the War Week `authorize`
 * loaded), then the status rules (`lifecycleActionError`) against every
 * War Week.
 */
async function lifecycleWarWeek(
  action: LifecycleAction,
  warWeekId: string,
): Promise<
  | { ok: true; warWeek: TargetWarWeek; ctx: MutationContext }
  | { ok: false; error: string }
> {
  const authorized = await authorize(
    `lifecycle.${action}`,
    "warWeek",
    warWeekId,
  );
  if (!authorized.ok) return authorized;
  const target = authorized.warWeek;
  const warWeeks = await getWarWeeks();
  const scored =
    action === "unstart" ? await getScoredCounts(target.id) : undefined;
  const refusal = lifecycleActionError({ action, target, warWeeks, scored });
  if (refusal) return { ok: false, error: refusal };
  return { ok: true, warWeek: target, ctx: authorized.ctx };
}

/** Start War Week: `upcoming → live`. Refused while another is live. */
export async function startWarWeek(
  warWeekId: string,
): Promise<LifecycleActionResult> {
  return guarded(async () => {
    const organizer = await lifecycleWarWeek("start", warWeekId);
    if (!organizer.ok) return organizer;
    const result = await mutations.startWarWeek(organizer.ctx);
    if (result.ok) revalidateSite();
    return result;
  });
}

/**
 * End War Week: `live → complete`, recording highlights and the Winner.
 * The Winner is never taken from `input`: it is computed server-side from
 * the Standings (no Organizer override).
 */
export async function endWarWeek(
  warWeekId: string,
  input: ClosingInput,
): Promise<LifecycleActionResult> {
  return guarded(async () => {
    const organizer = await lifecycleWarWeek("end", warWeekId);
    if (!organizer.ok) return organizer;
    const parsed = parseClosingInput(input);
    if (!parsed.ok) return parsed;
    const result = await mutations.endWarWeek(parsed.value, organizer.ctx);
    if (result.ok) revalidateSite();
    return result;
  });
}

/**
 * Reopen: `complete → live`, for corrections. Only the most recently
 * ended edition, and refused while another is live or a later edition is
 * upcoming.
 */
export async function reopenWarWeek(
  warWeekId: string,
): Promise<LifecycleActionResult> {
  return guarded(async () => {
    const organizer = await lifecycleWarWeek("reopen", warWeekId);
    if (!organizer.ok) return organizer;
    const result = await mutations.reopenWarWeek(organizer.ctx);
    if (result.ok) revalidateSite();
    return result;
  });
}

/**
 * Unstart: `live → upcoming`, only while nothing has been scored (no Points
 * Entry, Match result, logged Match or Attempt). Re-checked under the row lock.
 */
export async function unstartWarWeek(
  warWeekId: string,
): Promise<LifecycleActionResult> {
  return guarded(async () => {
    const organizer = await lifecycleWarWeek("unstart", warWeekId);
    if (!organizer.ok) return organizer;
    const result = await mutations.unstartWarWeek(organizer.ctx);
    if (result.ok) revalidateSite();
    return result;
  });
}

/**
 * Create next War Week from the War Week `fromWarWeekId` (Organizers only),
 * then selects the new edition in `/admin`.
 */
export async function createNextWarWeek(
  fromWarWeekId: string,
  input: NextWarWeekInput,
): Promise<NextWarWeekActionResult> {
  return guarded(async () => {
    const organizer = await lifecycleWarWeek("create-next", fromWarWeekId);
    if (!organizer.ok) return organizer;
    const parsed = parseNextWarWeekInput(input);
    if (!parsed.ok) return parsed;
    const result = await mutations.createNextWarWeek(
      parsed.value,
      organizer.ctx,
    );
    if (result.ok) {
      const current = await getCurrentWarWeek();
      await setAdminEditionCookie(
        result.edition,
        current?.edition === result.edition,
      );
      revalidateSite();
    }
    return result;
  });
}

/**
 * The admin edition switcher: remembers which War Week `/admin` shows, when
 * the caller may view it there. The pages re-check it on every request, and
 * no action takes its write target from it (ADR 0003).
 */
export async function selectAdminEdition(
  edition: string,
): Promise<LifecycleActionResult> {
  return guarded(async () => {
    if (!(await getSessionEmail())) {
      return { ok: false, error: SIGN_IN_REFUSAL };
    }
    const [target, current, actor] = await Promise.all([
      typeof edition === "string" ? getWarWeekByEdition(edition) : undefined,
      getCurrentWarWeek(),
      getActor(),
    ]);
    if (!target) {
      return { ok: false, error: "That War Week no longer exists." };
    }
    const refusal = can(actor, "admin.view", { warWeekId: target.id });
    if (refusal) return { ok: false, error: refusal };
    await setAdminEditionCookie(target.edition, target.id === current?.id);
    revalidateAdmin();
    return { ok: true };
  });
}

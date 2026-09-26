"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ADMIN_EDITION_COOKIE, getActor } from "@/auth/actor";
import { authorize } from "@/auth/authorize";
import { getSessionEmail } from "@/auth/server";
import type { WarWeek } from "@/db/schema";
import { SIGN_IN_REFUSAL, can } from "@/lib/access";
import {
  type ClosingInput,
  type LifecycleAction,
  type NextWarWeekInput,
  lifecycleActionError,
  parseClosingInput,
  parseNextWarWeekInput,
} from "@/lib/war-week-lifecycle";
import type { MutationResult } from "@/mutations/types";
import * as mutations from "@/mutations/war-week-lifecycle";
import {
  getCurrentWarWeek,
  getWarWeekByEdition,
  getWarWeeks,
} from "@/queries/war-weeks";

export type LifecycleActionResult = MutationResult;

/**
 * The War Week named by the id in the request, when the caller may run
 * `action` on it: `can` first (Organizers only), then the status rules
 * (`lifecycleActionError`) against every War Week.
 */
async function lifecycleWarWeek(
  action: LifecycleAction,
  warWeekId: string,
): Promise<
  { ok: true; warWeek: WarWeek; email: string } | { ok: false; error: string }
> {
  const authorized = await authorize(
    `lifecycle.${action}`,
    "warWeek",
    warWeekId,
  );
  if (!authorized.ok) return authorized;
  const warWeeks = await getWarWeeks();
  const target = warWeeks.find((w) => w.id === authorized.warWeek.id);
  if (!target) return { ok: false, error: "That War Week no longer exists." };
  const refusal = lifecycleActionError({ action, target, warWeeks });
  if (refusal) return { ok: false, error: refusal };
  return { ok: true, warWeek: target, email: authorized.actor.email };
}

// Status decides the current War Week, the home redirect and the Archive,
// so every lifecycle change revalidates the whole site.
function revalidateSite() {
  revalidatePath("/", "layout");
}

/** Start War Week: `upcoming → live`. Refused while another is live. */
export async function startWarWeek(
  warWeekId: string,
): Promise<LifecycleActionResult> {
  const organizer = await lifecycleWarWeek("start", warWeekId);
  if (!organizer.ok) return organizer;
  const result = await mutations.startWarWeek(organizer.warWeek.id);
  if (result.ok) revalidateSite();
  return result;
}

/** End War Week: `live → complete`, recording the Winner and highlights. */
export async function endWarWeek(
  warWeekId: string,
  input: ClosingInput,
): Promise<LifecycleActionResult> {
  const organizer = await lifecycleWarWeek("end", warWeekId);
  if (!organizer.ok) return organizer;
  const parsed = parseClosingInput(input);
  if (!parsed.ok) return parsed;
  const result = await mutations.endWarWeek(organizer.warWeek.id, parsed.value);
  if (result.ok) revalidateSite();
  return result;
}

/**
 * Reopen: `complete → live`, for corrections. Only the most recently
 * ended edition, and refused while another is live or a later edition is
 * upcoming.
 */
export async function reopenWarWeek(
  warWeekId: string,
): Promise<LifecycleActionResult> {
  const organizer = await lifecycleWarWeek("reopen", warWeekId);
  if (!organizer.ok) return organizer;
  const result = await mutations.reopenWarWeek(organizer.warWeek.id);
  if (result.ok) revalidateSite();
  return result;
}

async function setAdminEditionCookie(edition: string, isCurrent: boolean) {
  const jar = await cookies();
  if (isCurrent) {
    jar.delete(ADMIN_EDITION_COOKIE);
    return;
  }
  jar.set(ADMIN_EDITION_COOKIE, edition, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Create next War Week from the War Week `fromWarWeekId` (Organizers only),
 * then selects the new edition in `/admin`.
 */
export async function createNextWarWeek(
  fromWarWeekId: string,
  input: NextWarWeekInput,
): Promise<{ ok: true; edition: string } | { ok: false; error: string }> {
  const organizer = await lifecycleWarWeek("create-next", fromWarWeekId);
  if (!organizer.ok) return organizer;
  const parsed = parseNextWarWeekInput(input);
  if (!parsed.ok) return parsed;
  const result = await mutations.createNextWarWeek(
    organizer.warWeek.id,
    parsed.value,
    organizer.email,
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
}

/**
 * The admin edition switcher: remembers which War Week `/admin` shows, when
 * the caller may view it there. The pages re-check it on every request, and
 * no action takes its write target from it (ADR 0003).
 */
export async function selectAdminEdition(
  edition: string,
): Promise<LifecycleActionResult> {
  if (!(await getSessionEmail())) {
    return { ok: false, error: SIGN_IN_REFUSAL };
  }
  const [target, current, actor] = await Promise.all([
    typeof edition === "string" ? getWarWeekByEdition(edition) : undefined,
    getCurrentWarWeek(),
    getActor(),
  ]);
  if (!target || can(actor, "admin.view", { warWeekId: target.id }) !== null) {
    return {
      ok: false,
      error: "You can't administer that War Week.",
    };
  }
  await setAdminEditionCookie(target.edition, target.id === current?.id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

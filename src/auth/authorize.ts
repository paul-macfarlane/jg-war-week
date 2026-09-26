import { z } from "zod";

import { getActor } from "@/auth/actor";
import { getSessionEmail } from "@/auth/server";
import {
  type AccessTarget,
  type Actor,
  type OrganizerListAction,
  SIGN_IN_REFUSAL,
  type WarWeekAction,
  can,
} from "@/lib/access";
import type { MutationContext } from "@/mutations/types";
import {
  type LoadedTarget,
  type TargetWarWeek,
  loadAnnouncementTarget,
  loadAwardTarget,
  loadCompetitionTarget,
  loadDayTarget,
  loadFaqItemTarget,
  loadParticipantTarget,
  loadPointsEntryTarget,
  loadScheduleItemTarget,
  loadTeamTarget,
  loadWarWeekTarget,
} from "@/queries/targets";

type Refused = { ok: false; error: string };

export type Authorized = {
  ok: true;
  actor: NonNullable<Actor>;
  warWeek: TargetWarWeek;
  /** The loaded row, with what `can` checked on it. */
  target: LoadedTarget;
  ctx: MutationContext;
};

/** What an action's id names, with the family's not-found message. */
const TARGETS = {
  warWeek: ["That War Week no longer exists.", loadWarWeekTarget],
  day: ["That record no longer exists.", loadDayTarget],
  team: ["That record no longer exists.", loadTeamTarget],
  participant: ["That record no longer exists.", loadParticipantTarget],
  competition: ["That Competition no longer exists.", loadCompetitionTarget],
  pointsEntry: ["That Points Entry no longer exists.", loadPointsEntryTarget],
  scheduleItem: [
    "That Schedule Item no longer exists.",
    loadScheduleItemTarget,
  ],
  faqItem: ["That FAQ Item no longer exists.", loadFaqItemTarget],
  award: ["That Award no longer exists.", loadAwardTarget],
  announcement: ["That Announcement no longer exists.", loadAnnouncementTarget],
} as const satisfies Record<
  string,
  readonly [string, (id: string) => Promise<LoadedTarget | undefined>]
>;

export type TargetKind = keyof typeof TARGETS;

const isUuid = (id: unknown): id is string => z.uuid().safeParse(id).success;

/**
 * The one authorize step every War Week action runs before touching its
 * input (ADR 0003):
 * 1. authenticate ("Sign in to continue.");
 * 2. check the id is shaped like a row id (the family's not-found message);
 * 3. load the row and its War Week (a create or the settings save passes
 *    the posted `warWeekId` as a `warWeek` target);
 * 4. load the actor;
 * 5. run `can`, with any posted Competition the request carries.
 * The caller parses its input only after this. Never throws on a refusal.
 */
export async function authorize(
  action: WarWeekAction,
  kind: TargetKind,
  id: unknown,
  options: {
    postedCompetitionId?: string | null;
    notFound?: string;
  } = {},
): Promise<Authorized | Refused> {
  if (!(await getSessionEmail())) return { ok: false, error: SIGN_IN_REFUSAL };
  const [defaultNotFound, load] = TARGETS[kind];
  const notFound = options.notFound ?? defaultNotFound;
  if (!isUuid(id)) return { ok: false, error: notFound };
  const target = await load(id);
  if (!target) return { ok: false, error: notFound };
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };

  const access: AccessTarget = {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    authorEmail: target.authorEmail,
  };
  if ("postedCompetitionId" in options) {
    access.postedCompetitionId = options.postedCompetitionId;
  }
  const refusal = can(actor, action, access);
  if (refusal) return { ok: false, error: refusal };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    target,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
  };
}

/** The authorize step for the global Organizer list: no target to load. */
export async function authorizeOrganizerList(
  action: OrganizerListAction,
): Promise<{ ok: true; actor: NonNullable<Actor> } | Refused> {
  if (!(await getSessionEmail())) return { ok: false, error: SIGN_IN_REFUSAL };
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const refusal = can(actor, action);
  return refusal ? { ok: false, error: refusal } : { ok: true, actor };
}

/**
 * A Competition id a request posts, read before the input is parsed so
 * `can` can check it: a string as sent, blank or missing as null (none).
 */
export function postedCompetitionId(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null;
  const value = (input as { competitionId?: unknown }).competitionId;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

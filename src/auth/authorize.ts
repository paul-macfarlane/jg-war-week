import { getActor } from "@/auth/actor";
import {
  type AccessTarget,
  type Actor,
  type OrganizerListAction,
  SIGN_IN_REFUSAL,
  type SelfAction,
  type WarWeekAction,
  can,
} from "@/lib/access";
import type { GameType } from "@/lib/enums";
import type { GamesConfig } from "@/lib/games/config";
import { SQUAD_MISSING } from "@/lib/games/enroll-rule";
import { postedGamePlayerIds } from "@/lib/games/input";
import { GAME_MISSING, NOT_GAMES } from "@/lib/games/log-rule";
import { isUuid } from "@/lib/uuid";
import type { MutationContext } from "@/mutations/types";
import { type EnrollFacts, getEnrollFacts } from "@/queries/enrollment";
import { getGameLogFacts } from "@/queries/games";
import {
  type HeatReportFacts,
  getHeatReportFacts,
} from "@/queries/heat-reports";
import { getCheckInFacts } from "@/queries/participation";
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
  day: ["That Day no longer exists.", loadDayTarget],
  team: ["That Team no longer exists.", loadTeamTarget],
  participant: ["That Participant no longer exists.", loadParticipantTarget],
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

/**
 * The one authorize step every War Week action runs before touching its
 * input (ADR 0003):
 * 1. authenticate: load the actor ("Sign in to continue." when anonymous);
 * 2. check the id is shaped like a row id (the family's not-found message);
 * 3. load the row and its War Week (a create or the settings save passes
 *    the posted `warWeekId` as a `warWeek` target);
 * 4. run `can`, with any posted Competition the request carries.
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
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [defaultNotFound, load] = TARGETS[kind];
  const notFound = options.notFound ?? defaultNotFound;
  if (!isUuid(id)) return { ok: false, error: notFound };
  const target = await load(id);
  if (!target) return { ok: false, error: notFound };

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

/**
 * The authorize step for self-report, the one Participant write (ADR 0005),
 * in ADR 0003's order: authenticate; both ids shaped like row ids; load the
 * Competition and its War Week; load the Heat's facts for the actor's email
 * (account linking); run `can("bracket.heat-report")`,
 * which binds Organizers and Hosts too. The caller parses its input only
 * after this. Never throws on a refusal.
 */
export async function authorizeHeatReport(
  competitionId: unknown,
  heatId: unknown,
): Promise<
  | {
      ok: true;
      actor: NonNullable<Actor>;
      warWeek: TargetWarWeek;
      ctx: MutationContext;
      linked: NonNullable<HeatReportFacts["linked"]>;
    }
  | Refused
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [competitionNotFound, load] = TARGETS.competition;
  if (!isUuid(competitionId)) return { ok: false, error: competitionNotFound };
  if (!isUuid(heatId)) {
    return { ok: false, error: "That Heat no longer exists." };
  }
  const target = await load(competitionId);
  if (!target) return { ok: false, error: competitionNotFound };

  const facts = await getHeatReportFacts(competitionId, heatId, actor.email);
  const refusal = can(actor, "bracket.heat-report", {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    heatReport: facts.heatReport,
  });
  if (refusal) return { ok: false, error: refusal };
  // `can` refuses an unlinked actor, so this is only for the type.
  if (!facts.linked) return { ok: false, error: SIGN_IN_REFUSAL };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
    linked: facts.linked,
  };
}

/**
 * The authorize step for self-enrollment (ADR 0006): enroll or withdraw,
 * or with a `squadId` join or leave that Squad. In ADR 0003's order:
 * authenticate; the ids shaped like row ids; load the Competition and its
 * War Week; load the enrollment facts for the actor's email (account
 * linking); run `can`, which binds Organizers and Hosts
 * too. Never throws on a refusal.
 */
export async function authorizeEnroll(
  action: "competition.enroll" | "competition.withdraw",
  competitionId: unknown,
  squadId?: unknown,
): Promise<
  | {
      ok: true;
      actor: NonNullable<Actor>;
      warWeek: TargetWarWeek;
      ctx: MutationContext;
      linked: NonNullable<EnrollFacts["linked"]>;
    }
  | Refused
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [competitionNotFound, load] = TARGETS.competition;
  if (!isUuid(competitionId)) return { ok: false, error: competitionNotFound };
  if (squadId !== undefined && !isUuid(squadId)) {
    return { ok: false, error: SQUAD_MISSING };
  }
  const target = await load(competitionId);
  if (!target) return { ok: false, error: competitionNotFound };

  const facts = await getEnrollFacts(competitionId, actor.email, {
    squadId: squadId as string | undefined,
  });
  const refusal = can(actor, action, {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    enroll: facts.enroll,
  });
  if (refusal) return { ok: false, error: refusal };
  // `can` refuses an unlinked actor, so this is only for the type.
  if (!facts.linked) return { ok: false, error: SIGN_IN_REFUSAL };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
    linked: facts.linked,
  };
}

/**
 * The authorize step for checking in or out (ADR 0009), in ADR 0003's
 * order: authenticate; the id shaped like a row id; load the Competition
 * and its War Week; load the check-in facts for the actor's email (account
 * linking); run `can`, which binds Organizers and Hosts too. Never throws
 * on a refusal.
 */
export async function authorizeCheckIn(
  action: "participation.check-in" | "participation.check-out",
  competitionId: unknown,
): Promise<
  | {
      ok: true;
      actor: NonNullable<Actor>;
      warWeek: TargetWarWeek;
      ctx: MutationContext;
    }
  | Refused
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [competitionNotFound, load] = TARGETS.competition;
  if (!isUuid(competitionId)) return { ok: false, error: competitionNotFound };
  const target = await load(competitionId);
  if (!target) return { ok: false, error: competitionNotFound };

  const facts = await getCheckInFacts(competitionId, actor.email);
  const refusal = can(actor, action, {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    checkIn: facts.checkIn,
  });
  if (refusal) return { ok: false, error: refusal };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
  };
}

/**
 * The authorize step for logging, editing and deleting a Game (ADR 0006),
 * in ADR 0003's order: authenticate; the ids shaped like row ids; load the
 * Competition and its War Week; load the Game facts for the actor's email
 * (whether they run this Competition, account linking) with
 * the player ids `input` posts for the Competition's Game Type
 * (`postedGamePlayerIds`, so another type's keys never reach `can`; none
 * for a delete); run
 * `can`, which binds Organizers and Hosts too when closed. Returns the
 * Competition's Game Type and config, which the caller parses its input
 * with only after this. Never throws on a refusal.
 */
export async function authorizeGameWrite(
  action: "games.log" | "games.edit" | "games.delete",
  competitionId: unknown,
  gameId: unknown,
  input: unknown = null,
): Promise<
  | {
      ok: true;
      actor: NonNullable<Actor>;
      warWeek: TargetWarWeek;
      ctx: MutationContext;
      competition: { gameType: GameType; config: GamesConfig };
    }
  | Refused
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [competitionNotFound, load] = TARGETS.competition;
  if (!isUuid(competitionId)) return { ok: false, error: competitionNotFound };
  const isLog = action === "games.log";
  if (!isLog && !isUuid(gameId)) return { ok: false, error: GAME_MISSING };
  const target = await load(competitionId);
  if (!target) return { ok: false, error: competitionNotFound };

  const facts = await getGameLogFacts(
    competitionId,
    isLog ? null : (gameId as string),
    actor.email,
    {
      playerIds: (gameType) =>
        action === "games.delete" ? [] : postedGamePlayerIds(gameType, input),
    },
  );
  if (!facts.competition) return { ok: false, error: NOT_GAMES };
  const refusal = can(actor, action, {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    gameLog: facts.gameLog,
  });
  if (refusal) return { ok: false, error: refusal };
  // A Host or Organizer passes the rule before the Game is looked up.
  if (facts.gameLog.game === "missing") {
    return { ok: false, error: GAME_MISSING };
  }
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
    competition: {
      gameType: facts.competition.gameType,
      config: facts.competition.config,
    },
  };
}

/** The authorize step for the global Organizer list: no target to load. */
export async function authorizeOrganizerList(
  action: OrganizerListAction,
): Promise<{ ok: true; actor: NonNullable<Actor> } | Refused> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const refusal = can(actor, action);
  return refusal ? { ok: false, error: refusal } : { ok: true, actor };
}

/**
 * The authorize step for a self action (your own Profile or account): no
 * target to load; the caller keys its write on the returned actor's email.
 * Never throws on a refusal.
 */
export async function authorizeSelf(
  action: SelfAction,
): Promise<{ ok: true; actor: NonNullable<Actor> } | Refused> {
  const actor = await getActor();
  const refusal = can(actor, action);
  if (refusal || !actor)
    return { ok: false, error: refusal ?? SIGN_IN_REFUSAL };
  return { ok: true, actor };
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
